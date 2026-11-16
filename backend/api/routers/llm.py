"""Local SLM catalog, runtime status, test, and model download routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import AppContext, get_app_context, get_db
from backend.api.schemas.llm import LlmDownloadPayload, LlmTestPayload
from backend.llm.downloader import DOWNLOAD_MANAGER
from backend.llm.prompts import RECOMMENDED_SLMS
from backend.llm.runtime import get_llm_status, test_llm_engine
from backend.repositories.profile import ProfileRepository

router = APIRouter()


@router.get("/api/llm/recommendations")
def get_llm_recommendations() -> dict[str, Any]:
    return {
        "models": RECOMMENDED_SLMS,
        **get_llm_status(),
    }


@router.get("/api/llm/status")
def get_llm_runtime_status() -> dict[str, Any]:
    return get_llm_status()


@router.post("/api/llm/test")
def test_llm(payload: LlmTestPayload, db: Session = Depends(get_db)) -> dict[str, Any]:
    profile = ProfileRepository(db).get_or_create().to_dict()
    backend = payload.llm_backend or profile["llm_backend"]
    model_path = (
        payload.llm_model_path
        if payload.llm_model_path is not None
        else profile["llm_model_path"]
    )
    return test_llm_engine(backend, model_path)


@router.post("/api/llm/download")
def download_llm_model(
    payload: LlmDownloadPayload,
    ctx: AppContext = Depends(get_app_context),
) -> dict[str, Any]:
    def _save_path(rel_path: str) -> None:
        with ctx.db.session_scope() as session:
            ProfileRepository(session).update(
                {"llm_backend": "llama_cpp_python", "llm_model_path": rel_path}
            )

    try:
        return DOWNLOAD_MANAGER.start_download(payload.model_id, on_complete=_save_path)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.get("/api/llm/download-status")
def get_download_status() -> dict[str, Any]:
    return DOWNLOAD_MANAGER.get_status()
