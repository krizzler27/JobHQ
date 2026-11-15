"""SQLAlchemy ORM declarative entities and serialization helpers."""

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from backend.core.constants import DEFAULT_SCAN_SENDER_KEYWORDS, DEFAULT_SCAN_SUBJECT_KEYWORDS
from backend.core.cron import next_cron_run, validate_cron_expression


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Base(DeclarativeBase):
    pass


class SerializerMixin:
    def to_dict(self) -> dict[str, Any]:
        return {col.name: getattr(self, col.name) for col in self.__table__.columns}


class Application(Base, SerializerMixin):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(120), nullable=False)
    role_title: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="applied", index=True)
    source_platform: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    applied_date: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    last_update_date: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    location: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    thread_id: Mapped[str] = mapped_column(String(128), nullable=False, default="", index=True)
    latest_email_subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    latest_email_snippet: Mapped[str] = mapped_column(Text, nullable=False, default="")
    job_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso)
    updated_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso, index=True)


class Interview(Base, SerializerMixin):
    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True
    )
    company: Mapped[str] = mapped_column(String(120), nullable=False)
    role_title: Mapped[str] = mapped_column(String(160), nullable=False)
    round_label: Mapped[str] = mapped_column(String(80), nullable=False, default="Interview")
    scheduled_at: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    timezone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    meeting_link: Mapped[str] = mapped_column(Text, nullable=False, default="")
    job_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    interviewer_names: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="upcoming", index=True)
    source_message_id: Mapped[str] = mapped_column(String(255), nullable=False, default="", index=True)
    created_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso)


class JobAlert(Base, SerializerMixin):
    __tablename__ = "job_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_title: Mapped[str] = mapped_column(String(160), nullable=False)
    company_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    source_app: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    relevance_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50, index=True)
    relevance_reason: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="suggested", index=True)
    email_subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    job_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    received_at: Mapped[str] = mapped_column(String(32), nullable=False)
    source_message_id: Mapped[str] = mapped_column(String(255), nullable=False, default="", index=True)
    created_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso)


class ProfileSettings(Base, SerializerMixin):
    __tablename__ = "profile_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    target_titles: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    keywords: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    excluded_keywords: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    preferred_locations: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    scan_subject_keywords: Mapped[str] = mapped_column(Text, nullable=False, default="")
    scan_sender_keywords: Mapped[str] = mapped_column(Text, nullable=False, default="")
    scan_exclude_keywords: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    auto_sync_enabled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    auto_sync_cron: Mapped[str] = mapped_column(String(80), nullable=False, default="0 */4 * * *")
    auto_sync_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    onboarding_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    llm_backend: Mapped[str] = mapped_column(String(40), nullable=False, default="rules")
    llm_endpoint: Mapped[str] = mapped_column(
        String(255), nullable=False, default="http://localhost:8080"
    )
    llm_model_path: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    llm_threads: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    last_sync_at: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    updated_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso)

    def to_dict(self) -> dict[str, Any]:
        data = super().to_dict()
        for key in (
            "target_titles",
            "keywords",
            "excluded_keywords",
            "preferred_locations",
            "scan_exclude_keywords",
        ):
            try:
                data[key] = json.loads(data[key] or "[]")
            except Exception:
                data[key] = []

        for key, fallback in (
            ("scan_subject_keywords", DEFAULT_SCAN_SUBJECT_KEYWORDS),
            ("scan_sender_keywords", DEFAULT_SCAN_SENDER_KEYWORDS),
        ):
            raw_val = (data.get(key) or "").strip()
            if not raw_val:
                data[key] = list(fallback)
            else:
                try:
                    parsed = json.loads(raw_val)
                    data[key] = parsed if isinstance(parsed, list) else list(fallback)
                except Exception:
                    data[key] = list(fallback)

        enabled = bool(data.get("auto_sync_enabled", 0))
        cron_expr = str(data.get("auto_sync_cron") or "0 */4 * * *").strip()
        ok_cron, _ = validate_cron_expression(cron_expr)
        if not ok_cron:
            cron_expr = "0 */4 * * *"
        data["auto_sync_enabled"] = enabled
        data["auto_sync_cron"] = cron_expr
        data["auto_sync_days"] = max(1, min(int(data.get("auto_sync_days") or 7), 180))
        next_dt = next_cron_run(cron_expr) if enabled else None
        data["next_auto_sync_at"] = next_dt.isoformat() if next_dt else ""

        data["onboarding_completed"] = bool(data.get("onboarding_completed", 0))
        if data.get("llm_backend") not in ("rules", "llama_cpp_python"):
            data["llm_backend"] = "rules"
        data.pop("llm_endpoint", None)
        data.pop("llm_threads", None)
        return data


class ImapConfig(Base, SerializerMixin):
    __tablename__ = "imap_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="gmail")
    host: Mapped[str] = mapped_column(String(160), nullable=False, default="imap.gmail.com")
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=993)
    email: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    password: Mapped[str] = mapped_column(Text, nullable=False, default="")
    folder: Mapped[str] = mapped_column(String(80), nullable=False, default="INBOX")
    use_ssl: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso)

    def to_masked_dict(self, source: str = "saved") -> dict[str, Any]:
        return {
            "connected": bool(self.email and self.password and self.host),
            "provider": self.provider,
            "host": self.host,
            "port": self.port,
            "email": self.email,
            "folder": self.folder,
            "use_ssl": bool(self.use_ssl),
            "has_password": bool(self.password),
            "source": source,
        }


class ProcessedEmail(Base, SerializerMixin):
    __tablename__ = "processed_emails"

    message_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    thread_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    sender: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    received_at: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    processed_at: Mapped[str] = mapped_column(String(32), nullable=False, default=now_iso, index=True)
