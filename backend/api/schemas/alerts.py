"""Pydantic schemas for job alerts endpoints."""

from pydantic import BaseModel, Field


class AlertStatusPayload(BaseModel):
    status: str = ""
    resolve_duplicate: str | None = None
    existing_app_id: int | None = None


class AlertConvertPayload(BaseModel):
    target: str = "application"
    company: str | None = None
    role_title: str | None = None
    status: str | None = None
    source_platform: str | None = None
    applied_date: str | None = None
    round_label: str | None = None
    scheduled_at: str | None = None
    timezone: str | None = None
    meeting_link: str | None = None
    interviewer_names: str | None = None
    job_url: str | None = None
    resolve_duplicate: str | None = None
    existing_app_id: int | None = None


class BulkAlertsPayload(BaseModel):
    ids: list[int] = Field(default_factory=list)
    action: str = ""
    min_score: int = 40
