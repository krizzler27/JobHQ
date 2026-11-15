"""Interviews CRUD and bulk actions routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.api.schemas.interviews import BulkInterviewsPayload, InterviewPayload
from backend.repositories.interviews import InterviewRepository

router = APIRouter()


@router.get("/api/interviews")
def list_interviews(status: str = "", db: Session = Depends(get_db)) -> dict[str, Any]:
    ivs = InterviewRepository(db).list_filtered(status=status)
    return {"interviews": [iv.to_dict() for iv in ivs]}


@router.post("/api/interviews", status_code=status.HTTP_201_CREATED)
def create_interview(
    payload: InterviewPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    created = InterviewRepository(db).create(payload.model_dump(exclude_none=True))
    return created.to_dict()


@router.patch("/api/interviews/{iv_id}")
def update_interview(
    iv_id: int, payload: InterviewPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    updated = InterviewRepository(db).update(iv_id, payload.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Interview not found.")
    return updated.to_dict()


@router.delete("/api/interviews/{iv_id}")
def delete_interview(iv_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not InterviewRepository(db).delete(iv_id):
        raise HTTPException(status_code=404, detail="Interview not found.")
    return {"deleted": True}


@router.post("/api/interviews/bulk")
def bulk_interviews(
    payload: BulkInterviewsPayload, db: Session = Depends(get_db)
) -> dict[str, int]:
    ids = [int(x) for x in payload.ids if int(x) > 0]
    if payload.action == "delete":
        return {"deleted": InterviewRepository(db).bulk_delete(ids)}
    raise HTTPException(status_code=400, detail="Unsupported bulk interview action.")
