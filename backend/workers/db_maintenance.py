"""Worker that runs periodic SQLite WAL checkpoint truncation and query planner optimization."""

import logging
from typing import Any, Optional

from backend.core.database import DatabaseManager
from backend.services.job_hq_lifecycle import JobHQLifecycleService
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.db_maintenance")


class DbMaintenanceWorker(BaseWorker):
    """Executes periodic PRAGMA wal_checkpoint(TRUNCATE) and PRAGMA optimize."""

    # 7 days * 24h * 60m = 10,080 minutes
    default_interval_minutes: int = 7 * 24 * 60

    def __init__(
        self,
        db: DatabaseManager,
        lifecycle_service: Optional[JobHQLifecycleService] = None,
    ) -> None:
        self.db = db
        self.lifecycle_service = lifecycle_service or JobHQLifecycleService(db)

    @property
    def name(self) -> str:
        return "db_maintenance"

    def is_enabled(self, *args: Any, **kwargs: Any) -> bool:
        return True

    def execute(self, *args: Any, **kwargs: Any) -> None:
        stats = self.lifecycle_service.run_database_maintenance()
        logger.info(
            "[Worker:db_maintenance] Database hygiene completed (checkpoint: %s, optimize: %s)",
            stats.get("wal_checkpoint"),
            stats.get("optimize"),
        )
