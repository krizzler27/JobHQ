"""SQLAlchemy engine management, safe schema migrations, indexes, and transactional sessions."""

import os
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from backend.core.constants import VALID_LLM_BACKENDS
from backend.core.models import Base, ImapConfig, ProfileSettings, now_iso


class DatabaseManager:
    """Manages SQLAlchemy engine, safe schema setup, and transactional sessions."""

    def __init__(self, db_path: str | None = None) -> None:
        self._is_memory = db_path == ":memory:"
        self._db_file: str | None = None
        if self._is_memory:
            url = "sqlite:///:memory:"
        else:
            base_dir = os.path.join(os.getcwd(), "data")
            os.makedirs(base_dir, exist_ok=True)
            resolved = db_path or os.path.join(base_dir, "job_tracker.db")
            self._db_file = resolved
            url = f"sqlite:///{resolved}"

        self.engine = create_engine(
            url,
            connect_args={"check_same_thread": False, "timeout": 15},
            future=True,
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
        self._migrate_missing_columns()
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

    def _migrate_missing_columns(self) -> None:
        inspector = inspect(self.engine)
        table_names = set(inspector.get_table_names())
        with self.engine.begin() as conn:
            if "profile_settings" in table_names:
                existing_cols = {c["name"] for c in inspector.get_columns("profile_settings")}
                additions = {
                    "onboarding_completed": "INTEGER NOT NULL DEFAULT 0",
                    "llm_backend": "VARCHAR(40) NOT NULL DEFAULT 'rules'",
                    "llm_endpoint": "VARCHAR(255) NOT NULL DEFAULT 'http://localhost:8080'",
                    "llm_model_path": "VARCHAR(255) NOT NULL DEFAULT ''",
                    "llm_threads": "INTEGER NOT NULL DEFAULT 4",
                    "scan_subject_keywords": "TEXT NOT NULL DEFAULT ''",
                    "scan_sender_keywords": "TEXT NOT NULL DEFAULT ''",
                    "scan_exclude_keywords": "TEXT NOT NULL DEFAULT '[]'",
                    "auto_sync_enabled": "INTEGER NOT NULL DEFAULT 0",
                    "auto_sync_cron": "VARCHAR(80) NOT NULL DEFAULT '0 */4 * * *'",
                    "auto_sync_days": "INTEGER NOT NULL DEFAULT 7",
                }
                for col_name, col_def in additions.items():
                    if col_name not in existing_cols:
                        conn.execute(
                            text(f"ALTER TABLE profile_settings ADD COLUMN {col_name} {col_def}")
                        )

            for table_name in ("applications", "interviews", "job_alerts"):
                if table_name in table_names:
                    cols = {c["name"] for c in inspector.get_columns(table_name)}
                    if "job_url" not in cols:
                        conn.execute(
                            text(f"ALTER TABLE {table_name} ADD COLUMN job_url TEXT NOT NULL DEFAULT ''")
                        )

            if "applications" in table_names:
                conn.execute(
                    text("UPDATE applications SET status = 'applied' WHERE status = 'screening'")
                )

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
