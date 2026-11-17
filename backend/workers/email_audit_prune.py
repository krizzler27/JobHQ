"""Worker that prunes raw metadata from old processed email audit records."""

import logging
from typing import Any, Optional

from backend.core.database import DatabaseManager
from backend.repositories.worker_state import WorkerStateRepository
from backend.services.job_hq_lifecycle import JobHQLifecycleService
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.email_audit_prune")


class EmailAuditPruneWorker(BaseWorker):
    """Prunes raw subjects/snippets from processed emails older than threshold days (default 7 days).

    Preserves message_id and category so email deduplication is permanently retained.
    """

    # 7 days * 24h * 60m = 10,080 minutes
    default_interval_minutes: int = 7 * 24 * 60

    def __init__(
        self,
        db: DatabaseManager,
        lifecycle_service: Optional[JobHQLifecycleService] = None,
        days_threshold: int = 7,
    ) -> None:
        self.db = db
        self.lifecycle_service = lifecycle_service or JobHQLifecycleService(db)
        self.days_threshold = max(1, days_threshold)

    @property
    def name(self) -> str:
        return "email_audit_prune"

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

        pruned_count = self.lifecycle_service.prune_processed_email_logs(
            days_threshold=threshold
        )
        if pruned_count > 0:
            logger.info(
                "[Worker:email_audit_prune] Pruned raw metadata from %d old processed email log(s) (>%dd old)",
                pruned_count,
                threshold,
            )
