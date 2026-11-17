"""Worker that deletes unreviewed and dismissed job alerts older than 5 days."""

import logging
from typing import Any, Optional

from backend.core.database import DatabaseManager
from backend.repositories.worker_state import WorkerStateRepository
from backend.services.job_hq_lifecycle import JobHQLifecycleService
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.alert_cleanup")


class AlertCleanupWorker(BaseWorker):
    """Deletes noisy stale job alerts (defaults to running every 5 days)."""

    # 5 days * 24h * 60m = 7,200 minutes
    default_interval_minutes: int = 5 * 24 * 60

    def __init__(
        self,
        db: DatabaseManager,
        lifecycle_service: Optional[JobHQLifecycleService] = None,
        days_threshold: int = 5,
    ) -> None:
        self.db = db
        self.lifecycle_service = lifecycle_service or JobHQLifecycleService(db)
        self.days_threshold = max(1, days_threshold)

    @property
    def name(self) -> str:
        return "alert_cleanup"

    def is_enabled(self, *args: Any, **kwargs: Any) -> bool:
        return True

    def execute(self, *args: Any, **kwargs: Any) -> None:
        threshold = self.days_threshold
        with self.db.session_scope() as session:
            state = WorkerStateRepository(session).get_or_create(
                self.name,
                default_interval_minutes=self.default_interval_minutes,
                default_threshold_days=self.days_threshold,
            )
            if state.threshold_days is not None:
                threshold = max(1, state.threshold_days)

        deleted_count = self.lifecycle_service.cleanup_stale_alerts(
            days_threshold=threshold
        )
        if deleted_count > 0:
            logger.info(
                "[Worker:alert_cleanup] Pruned %d stale unapplied alert(s) (>%dd old)",
                deleted_count,
                threshold,
            )
