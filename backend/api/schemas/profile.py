"""Pydantic schemas for user profile and onboarding endpoints."""

from pydantic import BaseModel


class ProfilePayload(BaseModel):
    target_titles: list[str] | None = None
    keywords: list[str] | None = None
    excluded_keywords: list[str] | None = None
    preferred_locations: list[str] | None = None
    scan_subject_keywords: list[str] | None = None
    scan_sender_keywords: list[str] | None = None
    scan_exclude_keywords: list[str] | None = None
    auto_sync_enabled: bool | None = None
    auto_sync_cron: str | None = None
    auto_sync_days: int | None = None
    onboarding_completed: bool | None = None
    llm_backend: str | None = None
    llm_model_path: str | None = None
