"""Central registry for background workers in JobHQ.

Provides a single source of truth for instantiating the registered
system background workers across both standalone worker daemons and the
unified desktop application runner.
"""

from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from backend.core.database import DatabaseManager
    from backend.services.sync import SyncJobManager
    from backend.workers.core.base import BaseWorker


def get_default_workers(db: "DatabaseManager", sync_jobs: "SyncJobManager") -> List["BaseWorker"]:
    """Instantiate and return the standard list of JobHQ background workers."""
    from backend.workers.alert_cleanup import AlertCleanupWorker
    from backend.workers.auto_backup import AutoBackupWorker
    from backend.workers.auto_ghost import AutoGhostWorker
    from backend.workers.db_maintenance import DbMaintenanceWorker
    from backend.workers.email_audit_prune import EmailAuditPruneWorker
    from backend.workers.email_job_sync import EmailJobSyncWorker
    from backend.workers.interview_lifecycle import InterviewLifecycleWorker

    return [
        EmailJobSyncWorker(db=db, sync_jobs=sync_jobs),
        InterviewLifecycleWorker(db=db),
        AutoGhostWorker(db=db),
        AlertCleanupWorker(db=db),
        EmailAuditPruneWorker(db=db),
        AutoBackupWorker(db=db),
        DbMaintenanceWorker(db=db),
    ]
