"""Pydantic schemas for interviews endpoints."""

from pydantic import BaseModel, Field


class InterviewPayload(BaseModel):
    application_id: int | None = None
    company: str | None = None
    role_title: str | None = None
    round_label: str | None = None
    scheduled_at: str | None = None
    duration_minutes: int | None = None
    timezone: str | None = None
    meeting_link: str | None = None
    job_url: str | None = None
    interviewer_names: str | None = None
    status: str | None = None


class BulkInterviewsPayload(BaseModel):
    ids: list[int] = Field(default_factory=list)
    action: str = ""
