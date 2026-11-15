"""Focused data-access repositories per SQLAlchemy entity."""

from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.base import BaseRepository
from backend.repositories.imap_config import ImapConfigRepository
from backend.repositories.interviews import InterviewRepository
from backend.repositories.processed_emails import ProcessedEmailRepository
from backend.repositories.profile import ProfileRepository

__all__ = [
    "BaseRepository",
    "ApplicationRepository",
    "InterviewRepository",
    "JobAlertRepository",
    "ProfileRepository",
    "ImapConfigRepository",
    "ProcessedEmailRepository",
]
