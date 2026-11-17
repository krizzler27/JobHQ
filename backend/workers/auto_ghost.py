"""Worker that automatically transitions stale applied applications to ghosted status."""

import logging
from typing import Any

from backend.core.database import DatabaseManager
from backend.repositories.worker_state import WorkerStateRepository
from backend.services.job_hq_lifecycle import JobHQLifecycleService
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.auto_ghost")


class AutoGhostWorker(BaseWorker):
    """Automatically transitions applications with no updates for X days to ghosted via JobHQLifecycleService."""

    default_interval_minutes: int = 24 * 60

    def __init__(
        self,
        db: DatabaseManager,
        lifecycle_service: JobHQLifecycleService | None = None,
        days_threshold: int = 10,
    ) -> None:
        self.db = db
        self.lifecycle_service = lifecycle_service or JobHQLifecycleService(db)
        self.days_threshold = days_threshold

    @property
    def name(self) -> str:
        return "auto_ghost"

    def is_enabled(self, *args: Any, **kwargs: Any) -> bool:
        return True

    def get_cron(self, *args: Any, **kwargs: Any) -> str:
        # Run daily at midnight
        return "0 0 * * *"

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

        moved_count = self.lifecycle_service.ghost_stale_applications(
            days_threshold=threshold
        )
        if moved_count > 0:
            logger.info(
                "[Worker:auto_ghost] Auto-ghosted %d stale application(s) (threshold=%dd).",
                moved_count,
                threshold,
            )
