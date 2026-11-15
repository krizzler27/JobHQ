"""Applications CRUD, duplicate detection, and bulk actions routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.api.schemas.applications import (
    ApplicationPayload,
    BulkApplicationsPayload,
    DuplicateCheckPayload,
)
from backend.repositories.applications import ApplicationRepository

router = APIRouter()


@router.get("/api/applications")
def list_applications(
    status: str = "", search: str = "", db: Session = Depends(get_db)
) -> dict[str, Any]:
    app_repo = ApplicationRepository(db)
    app_repo.auto_ghost_stale(days_threshold=10)
    apps = app_repo.list_filtered(status=status, search=search)
    return {"applications": [a.to_dict() for a in apps]}


@router.post("/api/applications/check-duplicate")
def check_duplicate_application(
    payload: DuplicateCheckPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    matches = ApplicationRepository(db).find_duplicates(
        company=payload.company,
        role_title=payload.role_title,
        job_url=payload.job_url,
        exclude_id=payload.exclude_id,
    )
    return {"has_duplicates": len(matches) > 0, "matches": matches}


@router.post("/api/applications", status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    data = payload.model_dump(exclude_none=True, exclude={"merge"})
    created = ApplicationRepository(db).create(data)
    return created.to_dict()


@router.patch("/api/applications/{app_id}")
def update_application(
    app_id: int, payload: ApplicationPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    data = payload.model_dump(exclude_none=True, exclude={"merge"})
    repo = ApplicationRepository(db)
    updated = repo.merge_update(app_id, data) if payload.merge else repo.update(app_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Application not found.")
    return updated.to_dict()


@router.delete("/api/applications/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not ApplicationRepository(db).delete(app_id):
        raise HTTPException(status_code=404, detail="Application not found.")
    return {"deleted": True}


@router.post("/api/applications/bulk")
def bulk_applications(
    payload: BulkApplicationsPayload, db: Session = Depends(get_db)
) -> dict[str, int]:
    ids = [int(x) for x in payload.ids if int(x) > 0]
    repo = ApplicationRepository(db)
    if payload.action == "delete":
        return {"updated": 0, "deleted": repo.bulk_delete(ids)}
    if payload.action == "move_stage" and payload.status:
        return {"updated": repo.bulk_update_status(ids, payload.status), "deleted": 0}
    raise HTTPException(status_code=400, detail="Unsupported bulk application action.")
