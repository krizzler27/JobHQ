"""Job alert recommendations, conversion, rescoring, and bulk actions routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import AppContext, get_app_context, get_db
from backend.api.schemas.alerts import (
    AlertConvertPayload,
    AlertStatusPayload,
    BulkAlertsPayload,
)
from backend.repositories.alerts import JobAlertRepository
from backend.services.alert_scoring import rescore_all_alerts

router = APIRouter()


@router.get("/api/alerts")
def list_alerts(
    status: str = "",
    source_app: str = "",
    min_score: int = 0,
    search: str = "",
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    alerts = JobAlertRepository(db).list_filtered(
        status=status, source_app=source_app, min_score=min_score, search=search
    )
    return {"alerts": [al.to_dict() for al in alerts]}


@router.patch("/api/alerts/{alert_id}")
def update_alert_status(
    alert_id: int, payload: AlertStatusPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    alert, created_app, updated_app = JobAlertRepository(db).update_status(
        alert_id,
        payload.status,
        resolve_duplicate=payload.resolve_duplicate,
        existing_app_id=payload.existing_app_id,
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Job alert not found.")
    out = alert.to_dict()
    out["created_application"] = created_app.to_dict() if created_app else None
    out["updated_application"] = updated_app.to_dict() if updated_app else None
    return out


@router.post("/api/alerts/{alert_id}/convert")
def convert_alert(
    alert_id: int, payload: AlertConvertPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        res = JobAlertRepository(db).convert_alert(
            alert_id, payload.model_dump(exclude_none=True)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not res:
        raise HTTPException(status_code=404, detail="Job alert not found.")
    return res


@router.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not JobAlertRepository(db).delete(alert_id):
        raise HTTPException(status_code=404, detail="Job alert not found.")
    return {"deleted": True}


@router.post("/api/alerts/rescore")
def rescore_alerts(ctx: AppContext = Depends(get_app_context)) -> dict[str, int]:
    return rescore_all_alerts(ctx.db)


@router.post("/api/alerts/bulk")
def bulk_alerts(payload: BulkAlertsPayload, db: Session = Depends(get_db)) -> dict[str, int]:
    repo = JobAlertRepository(db)
    if payload.action == "dismiss_below_score":
        count = repo.dismiss_below_score(min_score=int(payload.min_score or 40))
        return {"updated": count, "created_applications": 0, "deleted": 0}
    ids = [int(x) for x in payload.ids if int(x) > 0]
    if payload.action == "delete":
        deleted = repo.bulk_delete(ids)
        return {"updated": 0, "created_applications": 0, "deleted": deleted}
    status_map = {"dismiss": "dismissed", "apply": "applied", "restore": "suggested"}
    target_status = status_map.get(payload.action)
    if not target_status:
        raise HTTPException(status_code=400, detail="Unsupported bulk alert action.")
    updated, created = repo.bulk_update_status(ids, target_status)
    return {"updated": updated, "created_applications": created, "deleted": 0}
