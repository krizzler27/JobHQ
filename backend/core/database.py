"""SQLAlchemy engine management, safe schema migrations, indexes, and transactional sessions."""

import os
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.core.config import config
from backend.core.constants import VALID_LLM_BACKENDS
from backend.core.models import Base, ImapConfig, ProfileSettings, now_iso


class DatabaseManager:
    """Manages SQLAlchemy engine, safe schema setup, and transactional sessions."""

    def __init__(self, db_path: str | None = None) -> None:
        self._is_memory = db_path == ":memory:"
        self._db_file: str | None = None
        if self._is_memory:
            url = "sqlite:///:memory:"
            pool_kwargs = {"poolclass": StaticPool}
        elif db_path and db_path.startswith("sqlite:///"):
            url = db_path
            self._db_file = db_path[len("sqlite:///"):]
            pool_kwargs = {}
        else:
            resolved = str(db_path) if db_path else str(config.db_path)
            self._db_file = resolved
            url = f"sqlite:///{resolved}"
            pool_kwargs = {}

        self.engine = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 15},
            future=True,
            **pool_kwargs,
        )

        @event.listens_for(self.engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _conn_record) -> None:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=15000")
            if not self._is_memory:
                cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

        self._session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
            class_=Session,
        )

    def init_schema(self) -> None:
        Base.metadata.create_all(self.engine)
        self._ensure_indexes()
        with self.session_scope() as session:
            if not session.get(ProfileSettings, 1):
                session.add(
                    ProfileSettings(
                        id=1,
                        llm_backend="rules",
                        llm_model_path="",
                        updated_at=now_iso(),
                    )
                )
            if not session.get(ImapConfig, 1):
                session.add(ImapConfig(id=1, updated_at=now_iso()))

    def _ensure_indexes(self) -> None:
        index_ddls = (
            "CREATE INDEX IF NOT EXISTS ix_applications_status ON applications (status)",
            "CREATE INDEX IF NOT EXISTS ix_applications_thread_id ON applications (thread_id)",
            "CREATE INDEX IF NOT EXISTS ix_applications_updated_at ON applications (updated_at)",
            "CREATE INDEX IF NOT EXISTS ix_interviews_scheduled_at ON interviews (scheduled_at)",
            "CREATE INDEX IF NOT EXISTS ix_interviews_status ON interviews (status)",
            "CREATE INDEX IF NOT EXISTS ix_interviews_source_message_id ON interviews (source_message_id)",
            "CREATE INDEX IF NOT EXISTS ix_job_alerts_source_app ON job_alerts (source_app)",
            "CREATE INDEX IF NOT EXISTS ix_job_alerts_relevance_score ON job_alerts (relevance_score)",
            "CREATE INDEX IF NOT EXISTS ix_job_alerts_status ON job_alerts (status)",
            "CREATE INDEX IF NOT EXISTS ix_job_alerts_source_message_id ON job_alerts (source_message_id)",
            "CREATE INDEX IF NOT EXISTS ix_processed_emails_category ON processed_emails (category)",
            "CREATE INDEX IF NOT EXISTS ix_processed_emails_processed_at ON processed_emails (processed_at)",
        )
        with self.engine.begin() as conn:
            for ddl in index_ddls:
                conn.execute(text(ddl))

    def _ensure_file_ready(self) -> None:
        if not self._is_memory and self._db_file and not os.path.exists(self._db_file):
            os.makedirs(os.path.dirname(self._db_file), exist_ok=True)
            self.engine.dispose()
            Base.metadata.create_all(self.engine)
            self._ensure_indexes()

    @contextmanager
    def session_scope(self) -> Iterator[Session]:
        self._ensure_file_ready()
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
