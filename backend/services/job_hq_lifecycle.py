"""Job HQ pipeline lifecycle service orchestrating interview, application, alert, and backup routines."""

import os
import shutil
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.core.database import DatabaseManager
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.interviews import InterviewRepository
from backend.services.backup import BackupRestoreService


class JobHQLifecycleService:
    """Service that applies domain rules to transition application and interview states."""

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def complete_past_interviews(self, now_dt: Optional[datetime] = None) -> int:
        """Finds upcoming interviews whose scheduled time + duration has passed and marks them completed."""
        ref_now = now_dt or datetime.now(timezone.utc)
        if ref_now.tzinfo is None:
            ref_now = ref_now.replace(tzinfo=timezone.utc)

        with self.db.session_scope() as session:
            repo = InterviewRepository(session)
            upcoming = repo.list_filtered(status="upcoming")

            to_complete: list[int] = []
            for iv in upcoming:
                sched_str = str(iv.scheduled_at or "").strip()
                if not sched_str:
                    continue

                try:
                    clean_sched = sched_str.replace(" ", "T")
                    if len(clean_sched) == 10:
                        clean_sched += "T10:00:00"
                    elif len(clean_sched) == 16:
                        clean_sched += ":00"

                    dt = datetime.fromisoformat(clean_sched)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)

                    duration = int(iv.duration_minutes or 45)
                    end_time = dt + timedelta(minutes=duration)

                    if end_time <= ref_now:
                        to_complete.append(iv.id)
                except Exception:
                    continue

            if not to_complete:
                return 0

            return repo.bulk_update_status(to_complete, "completed")

    def ghost_stale_applications(self, days_threshold: int = 10) -> int:
        """Evaluates applied applications and transitions those inactive for 10+ days to ghosted."""
        with self.db.session_scope() as session:
            repo = ApplicationRepository(session)
            return repo.auto_ghost_stale(days_threshold=days_threshold)

    def cleanup_stale_alerts(self, days_threshold: int = 5, now_dt: Optional[datetime] = None) -> int:
        """Deletes unreviewed and dismissed job alerts older than days_threshold (default 5 days).

        Preserves all applied or converted alerts.
        """
        ref_now = now_dt or datetime.now(timezone.utc)
        cutoff_date = (ref_now - timedelta(days=max(1, days_threshold))).strftime("%Y-%m-%d")

        with self.db.session_scope() as session:
            repo = JobAlertRepository(session)
            return repo.delete_stale_unapplied(cutoff_date)

    def create_latest_backup(self, backup_dir: Optional[str] = None) -> str:
        """Creates an atomic SQLite snapshot into data/backups/jobhq_latest.db, rotating prior copy to .bak."""
        if self.db._is_memory or not self.db._db_file or not os.path.isfile(self.db._db_file):
            return ""

        target_dir = backup_dir or os.path.join(os.path.dirname(self.db._db_file), "backups")
        os.makedirs(target_dir, exist_ok=True)

        latest_path = os.path.join(target_dir, "jobhq_latest.db")
        bak_path = os.path.join(target_dir, "jobhq_latest.db.bak")

        # Rotate existing backup to .bak if present
        if os.path.isfile(latest_path):
            try:
                shutil.copy2(latest_path, bak_path)
            except Exception:
                pass

        # Perform zero-lock atomic snapshot
        BackupRestoreService.create_sqlite_snapshot(self.db, latest_path)
        return latest_path
