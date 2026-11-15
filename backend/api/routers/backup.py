"""Backup export (JSON/SQLite) and JSON import routes."""

import os
import tempfile
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from backend.api.deps import AppContext, get_app_context, get_db
from backend.api.schemas.backup import BackupImportPayload
from backend.services.backup import BackupRestoreService

router = APIRouter()


@router.get("/api/backup/export")
def export_json_backup(db: Session = Depends(get_db)) -> JSONResponse:
    payload = BackupRestoreService(db).export_json()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": f'attachment; filename="job-tracker-backup-{stamp}.json"'
        },
    )


@router.get("/api/backup/sqlite")
def export_sqlite_backup(ctx: AppContext = Depends(get_app_context)) -> FileResponse:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    fd, tmp_path = tempfile.mkstemp(prefix="job-tracker-", suffix=".db")
    os.close(fd)
    try:
        BackupRestoreService.create_sqlite_snapshot(ctx.db, tmp_path)
    except ValueError as err:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as exc:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Database snapshot failed: {exc}") from exc

    return FileResponse(
        path=tmp_path,
        media_type="application/x-sqlite3",
        filename=f"job-tracker-{stamp}.db",
        background=BackgroundTask(os.remove, tmp_path),
    )


@router.post("/api/backup/import")
def import_json_backup(
    payload: BackupImportPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        return BackupRestoreService(db).import_json(
            payload.backup,
            mode=payload.mode,
            include_profile=payload.include_profile,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
