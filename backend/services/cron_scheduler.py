"""Background IMAP sync scheduler running on user's 5-field Unix cron schedule."""

import logging
import threading
from datetime import datetime

from backend.core.cron import matches_cron
from backend.core.database import DatabaseManager
from backend.repositories.imap_config import ImapConfigRepository
from backend.repositories.profile import ProfileRepository
from backend.services.sync_job import SyncJobManager

logger = logging.getLogger("job_tracker.cron")


class AutoSyncScheduler:
    """Runs background IMAP syncs automatically according to the user's 5-field Unix cron schedule."""

    def __init__(self, db_manager: DatabaseManager, job_manager: SyncJobManager) -> None:
        self._db = db_manager
        self._jobs = job_manager
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_triggered_minute: str = ""

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop, name="job-tracker-autosync", daemon=True
        )
        self._thread.start()
        logger.info("[cron] Background auto-sync scheduler started.")

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _check_once(self, now_dt: datetime | None = None) -> bool:
        dt = now_dt or datetime.now().astimezone()
        minute_key = dt.strftime("%Y-%m-%d %H:%M")
        if minute_key == self._last_triggered_minute:
            return False

        with self._db.session_scope() as session:
            profile = ProfileRepository(session).get_or_create().to_dict()
            if not profile.get("auto_sync_enabled"):
                return False
            _, source = ImapConfigRepository(session).get_effective_credentials()
            if source == "none":
                return False

        cron_expr = str(profile.get("auto_sync_cron") or "0 */4 * * *")
        days = int(profile.get("auto_sync_days") or 7)
        try:
            if not matches_cron(cron_expr, dt):
                return False
        except Exception as exc:
            logger.warning("[cron] Invalid cron '%s': %s", cron_expr, exc)
            return False

        if self._jobs.get_status().get("status") == "running":
            return False

        self._last_triggered_minute = minute_key
        logger.info("[cron] Triggering scheduled sync (cron='%s', days=%d).", cron_expr, days)
        self._jobs.start_sync(days=days, force_rescan=False)
        return True

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._check_once()
            except Exception as exc:
                logger.warning("[cron] Scheduler check error: %s", exc)
            self._stop_event.wait(20.0)
