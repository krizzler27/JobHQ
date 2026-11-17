"""Worker that creates a rolling latest SQLite snapshot in data/backups/."""

import logging
from typing import Any, Optional

from backend.core.database import DatabaseManager
from backend.services.job_hq_lifecycle import JobHQLifecycleService
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.auto_backup")


class AutoBackupWorker(BaseWorker):
    """Periodically snapshots the SQLite database (defaults to every 7 days)."""

    # 7 days * 24h * 60m = 10,080 minutes
    default_interval_minutes: int = 7 * 24 * 60

    def __init__(
        self,
        db: DatabaseManager,
        lifecycle_service: Optional[JobHQLifecycleService] = None,
        backup_dir: Optional[str] = None,
    ) -> None:
        self.db = db
        self.lifecycle_service = lifecycle_service or JobHQLifecycleService(db)
        self.backup_dir = backup_dir

    @property
    def name(self) -> str:
        return "auto_backup"

    def is_enabled(self, *args: Any, **kwargs: Any) -> bool:
        return True

    def execute(self, *args: Any, **kwargs: Any) -> None:
        backup_path = self.lifecycle_service.create_latest_backup(self.backup_dir)
        if backup_path:
            logger.info("[Worker:auto_backup] Snapshot created at %s", backup_path)
