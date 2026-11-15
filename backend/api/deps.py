"""Application dependency container and FastAPI dependency providers."""

from dataclasses import dataclass
from typing import Iterator

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.core.database import DatabaseManager
from backend.services.sync import AutoSyncScheduler, ImapSyncService, SyncJobManager


@dataclass
class AppContext:
    db: DatabaseManager
    sync_service: ImapSyncService
    sync_job_manager: SyncJobManager
    auto_sync_scheduler: AutoSyncScheduler


def create_app_context(db_path: str | None = None) -> AppContext:
    db = DatabaseManager(db_path=db_path)
    sync_service = ImapSyncService(db)
    sync_job_manager = SyncJobManager(sync_service)
    auto_sync_scheduler = AutoSyncScheduler(db, sync_job_manager)
    return AppContext(
        db=db,
        sync_service=sync_service,
        sync_job_manager=sync_job_manager,
        auto_sync_scheduler=auto_sync_scheduler,
    )


DEFAULT_APP_CONTEXT = create_app_context()


def get_app_context() -> AppContext:
    return DEFAULT_APP_CONTEXT


def get_db(ctx: AppContext = Depends(get_app_context)) -> Iterator[Session]:
    with ctx.db.session_scope() as session:
        yield session
