"""Dashboard and analytics stats routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.services.dashboard import DashboardQueryService
from backend.services.stats import StatsQueryService

router = APIRouter()


@router.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    return DashboardQueryService(db).build_summary()


@router.get("/api/stats")
def get_stats(days: str = "all", db: Session = Depends(get_db)) -> dict[str, Any]:
    parsed_days: int | None = None
    if days and days != "all":
        try:
            val = int(days)
            if val > 0:
                parsed_days = val
        except ValueError as err:
            raise HTTPException(status_code=400, detail="Invalid stats range.") from err
    return StatsQueryService(db).build_stats(days=parsed_days)
