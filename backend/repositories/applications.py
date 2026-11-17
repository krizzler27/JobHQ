"""Repository for job application CRUD, duplicate matching, bulk actions, and auto-ghosting."""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, or_, select

from backend.core.constants import VALID_APP_STATUSES
from backend.core.models import Application, now_iso
from backend.core.normalizers import (
    clean_http_url,
    normalize_company,
    normalize_match_text,
    normalize_url_key,
)
from backend.repositories.base import BaseRepository


class ApplicationRepository(BaseRepository[Application]):
    model_cls = Application

    def list_filtered(self, status: str = "", search: str = "") -> list[Application]:
        stmt = select(Application)
        if status and status != "all":
            stmt = stmt.where(Application.status == status)
        if search.strip():
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Application.company.ilike(like),
                    Application.role_title.ilike(like),
                    Application.source_platform.ilike(like),
                    Application.location.ilike(like),
                )
            )
        stmt = stmt.order_by(Application.updated_at.desc(), Application.id.desc())
        return list(self.session.scalars(stmt))

    def find_match(self, thread_id: str, company: str, role_title: str) -> Application | None:
        if thread_id:
            match = self.session.scalar(
                select(Application).where(Application.thread_id == thread_id).limit(1)
            )
            if match:
                return match
        match = self.session.scalar(
            select(Application)
            .where(
                func.lower(Application.company) == company.lower(),
                func.lower(Application.role_title) == role_title.lower(),
            )
            .limit(1)
        )
        if match:
            return match
        company_matches = list(
            self.session.scalars(
                select(Application).where(func.lower(Application.company) == company.lower())
            )
        )
        return company_matches[0] if len(company_matches) == 1 else None

    def find_duplicates(
        self,
        company: str = "",
        role_title: str = "",
        job_url: str = "",
        exclude_id: int | None = None,
    ) -> list[dict[str, Any]]:
        norm_comp = normalize_company(company)
        norm_role = normalize_match_text(role_title)
        url_key = normalize_url_key(job_url)
        if not url_key and not (norm_comp and norm_role):
            return []

        rows = list(
            self.session.scalars(
                select(Application).order_by(Application.updated_at.desc(), Application.id.desc())
            )
        )
        matches: list[tuple[int, dict[str, Any]]] = []
        for app in rows:
            if exclude_id is not None and app.id == exclude_id:
                continue
            reason = ""
            priority = 2
            app_url_key = normalize_url_key(app.job_url)
            if url_key and app_url_key and url_key == app_url_key:
                reason = "Same job link"
                priority = 0
            elif (
                norm_comp
                and norm_role
                and normalize_company(app.company) == norm_comp
                and normalize_match_text(app.role_title) == norm_role
            ):
                reason = "Same company & role"
                priority = 1
            if reason:
                data = app.to_dict()
                data["match_reason"] = reason
                matches.append((priority, data))

        matches.sort(key=lambda item: item[0])
        return [item[1] for item in matches[:5]]

    def merge_update(
        self,
        app_id: int,
        payload: dict,
        *,
        preserve_progressed_stage: bool = True,
    ) -> Application | None:
        app = self.get(app_id)
        if not app:
            return None
        ts = now_iso()
        today = ts[:10]

        requested_status = payload.get("status")
        if requested_status in VALID_APP_STATUSES:
            if not (
                preserve_progressed_stage
                and app.status in ("interviewing", "offer")
                and requested_status in ("applied", "ghosted")
            ):
                app.status = requested_status

        if not app.source_platform and str(payload.get("source_platform", "")).strip():
            app.source_platform = str(payload["source_platform"]).strip()
        if not app.location and str(payload.get("location", "")).strip():
            app.location = str(payload["location"]).strip()
        clean_url = clean_http_url(payload.get("job_url", ""))
        if clean_url and not app.job_url:
            app.job_url = clean_url
        if str(payload.get("latest_email_subject", "")).strip():
            app.latest_email_subject = str(payload["latest_email_subject"]).strip()[:255]

        incoming_note = str(payload.get("notes", "")).strip()
        if incoming_note and incoming_note not in (app.notes or ""):
            app.notes = f"{app.notes}\n{incoming_note}".strip() if app.notes else incoming_note

        app.last_update_date = str(payload.get("last_update_date") or today).strip() or today
        app.updated_at = ts
        self.session.flush()
        return app

    def create(self, payload: dict) -> Application:
        ts = now_iso()
        today = ts[:10]
        status = payload.get("status", "applied")
        if status not in VALID_APP_STATUSES:
            status = "applied"
        app = Application(
            company=str(payload.get("company", "")).strip() or "Unknown Company",
            role_title=str(payload.get("role_title", "")).strip() or "Untitled Role",
            status=status,
            source_platform=str(payload.get("source_platform", "")).strip(),
            applied_date=str(payload.get("applied_date", today)).strip() or today,
            last_update_date=str(payload.get("last_update_date", today)).strip() or today,
            location=str(payload.get("location", "")).strip(),
            notes=str(payload.get("notes", "")).strip(),
            thread_id=str(payload.get("thread_id", "")).strip(),
            latest_email_subject=str(payload.get("latest_email_subject", "")).strip(),
            latest_email_snippet=str(payload.get("latest_email_snippet", "")).strip(),
            job_url=clean_http_url(payload.get("job_url", "")),
            created_at=ts,
            updated_at=ts,
        )
        self.session.add(app)
        self.session.flush()
        return app

    def update(self, app_id: int, payload: dict) -> Application | None:
        app = self.get(app_id)
        if not app:
            return None
        ts = now_iso()
        if "company" in payload and str(payload["company"]).strip():
            app.company = str(payload["company"]).strip()
        if "role_title" in payload and str(payload["role_title"]).strip():
            app.role_title = str(payload["role_title"]).strip()
        next_status = payload.get("status")
        if next_status in VALID_APP_STATUSES:
            app.status = next_status
        for field in (
            "source_platform",
            "applied_date",
            "location",
            "notes",
            "latest_email_subject",
            "latest_email_snippet",
        ):
            if field in payload:
                val = str(payload[field])
                setattr(app, field, val if field == "notes" else val.strip())
        if "job_url" in payload:
            app.job_url = clean_http_url(payload["job_url"])
        app.last_update_date = str(payload.get("last_update_date", ts[:10])).strip() or ts[:10]
        app.updated_at = ts
        self.session.flush()
        return app

    def bulk_update_status(self, app_ids: list[int], new_status: str) -> int:
        if not app_ids or new_status not in VALID_APP_STATUSES:
            return 0
        ts = now_iso()
        rows = list(
            self.session.scalars(select(Application).where(Application.id.in_(app_ids)))
        )
        for app in rows:
            app.status = new_status
            app.last_update_date = ts[:10]
            app.updated_at = ts
        self.session.flush()
        return len(rows)

    def bulk_delete(self, app_ids: list[int]) -> int:
        if not app_ids:
            return 0
        rows = list(
            self.session.scalars(select(Application).where(Application.id.in_(app_ids)))
        )
        for app in rows:
            self.session.delete(app)
        self.session.flush()
        return len(rows)

    def auto_ghost_stale(self, days_threshold: int = 10) -> int:
        """Moves Applied applications with no update for 10+ days to Ghosted."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days_threshold)).strftime("%Y-%m-%d")
        ts = now_iso()
        rows = list(
            self.session.scalars(
                select(Application).where(Application.status == "applied")
            )
        )
        moved = 0
        for app in rows:
            ref_date = (app.last_update_date or app.applied_date or app.updated_at or "")[:10]
            if len(ref_date) == 10 and ref_date <= cutoff:
                app.status = "ghosted"
                app.updated_at = ts
                moved += 1
        if moved:
            self.session.flush()
        return moved
