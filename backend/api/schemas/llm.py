"""Pydantic schemas for local SLM endpoints."""

from pydantic import BaseModel


class LlmTestPayload(BaseModel):
    llm_backend: str | None = None
    llm_model_path: str | None = None


class LlmDownloadPayload(BaseModel):
    model_id: str
