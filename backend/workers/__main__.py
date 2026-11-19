"""Standalone worker process runner (`python -m backend.workers`)."""

import logging
import sys

from backend.core.database import DatabaseManager
from backend.services.sync import ImapSyncService, SyncJobManager
from backend.workers.core.registry import get_default_workers
from backend.workers.core.runner import WorkerRunner

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

    # Register all background jobs from single source of truth
    workers = get_default_workers(db=db, sync_jobs=sync_jobs)

    runner = WorkerRunner(workers=workers, db=db)
    runner.run_forever()


if __name__ == "__main__":
    main()
