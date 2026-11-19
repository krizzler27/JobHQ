"""Application dependency container and FastAPI dependency providers."""

from dataclasses import dataclass
from typing import Iterator

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.core.database import DatabaseManager
from backend.services.sync import ImapSyncService, SyncJobManager


@dataclass
class AppContext:
    db: DatabaseManager
    sync_service: ImapSyncService
    sync_job_manager: SyncJobManager

    @property
    def sync_jobs(self) -> SyncJobManager:
        """Alias for sync_job_manager for ergonomics and backward compatibility."""
        return self.sync_job_manager


def create_app_context(db_path: str | None = None) -> AppContext:
    db = DatabaseManager(db_path=db_path)
    sync_service = ImapSyncService(db)
    sync_job_manager = SyncJobManager(sync_service)
    return AppContext(
        db=db,
        sync_service=sync_service,
        sync_job_manager=sync_job_manager,
    )


DEFAULT_APP_CONTEXT: AppContext | None = None


def get_app_context() -> AppContext:
    global DEFAULT_APP_CONTEXT
    if DEFAULT_APP_CONTEXT is None:
        DEFAULT_APP_CONTEXT = create_app_context()
    return DEFAULT_APP_CONTEXT


def get_db(ctx: AppContext = Depends(get_app_context)) -> Iterator[Session]:
    with ctx.db.session_scope() as session:
        yield session
