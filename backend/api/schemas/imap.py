"""Pydantic schemas for IMAP connection and sync endpoints."""

from pydantic import BaseModel, Field


class ImapConnectPayload(BaseModel):
    provider: str = "gmail"
    host: str = ""
    port: int = 993
    email: str = ""
    password: str = ""
    folder: str = "INBOX"
    folders: list[str] | None = None
    use_ssl: bool = True


class ImapFoldersPayload(BaseModel):
    provider: str = "gmail"
    host: str = ""
    port: int = 993
    email: str = ""
    password: str = ""
    use_ssl: bool = True


class ImapSyncPayload(BaseModel):
    days: int = Field(default=30, ge=1, le=180)
    force_rescan: bool = False
