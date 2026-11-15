"""Thread-safe background sync runner with live progress and cooperative cancellation."""

import imaplib
import logging
import threading

from backend.core.models import now_iso
from backend.imap.client import SyncCancelledError
from backend.services.sync import ImapSyncService

logger = logging.getLogger("job_tracker.sync")


class SyncJobManager:
    """Thread-safe background sync runner with live progress and cooperative cancellation."""

    def __init__(self, sync_service: ImapSyncService) -> None:
        self._service = sync_service
        self._lock = threading.Lock()
        self._cancel_event = threading.Event()
        self._state: dict = self._empty_state()

    @staticmethod
    def _empty_state() -> dict:
        return {
            "status": "idle",
            "phase": "idle",
            "current": 0,
            "total": 0,
            "total_headers": 0,
            "skipped_existing": 0,
            "filtered_out": 0,
            "current_subject": "",
            "stats": {
                "fetched": 0,
                "filtered_out": 0,
                "processed_new": 0,
                "skipped_existing": 0,
                "applications_added": 0,
                "applications_updated": 0,
                "interviews_added": 0,
                "alerts_added": 0,
                "ai_parsed": 0,
                "model_unloaded": False,
                "parser_mode": "built-in",
            },
            "error": "",
            "started_at": "",
            "finished_at": "",
        }

    def get_status(self) -> dict:
        with self._lock:
            return {
                **self._state,
                "stats": dict(self._state.get("stats") or {}),
            }

    def start_sync(self, days: int = 30, force_rescan: bool = False) -> dict:
        with self._lock:
            if self._state["status"] == "running":
                return {**self._state, "stats": dict(self._state["stats"])}
            self._cancel_event.clear()
            self._state = {
                **self._empty_state(),
                "status": "running",
                "phase": "connecting",
                "started_at": now_iso(),
            }

        thread = threading.Thread(
            target=self._run_worker,
            args=(days, force_rescan),
            daemon=True,
        )
        thread.start()
        return self.get_status()

    def cancel_sync(self) -> dict:
        with self._lock:
            if self._state["status"] == "running":
                self._cancel_event.set()
                self._state["phase"] = "cancelling"
                logger.info("[sync] Cancel requested by user.")
            return {**self._state, "stats": dict(self._state["stats"])}

    def _on_progress(self, patch: dict) -> None:
        with self._lock:
            for key in (
                "phase",
                "current",
                "total",
                "total_headers",
                "skipped_existing",
                "filtered_out",
                "current_subject",
            ):
                if key in patch:
                    self._state[key] = patch[key]
            if "stats" in patch and isinstance(patch["stats"], dict):
                self._state["stats"] = {**self._state["stats"], **patch["stats"]}

    def _run_worker(self, days: int, force_rescan: bool) -> None:
        try:
            stats = self._service.sync(
                days=days,
                force_rescan=force_rescan,
                cancel_event=self._cancel_event,
                progress_cb=self._on_progress,
            )
            with self._lock:
                self._state["status"] = "completed"
                self._state["phase"] = "done"
                self._state["stats"] = stats
                self._state["current"] = self._state["total"]
                self._state["current_subject"] = ""
                self._state["finished_at"] = now_iso()
        except SyncCancelledError as exc:
            logger.info("[sync] %s", exc)
            with self._lock:
                self._state["status"] = "cancelled"
                self._state["phase"] = "done"
                self._state["error"] = str(exc)
                self._state["current_subject"] = ""
                self._state["finished_at"] = now_iso()
        except imaplib.IMAP4.error as exc:
            logger.error("[sync] IMAP sign-in error: %s", exc)
            with self._lock:
                self._state["status"] = "error"
                self._state["phase"] = "done"
                self._state["error"] = f"Email sign-in error: {exc}"
                self._state["current_subject"] = ""
                self._state["finished_at"] = now_iso()
        except Exception as exc:
            logger.exception("[sync] Sync failed: %s", exc)
            with self._lock:
                self._state["status"] = "error"
                self._state["phase"] = "done"
                self._state["error"] = str(exc)
                self._state["current_subject"] = ""
                self._state["finished_at"] = now_iso()
