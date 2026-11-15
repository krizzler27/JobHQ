"""IMAP connection, folder listing, and background sync control routes."""

import imaplib
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import AppContext, get_app_context, get_db
from backend.api.schemas.imap import ImapConnectPayload, ImapFoldersPayload, ImapSyncPayload
from backend.core.constants import IMAP_PRESETS
from backend.imap.client import ImapClient
from backend.imap.queries import parse_folder_list
from backend.repositories.imap_config import ImapConfigRepository

router = APIRouter()


@router.get("/api/imap/status")
def get_imap_status(db: Session = Depends(get_db)) -> dict[str, Any]:
    return {
        "status": ImapConfigRepository(db).get_masked_status(),
        "presets": IMAP_PRESETS,
    }


@router.post("/api/imap/folders")
def list_imap_folders(
    payload: ImapFoldersPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    provider = payload.provider.strip().lower() or "gmail"
    preset = IMAP_PRESETS.get(provider, IMAP_PRESETS["custom"])
    host = (payload.host or preset["host"]).strip()
    port = int(payload.port or preset["port"] or 993)
    email_addr = payload.email.strip()
    password = payload.password.strip()
    use_ssl = bool(payload.use_ssl)

    if not host or not email_addr:
        raise HTTPException(
            status_code=400, detail="Enter your email address first so we can load your folders."
        )

    if not password:
        creds, _ = ImapConfigRepository(db).get_effective_credentials()
        password = creds.get("password", "")

    if not password:
        raise HTTPException(
            status_code=400, detail="Enter your App Password first so we can load your folders."
        )

    try:
        client = ImapClient(host, port, email_addr, password, use_ssl=use_ssl)
        return {"folders": client.list_folders()}
    except imaplib.IMAP4.error as err:
        raise HTTPException(
            status_code=401,
            detail=f"Sign-in failed: {err}. Make sure IMAP is turned on and you are using an App Password.",
        ) from err
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not load folders from {host}:{port} — {exc}"
        ) from exc


@router.post("/api/imap/connect")
def connect_imap(
    payload: ImapConnectPayload, db: Session = Depends(get_db)
) -> dict[str, Any]:
    provider = payload.provider.strip().lower() or "gmail"
    preset = IMAP_PRESETS.get(provider, IMAP_PRESETS["custom"])
    host = (payload.host or preset["host"]).strip()
    port = int(payload.port or preset["port"] or 993)
    email_addr = payload.email.strip()
    password = payload.password.strip()
    folder_list = parse_folder_list(payload.folders if payload.folders else payload.folder)
    folder_str = ", ".join(folder_list)
    use_ssl = bool(payload.use_ssl)

    if not host or not email_addr:
        raise HTTPException(
            status_code=400, detail="Please enter both your email address and mail server."
        )

    if not password:
        creds, _ = ImapConfigRepository(db).get_effective_credentials()
        password = creds.get("password", "")

    if not password:
        raise HTTPException(status_code=400, detail="Please enter your App Password.")

    try:
        client = ImapClient(host, port, email_addr, password, folder=folder_list, use_ssl=use_ssl)
        test_res = client.test_connection()
        saved_status = ImapConfigRepository(db).save_config(
            {
                "provider": provider,
                "host": host,
                "port": port,
                "email": email_addr,
                "password": password,
                "folder": folder_str,
                "use_ssl": use_ssl,
            }
        )
        return {
            "status": saved_status,
            "mailbox_messages": test_res["mailbox_messages"],
            "folders_checked": test_res["folders_checked"],
            "missing_folders": test_res["missing_folders"],
        }
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except imaplib.IMAP4.error as err:
        raise HTTPException(
            status_code=401,
            detail=(
                f"Sign-in failed: {err}. Make sure IMAP is turned on and you are using an App Password."
            ),
        ) from err
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not connect to {host}:{port} — {exc}"
        ) from exc


@router.delete("/api/imap/disconnect")
def disconnect_imap(db: Session = Depends(get_db)) -> dict[str, Any]:
    return {"status": ImapConfigRepository(db).clear_config()}


@router.post("/api/imap/sync")
def sync_imap(
    payload: ImapSyncPayload,
    db: Session = Depends(get_db),
    ctx: AppContext = Depends(get_app_context),
) -> dict[str, Any]:
    _, source = ImapConfigRepository(db).get_effective_credentials()
    if source == "none":
        raise HTTPException(
            status_code=400, detail="IMAP mailbox is not configured. Connect your email first."
        )
    return ctx.sync_job_manager.start_sync(days=payload.days, force_rescan=payload.force_rescan)


@router.get("/api/imap/sync-status")
def get_sync_status(ctx: AppContext = Depends(get_app_context)) -> dict[str, Any]:
    return ctx.sync_job_manager.get_status()


@router.post("/api/imap/sync-cancel")
def cancel_sync(ctx: AppContext = Depends(get_app_context)) -> dict[str, Any]:
    return ctx.sync_job_manager.cancel_sync()
