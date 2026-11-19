"""REST API router for inspecting, configuring, and triggering background workers."""

from typing import Any, Optional
from datetime import datetime, timezone
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.api.deps import get_app_context, get_db, AppContext
from backend.repositories.worker_state import WorkerStateRepository
from backend.services.job_hq_lifecycle import JobHQLifecycleService

router = APIRouter(prefix="/api/workers", tags=["workers"])

WORKER_METADATA: dict[str, dict[str, Any]] = {
    "email_job_sync": {
        "title": "Email Inbox Sync",
        "category": "Synchronization",
        "description": "Periodically connects to your configured IMAP mailbox to scan for new interview invites and job applications.",
        "default_interval_minutes": 240,  # 4 hours
        "unit": "hours",
        "interval_options": [
            {"label": "Every 30 minutes", "minutes": 30},
            {"label": "Every 1 hour", "minutes": 60},
            {"label": "Every 2 hours", "minutes": 120},
            {"label": "Every 4 hours", "minutes": 240},
            {"label": "Every 8 hours", "minutes": 480},
        ],
    },
    "interview_lifecycle": {
        "title": "Interview Status Transition",
        "category": "Pipeline Hygiene",
        "description": "Automatically marks past scheduled interviews as completed once meeting duration has elapsed.",
        "default_interval_minutes": 60,  # 1 hour
        "unit": "hours",
        "interval_options": [
            {"label": "Every 30 minutes", "minutes": 30},
            {"label": "Every 1 hour", "minutes": 60},
            {"label": "Every 2 hours", "minutes": 120},
            {"label": "Every 4 hours", "minutes": 240},
        ],
    },
    "auto_ghost": {
        "title": "Application Auto-Ghosting",
        "category": "Pipeline Hygiene",
        "description": "Automatically moves applied applications with no employer updates for a period of time to ghosted.",
        "default_interval_minutes": 1440,  # 24 hours
        "default_threshold_days": 10,
        "threshold_label": "Ghost inactive jobs after",
        "threshold_options": [
            {"label": "5 days", "value": 5},
            {"label": "7 days", "value": 7},
            {"label": "10 days", "value": 10},
            {"label": "14 days", "value": 14},
            {"label": "21 days", "value": 21},
            {"label": "30 days", "value": 30},
        ],
        "unit": "hours",
        "interval_options": [
            {"label": "Every 6 hours", "minutes": 360},
            {"label": "Every 12 hours", "minutes": 720},
            {"label": "Every 24 hours", "minutes": 1440},
            {"label": "Every 48 hours", "minutes": 2880},
        ],
    },
    "alert_cleanup": {
        "title": "Job Digest Auto-Pruning",
        "category": "Data Hygiene",
        "description": "Deletes noisy unreviewed and dismissed job alert digest items older than your retention limit. Preserves all applied jobs.",
        "default_interval_minutes": 7200,  # 5 days
        "default_threshold_days": 5,
        "threshold_label": "Prune alerts older than",
        "threshold_options": [
            {"label": "3 days", "value": 3},
            {"label": "5 days", "value": 5},
            {"label": "7 days", "value": 7},
            {"label": "14 days", "value": 14},
            {"label": "30 days", "value": 30},
        ],
        "unit": "days",
        "interval_options": [
            {"label": "Every 1 day", "minutes": 1440},
            {"label": "Every 3 days", "minutes": 4320},
            {"label": "Every 5 days", "minutes": 7200},
            {"label": "Every 7 days", "minutes": 10080},
            {"label": "Every 14 days", "minutes": 20160},
        ],
    },
    "email_audit_prune": {
        "title": "Processed Email Audit Pruning",
        "category": "Data Hygiene",
        "description": "Prunes raw subjects and sender strings from old processed email logs while keeping message hashes for permanent deduplication.",
        "default_interval_minutes": 10080,  # 7 days
        "default_threshold_days": 7,
        "threshold_label": "Prune logs older than",
        "threshold_options": [
            {"label": "3 days", "value": 3},
            {"label": "7 days", "value": 7},
            {"label": "14 days", "value": 14},
            {"label": "30 days", "value": 30},
            {"label": "60 days", "value": 60},
            {"label": "90 days", "value": 90},
        ],
        "unit": "days",
        "interval_options": [
            {"label": "Every 1 day", "minutes": 1440},
            {"label": "Every 3 days", "minutes": 4320},
            {"label": "Every 7 days", "minutes": 10080},
            {"label": "Every 14 days", "minutes": 20160},
            {"label": "Every 30 days", "minutes": 43200},
        ],
    },
    "auto_backup": {
        "title": "Database Hot Backup",
        "category": "Safety & Recovery",
        "description": "Periodically takes an atomic snapshot of your SQLite database into ~/.jobhq/backups/jobhq_latest.db.",
        "default_interval_minutes": 10080,  # 7 days
        "unit": "days",
        "interval_options": [
            {"label": "Every 1 day", "minutes": 1440},
            {"label": "Every 3 days", "minutes": 4320},
            {"label": "Every 7 days", "minutes": 10080},
            {"label": "Every 14 days", "minutes": 20160},
            {"label": "Every 30 days", "minutes": 43200},
        ],
    },
    "db_maintenance": {
        "title": "Database WAL Checkpoint & Optimization",
        "category": "Safety & Recovery",
        "description": "Flushes SQLite write-ahead log files back into disk via PRAGMA wal_checkpoint(TRUNCATE) and updates query planner statistics.",
        "default_interval_minutes": 10080,  # 7 days
        "unit": "days",
        "interval_options": [
            {"label": "Every 1 day", "minutes": 1440},
            {"label": "Every 3 days", "minutes": 4320},
            {"label": "Every 7 days", "minutes": 10080},
            {"label": "Every 14 days", "minutes": 20160},
            {"label": "Every 30 days", "minutes": 43200},
        ],
    },
}


class WorkerUpdatePayload(BaseModel):
    interval_minutes: Optional[int] = Field(None, ge=1)
    is_enabled: Optional[bool] = None
    threshold_days: Optional[int] = Field(None, ge=1)


@router.get("")
def list_workers(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    repo = WorkerStateRepository(db)
    result: list[dict[str, Any]] = []

    for name, meta in WORKER_METADATA.items():
        state = repo.get_or_create(
            name=name,
            default_interval_minutes=meta["default_interval_minutes"],
            default_enabled=True,
            default_threshold_days=meta.get("default_threshold_days"),
        )
        row = state.to_dict()
        result.append({
            **row,
            "title": meta["title"],
            "category": meta["category"],
            "description": meta["description"],
            "unit": meta["unit"],
            "interval_options": meta["interval_options"],
            "threshold_label": meta.get("threshold_label"),
            "threshold_options": meta.get("threshold_options"),
            "is_enabled": bool(row["is_enabled"]),
        })

    return result


@router.patch("/{name}")
def update_worker(
    name: str,
    payload: WorkerUpdatePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if name not in WORKER_METADATA:
        raise HTTPException(status_code=404, detail=f"Worker '{name}' not found.")

    repo = WorkerStateRepository(db)
    updated = repo.update_config(
        name=name,
        interval_minutes=payload.interval_minutes,
        is_enabled=payload.is_enabled,
        threshold_days=payload.threshold_days,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Worker state not found.")

    meta = WORKER_METADATA[name]
    row = updated.to_dict()
    return {
        **row,
        "title": meta["title"],
        "category": meta["category"],
        "description": meta["description"],
        "unit": meta["unit"],
        "interval_options": meta["interval_options"],
        "threshold_label": meta.get("threshold_label"),
        "threshold_options": meta.get("threshold_options"),
        "is_enabled": bool(row["is_enabled"]),
    }


@router.post("/{name}/run")
def trigger_worker_now(
    name: str,
    ctx: AppContext = Depends(get_app_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if name not in WORKER_METADATA:
        raise HTTPException(status_code=404, detail=f"Worker '{name}' not found.")

    lifecycle = JobHQLifecycleService(ctx.db)
    repo = WorkerStateRepository(db)
    start_time = time.perf_counter()

    try:
        details = ""
        if name == "auto_backup":
            path = lifecycle.create_latest_backup()
            details = f"Created snapshot: {path}" if path else "In-memory database skipped."
        elif name == "alert_cleanup":
            count = lifecycle.cleanup_stale_alerts(days_threshold=5)
            details = f"Pruned {count} stale alert(s)."
        elif name == "auto_ghost":
            count = lifecycle.ghost_stale_applications(days_threshold=10)
            details = f"Auto-ghosted {count} application(s)."
        elif name == "interview_lifecycle":
            count = lifecycle.complete_past_interviews()
            details = f"Marked {count} interview(s) completed."
        elif name == "email_audit_prune":
            count = lifecycle.prune_processed_email_logs(days_threshold=7)
            details = f"Pruned raw metadata from {count} old log(s)."
        elif name == "db_maintenance":
            stats = lifecycle.run_database_maintenance()
            details = f"Database hygiene completed: checkpoint={stats.get('wal_checkpoint')}, optimize={stats.get('optimize')}."
        elif name == "email_job_sync":
            if ctx.sync_jobs.get_status().get("status") == "running":
                details = "Sync already in progress."
            else:
                ctx.sync_jobs.start_sync(days=1, force_rescan=False)
                details = "Triggered email inbox sync."

        duration = round(time.perf_counter() - start_time, 2)
        state = repo.record_success(name, duration)
        return {
            "success": True,
            "message": details,
            "duration_seconds": duration,
            "worker": state.to_dict(),
        }
    except Exception as exc:
        duration = round(time.perf_counter() - start_time, 2)
        repo.record_failure(name, duration, str(exc))
        raise HTTPException(status_code=500, detail=str(exc))
