"""Pydantic schemas for job applications endpoints."""

from pydantic import BaseModel, Field


class ApplicationPayload(BaseModel):
    company: str | None = None
    role_title: str | None = None
    status: str | None = None
    source_platform: str | None = None
    applied_date: str | None = None
    last_update_date: str | None = None
    location: str | None = None
    notes: str | None = None
    job_url: str | None = None
    merge: bool = False


class DuplicateCheckPayload(BaseModel):
    company: str = ""
    role_title: str = ""
    job_url: str = ""
    exclude_id: int | None = None


class BulkApplicationsPayload(BaseModel):
    ids: list[int] = Field(default_factory=list)
    action: str = ""
    status: str | None = None
