"""User profile, email scan filter keywords, and onboarding routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import AppContext, get_app_context, get_db
from backend.api.schemas.profile import ProfilePayload
from backend.repositories.profile import ProfileRepository
from backend.services.alert_scoring import rescore_all_alerts

router = APIRouter()


@router.get("/api/profile")
def get_profile(db: Session = Depends(get_db)) -> dict[str, Any]:
    return ProfileRepository(db).get_or_create().to_dict()


@router.put("/api/profile")
def update_profile(
    payload: ProfilePayload,
    db: Session = Depends(get_db),
    ctx: AppContext = Depends(get_app_context),
) -> dict[str, Any]:
    try:
        updated = ProfileRepository(db).update(payload.model_dump(exclude_none=True)).to_dict()
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    db.commit()
    rescore_all_alerts(ctx.db)
    return updated


@router.post("/api/profile/reset-scan-filters")
def reset_scan_filters(db: Session = Depends(get_db)) -> dict[str, Any]:
    return ProfileRepository(db).reset_scan_filters().to_dict()


@router.post("/api/onboarding/complete")
def complete_onboarding(db: Session = Depends(get_db)) -> dict[str, Any]:
    return ProfileRepository(db).update({"onboarding_completed": True}).to_dict()
