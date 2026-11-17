"""Standalone worker process runner (`python -m backend.workers`)."""

import logging
import sys

from backend.core.database import DatabaseManager
from backend.services.sync import ImapSyncService, SyncJobManager
from backend.workers.alert_cleanup import AlertCleanupWorker
from backend.workers.auto_backup import AutoBackupWorker
from backend.workers.auto_ghost import AutoGhostWorker
from backend.workers.core.runner import WorkerRunner
from backend.workers.db_maintenance import DbMaintenanceWorker
from backend.workers.email_audit_prune import EmailAuditPruneWorker
from backend.workers.email_job_sync import EmailJobSyncWorker
from backend.workers.interview_lifecycle import InterviewLifecycleWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)


def main() -> None:
    db = DatabaseManager()
    db.init_schema()

    sync_service = ImapSyncService(db)
    sync_jobs = SyncJobManager(sync_service)

    # Register all background jobs here (prioritized: user pipeline first, DB hygiene last)
    workers = [
        EmailJobSyncWorker(db=db, sync_jobs=sync_jobs),
        InterviewLifecycleWorker(db=db),
        AutoGhostWorker(db=db),
        AlertCleanupWorker(db=db),
        EmailAuditPruneWorker(db=db),
        AutoBackupWorker(db=db),
        DbMaintenanceWorker(db=db),
    ]

    runner = WorkerRunner(workers=workers, db=db)
    runner.run_forever()


if __name__ == "__main__":
    main()
