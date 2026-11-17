"""Worker that scans email inboxes and synchronizes job applications, interviews, and alerts."""

import logging

from backend.core.database import DatabaseManager
from backend.repositories.imap_config import ImapConfigRepository
from backend.repositories.profile import ProfileRepository
from backend.services.sync_job import SyncJobManager
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.email_job_sync")


class EmailJobSyncWorker(BaseWorker):
    """Worker responsible for fetching and synchronizing job emails via IMAP."""

    default_interval_minutes: int = 4 * 60

    def __init__(self, db: DatabaseManager, sync_jobs: SyncJobManager) -> None:
        self.db = db
        self.sync_jobs = sync_jobs

    @property
    def name(self) -> str:
        return "email_job_sync"

    def is_enabled(self, *args, **kwargs) -> bool:
        with self.db.session_scope() as session:
            profile = ProfileRepository(session).get_or_create().to_dict()
            if not profile.get("auto_sync_enabled"):
                return False

            _, source = ImapConfigRepository(session).get_effective_credentials()
            if source == "none":
                return False

        return True

    def get_cron(self, *args, **kwargs) -> str:
        with self.db.session_scope() as session:
            profile = ProfileRepository(session).get_or_create().to_dict()
            return str(profile.get("auto_sync_cron") or "0 */4 * * *")

    def execute(self, *args, **kwargs) -> None:
        # Skip if sync is already running
        if self.sync_jobs.get_status().get("status") == "running":
            logger.info("[Worker:email_job_sync] Skipped: sync is already in progress.")
            return

        with self.db.session_scope() as session:
            profile = ProfileRepository(session).get_or_create().to_dict()
            days = int(profile.get("auto_sync_days") or 7)

        logger.info("[Worker:email_job_sync] Scanning inbox for job updates (last %d days)...", days)
        self.sync_jobs.start_sync(days=days, force_rescan=False)
