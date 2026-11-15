"""Email scan log and filter-context helper routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.repositories.processed_emails import ProcessedEmailRepository
from backend.services.email_filter_context import EmailFilterContextService

router = APIRouter()


@router.get("/api/emails/log")
def get_email_log(
    category: str = "",
    search: str = "",
    limit: int = 25,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit or 25), 500))
    safe_offset = max(0, int(offset or 0))
    repo = ProcessedEmailRepository(db)
    emails = repo.list_recent(
        limit=safe_limit, offset=safe_offset, category=category, search=search
    )
    total = repo.count_filtered(category=category, search=search)
    return {"emails": [em.to_dict() for em in emails], "total": total}


@router.delete("/api/emails/log/ignored")
def clear_ignored_emails(db: Session = Depends(get_db)) -> dict[str, int]:
    return {"deleted": ProcessedEmailRepository(db).clear_ignored()}


@router.get("/api/emails/filter-context")
def get_email_filter_context(
    kind: str, id: int, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        ctx = EmailFilterContextService(db).get_context(kind, id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if not ctx:
        raise HTTPException(status_code=404, detail="Item not found.")
    return ctx
