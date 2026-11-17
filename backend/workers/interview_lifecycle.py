"""Worker that automatically transitions past interviews to completed status."""

import logging
from typing import Any

from backend.core.database import DatabaseManager
from backend.services.job_hq_lifecycle import JobHQLifecycleService
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.interview_lifecycle")


class InterviewLifecycleWorker(BaseWorker):
    """Checks scheduled interviews and marks past ones as completed via JobHQLifecycleService."""

    default_interval_minutes: int = 60

    def __init__(
        self,
        db: DatabaseManager,
        lifecycle_service: JobHQLifecycleService | None = None,
    ) -> None:
        self.db = db
        self.lifecycle_service = lifecycle_service or JobHQLifecycleService(db)

    @property
    def name(self) -> str:
        return "interview_lifecycle"

    def is_enabled(self, *args: Any, **kwargs: Any) -> bool:
        return True

    def get_cron(self, *args: Any, **kwargs: Any) -> str:
        # Run hourly at minute 0
        return "0 * * * *"

    def execute(self, *args: Any, **kwargs: Any) -> None:
        completed_count = self.lifecycle_service.complete_past_interviews()
        if completed_count > 0:
            logger.info(
                "[Worker:interview_lifecycle] Completed %d past interview(s).",
                completed_count,
            )
