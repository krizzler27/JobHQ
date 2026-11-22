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
        if getattr(self, "_schema_initialized", False):
            return
        Base.metadata.create_all(self.engine, checkfirst=True)
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
        self._schema_initialized = True

    def _ensure_file_ready(self) -> None:
        if not self._is_memory and self._db_file:
            db_dir = os.path.dirname(self._db_file)
            if db_dir and not os.path.exists(db_dir):
                try:
                    os.makedirs(db_dir, exist_ok=True)
                except OSError:
                    pass

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
