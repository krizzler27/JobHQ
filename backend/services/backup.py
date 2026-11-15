"""Portable secret-free JSON export/import and consistent SQLite snapshot service."""

import os
import sqlite3
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.database import DatabaseManager
from backend.core.models import Application, Interview, JobAlert, now_iso
from backend.core.normalizers import (
    clean_http_url,
    normalize_company,
    normalize_match_text,
)
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.interviews import InterviewRepository
from backend.repositories.profile import ProfileRepository


class BackupRestoreService:
    """Handles portable JSON backup export/import (secret-free) and safe SQLite snapshots."""

    FORMAT_NAME = "job-tracker-backup"
    FORMAT_VERSION = 1

    def __init__(self, session: Session) -> None:
        self.session = session

    def export_json(self) -> dict[str, Any]:
        apps = [
            a.to_dict()
            for a in self.session.scalars(select(Application).order_by(Application.id.asc()))
        ]
        ivs = [
            iv.to_dict()
            for iv in self.session.scalars(select(Interview).order_by(Interview.id.asc()))
        ]
        alerts = [
            al.to_dict()
            for al in self.session.scalars(select(JobAlert).order_by(JobAlert.id.asc()))
        ]
        profile = ProfileRepository(self.session).get_or_create().to_dict()
        return {
            "format": self.FORMAT_NAME,
            "version": self.FORMAT_VERSION,
            "exported_at": now_iso(),
            "counts": {
                "applications": len(apps),
                "interviews": len(ivs),
                "job_alerts": len(alerts),
            },
            "data": {
                "applications": apps,
                "interviews": ivs,
                "job_alerts": alerts,
                "profile_settings": profile,
            },
        }

    def import_json(
        self,
        raw_backup: dict[str, Any],
        mode: str = "merge",
        include_profile: bool = True,
    ) -> dict[str, Any]:
        if mode not in ("merge", "replace"):
            raise ValueError("Restore mode must be 'merge' or 'replace'.")
        if not isinstance(raw_backup, dict):
            raise ValueError("Invalid backup file: expected a JSON object.")

        data_obj = raw_backup.get("data") if isinstance(raw_backup.get("data"), dict) else raw_backup
        apps_in = data_obj.get("applications", [])
        ivs_in = data_obj.get("interviews", [])
        alerts_in = data_obj.get("job_alerts", [])
        profile_in = data_obj.get("profile_settings")

        if not isinstance(apps_in, list) or not isinstance(ivs_in, list) or not isinstance(alerts_in, list):
            raise ValueError(
                "Invalid backup file: applications, interviews, and job_alerts must be lists."
            )

        app_repo = ApplicationRepository(self.session)
        iv_repo = InterviewRepository(self.session)
        alert_repo = JobAlertRepository(self.session)

        added = {"applications": 0, "interviews": 0, "job_alerts": 0}
        skipped = {"applications": 0, "interviews": 0, "job_alerts": 0}
        id_map: dict[int, int] = {}

        if mode == "replace":
            self.session.query(Interview).delete()
            self.session.query(JobAlert).delete()
            self.session.query(Application).delete()
            self.session.flush()

            for row in apps_in:
                if not isinstance(row, dict):
                    continue
                old_id = row.get("id")
                created = app_repo.create(row)
                if isinstance(old_id, int):
                    id_map[old_id] = created.id
                added["applications"] += 1

            for row in ivs_in:
                if not isinstance(row, dict):
                    continue
                payload = dict(row)
                old_app_id = payload.get("application_id")
                payload["application_id"] = id_map.get(old_app_id) if isinstance(old_app_id, int) else None
                iv_repo.create(payload)
                added["interviews"] += 1

            for row in alerts_in:
                if not isinstance(row, dict) or not str(row.get("job_title", "")).strip():
                    continue
                alert_repo.create(
                    {
                        **row,
                        "source_app": str(row.get("source_app") or "Other"),
                    }
                )
                added["job_alerts"] += 1
        else:
            existing_apps = list(self.session.scalars(select(Application)))
            by_thread: dict[str, Application] = {}
            by_comp_role: dict[tuple[str, str], Application] = {}
            for ea in existing_apps:
                if ea.thread_id:
                    by_thread[ea.thread_id] = ea
                by_comp_role[(normalize_company(ea.company), normalize_match_text(ea.role_title))] = ea

            for row in apps_in:
                if not isinstance(row, dict):
                    continue
                old_id = row.get("id")
                tid = str(row.get("thread_id", "")).strip()
                key = (
                    normalize_company(row.get("company", "")),
                    normalize_match_text(row.get("role_title", "")),
                )
                match = (by_thread.get(tid) if tid else None) or (
                    by_comp_role.get(key) if key[0] and key[1] else None
                )
                if match:
                    clean_url = clean_http_url(row.get("job_url", ""))
                    if clean_url and not match.job_url:
                        match.job_url = clean_url
                    if isinstance(old_id, int):
                        id_map[old_id] = match.id
                    skipped["applications"] += 1
                else:
                    created = app_repo.create(row)
                    if tid:
                        by_thread[tid] = created
                    if key[0] and key[1]:
                        by_comp_role[key] = created
                    if isinstance(old_id, int):
                        id_map[old_id] = created.id
                    added["applications"] += 1

            existing_ivs = list(self.session.scalars(select(Interview)))
            iv_msg_ids = {iv.source_message_id for iv in existing_ivs if iv.source_message_id}
            iv_sigs = {
                (
                    normalize_company(iv.company),
                    normalize_match_text(iv.role_title),
                    str(iv.scheduled_at or "").strip(),
                )
                for iv in existing_ivs
            }
            for row in ivs_in:
                if not isinstance(row, dict):
                    continue
                msg_id = str(row.get("source_message_id", "")).strip()
                sig = (
                    normalize_company(row.get("company", "")),
                    normalize_match_text(row.get("role_title", "")),
                    str(row.get("scheduled_at", "")).strip(),
                )
                if (msg_id and msg_id in iv_msg_ids) or (sig[0] and sig[2] and sig in iv_sigs):
                    skipped["interviews"] += 1
                else:
                    payload = dict(row)
                    old_app_id = payload.get("application_id")
                    payload["application_id"] = (
                        id_map.get(old_app_id) if isinstance(old_app_id, int) else None
                    )
                    created_iv = iv_repo.create(payload)
                    if created_iv.source_message_id:
                        iv_msg_ids.add(created_iv.source_message_id)
                    iv_sigs.add(sig)
                    added["interviews"] += 1

            existing_alerts = list(self.session.scalars(select(JobAlert)))
            al_msg_sigs = {
                (
                    al.source_message_id,
                    al.source_app.lower(),
                    normalize_match_text(al.job_title),
                )
                for al in existing_alerts
                if al.source_message_id
            }
            al_content_sigs = {
                (
                    normalize_match_text(al.job_title),
                    normalize_company(al.company_name),
                    str(al.received_at or "")[:10],
                )
                for al in existing_alerts
            }
            for row in alerts_in:
                if not isinstance(row, dict) or not str(row.get("job_title", "")).strip():
                    continue
                msg_id = str(row.get("source_message_id", "")).strip()
                src_app = str(row.get("source_app") or "Other").strip()
                msg_sig = (msg_id, src_app.lower(), normalize_match_text(row.get("job_title", "")))
                content_sig = (
                    normalize_match_text(row.get("job_title", "")),
                    normalize_company(row.get("company_name", "")),
                    str(row.get("received_at", ""))[:10],
                )
                if (msg_id and msg_sig in al_msg_sigs) or (
                    content_sig[0] and content_sig[2] and content_sig in al_content_sigs
                ):
                    skipped["job_alerts"] += 1
                else:
                    alert_repo.create({**row, "source_app": src_app})
                    if msg_id:
                        al_msg_sigs.add(msg_sig)
                    al_content_sigs.add(content_sig)
                    added["job_alerts"] += 1

        profile_updated = False
        if include_profile and isinstance(profile_in, dict):
            allowed_keys = (
                "target_titles",
                "keywords",
                "excluded_keywords",
                "preferred_locations",
                "scan_subject_keywords",
                "scan_sender_keywords",
                "scan_exclude_keywords",
                "auto_sync_enabled",
                "auto_sync_cron",
                "auto_sync_days",
                "llm_backend",
            )
            profile_payload = {k: profile_in[k] for k in allowed_keys if k in profile_in}
            if profile_payload:
                ProfileRepository(self.session).update(profile_payload)
                profile_updated = True

        self.session.flush()
        return {
            "mode": mode,
            "added": added,
            "skipped": skipped,
            "profile_updated": profile_updated,
        }

    @staticmethod
    def create_sqlite_snapshot(db_manager: DatabaseManager, dest_path: str) -> None:
        if db_manager._is_memory or not db_manager._db_file or not os.path.isfile(db_manager._db_file):
            raise ValueError("SQLite database file is not available for snapshot download.")
        src = sqlite3.connect(db_manager._db_file)
        dst = sqlite3.connect(dest_path)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
