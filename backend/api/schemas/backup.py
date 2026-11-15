"""Pydantic schemas for backup and restore endpoints."""

from typing import Any

from pydantic import BaseModel


class BackupImportPayload(BaseModel):
    mode: str = "merge"
    include_profile: bool = True
    backup: dict[str, Any]
