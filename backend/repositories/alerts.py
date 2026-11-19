"""Repository for job alerts filtering, status promotion, conversion, and bulk operations."""

from sqlalchemy import func, or_, select

from backend.core.constants import VALID_ALERT_STATUSES, VALID_APP_STATUSES
from backend.core.models import Application, JobAlert, ProcessedEmail, now_iso
from backend.core.normalizers import clean_http_url, normalize_company, normalize_url_key
from backend.repositories.applications import ApplicationRepository
from backend.repositories.base import BaseRepository
from backend.repositories.interviews import InterviewRepository


class JobAlertRepository(BaseRepository[JobAlert]):
    model_cls = JobAlert

    def list_filtered(
        self, status: str = "", source_app: str = "", min_score: int = 0, search: str = ""
    ) -> list[JobAlert]:
        stmt = select(JobAlert)
        if status and status != "all":
            stmt = stmt.where(JobAlert.status == status)
        if source_app and source_app != "all":
            stmt = stmt.where(JobAlert.source_app == source_app)
        if min_score > 0:
            stmt = stmt.where(JobAlert.relevance_score >= min_score)
        if search.strip():
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    JobAlert.job_title.ilike(like),
                    JobAlert.company_name.ilike(like),
                    JobAlert.source_app.ilike(like),
                )
            )
        stmt = stmt.order_by(
            JobAlert.relevance_score.desc(), JobAlert.received_at.desc(), JobAlert.id.desc()
        )
        return list(self.session.scalars(stmt))

    def exists_for_message_title(self, job_title: str, source_app: str, message_id: str) -> bool:
        return (
            self.session.scalar(
                select(JobAlert.id)
                .where(
                    func.lower(JobAlert.job_title) == job_title.lower(),
                    JobAlert.source_app == source_app,
                    JobAlert.source_message_id == message_id,
                )
                .limit(1)
            )
            is not None
        )

    def find_existing_alert(
        self,
        job_title: str,
        company_name: str = "",
        job_url: str = "",
        source_app: str = "",
    ) -> JobAlert | None:
        """Finds an existing matching alert across all emails to prevent duplicates."""
        url_key = normalize_url_key(job_url)

        # 1. Direct canonical URL match if available
        if url_key:
            # Query non-empty urls to check normalized match
            candidates = list(
                self.session.scalars(
                    select(JobAlert)
                    .where(JobAlert.job_url != "")
                    .order_by(JobAlert.id.desc())
                    .limit(200)
                )
            )
            for cand in candidates:
                if normalize_url_key(cand.job_url) == url_key:
                    return cand

        # 2. Match by normalized title + company (or title + source_app if company is blank)
        norm_title = job_title.strip().lower()
        norm_co = normalize_company(company_name)

        if norm_title:
            stmt = select(JobAlert).where(func.lower(JobAlert.job_title) == norm_title)
            if source_app:
                stmt = stmt.where(JobAlert.source_app == source_app)
            matches = list(self.session.scalars(stmt.order_by(JobAlert.id.desc()).limit(20)))

            for m in matches:
                cand_co = normalize_company(m.company_name)
                # If company is provided, verify company match
                if norm_co and cand_co:
                    if norm_co == cand_co:
                        return m
                elif not norm_co and not cand_co:
                    # Both lack company; same title & platform is considered duplicate
                    return m

        return None

    def exists_for_message(self, message_id: str) -> bool:
        if not message_id:
            return False
        return (
            self.session.scalar(
                select(JobAlert.id).where(JobAlert.source_message_id == message_id).limit(1)
            )
            is not None
        )

    def create(self, payload: dict) -> JobAlert:
        alert = JobAlert(
            job_title=str(payload["job_title"])[:160],
            company_name=str(payload.get("company_name", ""))[:120],
            source_app=str(payload["source_app"])[:80],
            relevance_score=int(payload.get("relevance_score", 50)),
            relevance_reason=str(payload.get("relevance_reason", ""))[:255],
            status=str(payload.get("status", "suggested")),
            email_subject=str(payload.get("email_subject", ""))[:255],
            job_url=clean_http_url(payload.get("job_url", "")),
            received_at=str(payload.get("received_at", now_iso())),
            source_message_id=str(payload.get("source_message_id", "")),
            created_at=now_iso(),
        )
        self.session.add(alert)
        self.session.flush()
        return alert

    def update_status(
        self,
        alert_id: int,
        new_status: str,
        *,
        resolve_duplicate: str | None = None,
        existing_app_id: int | None = None,
    ) -> tuple[JobAlert | None, Application | None, Application | None]:
        alert = self.get(alert_id)
        if not alert:
            return None, None, None
        if new_status not in VALID_ALERT_STATUSES:
            return alert, None, None
        created_app = None
        updated_app = None
        if new_status == "applied" and alert.status != "applied":
            app_repo = ApplicationRepository(self.session)
            company = alert.company_name.strip() or f"Via {alert.source_app}"
            if resolve_duplicate == "update_existing" and existing_app_id:
                updated_app = app_repo.merge_update(
                    int(existing_app_id),
                    {
                        "status": "applied",
                        "source_platform": alert.source_app,
                        "notes": f"Re-applied / updated from {alert.source_app} job alert",
                        "latest_email_subject": alert.email_subject,
                        "job_url": alert.job_url,
                    },
                )
            if not updated_app:
                created_app = app_repo.create(
                    {
                        "company": company,
                        "role_title": alert.job_title,
                        "status": "applied",
                        "source_platform": alert.source_app,
                        "notes": f"Promoted from {alert.source_app} job alert",
                        "latest_email_subject": alert.email_subject,
                        "job_url": alert.job_url,
                    }
                )
        alert.status = new_status
        self.session.flush()
        return alert, created_app, updated_app

    def list_sources(self) -> list[str]:
        stmt = select(JobAlert.source_app).distinct().order_by(JobAlert.source_app.asc())
        return [s for s in self.session.scalars(stmt) if s]

    def bulk_update_status(self, alert_ids: list[int], new_status: str) -> tuple[int, int]:
        if not alert_ids or new_status not in VALID_ALERT_STATUSES:
            return 0, 0
        rows = list(self.session.scalars(select(JobAlert).where(JobAlert.id.in_(alert_ids))))
        created_count = 0
        app_repo = ApplicationRepository(self.session)
        for alert in rows:
            if new_status == "applied" and alert.status != "applied":
                company = alert.company_name.strip() or f"Via {alert.source_app}"
                app_repo.create(
                    {
                        "company": company,
                        "role_title": alert.job_title,
                        "status": "applied",
                        "source_platform": alert.source_app,
                        "notes": f"Promoted from {alert.source_app} job alert",
                        "latest_email_subject": alert.email_subject,
                        "job_url": alert.job_url,
                    }
                )
                created_count += 1
            alert.status = new_status
        self.session.flush()
        return len(rows), created_count

    def dismiss_below_score(self, min_score: int = 40) -> int:
        rows = list(
            self.session.scalars(
                select(JobAlert).where(
                    JobAlert.status == "suggested",
                    JobAlert.relevance_score < min_score,
                )
            )
        )
        for alert in rows:
            alert.status = "dismissed"
        self.session.flush()
        return len(rows)

    def bulk_delete(self, alert_ids: list[int]) -> int:
        if not alert_ids:
            return 0
        rows = list(
            self.session.scalars(select(JobAlert).where(JobAlert.id.in_(alert_ids)))
        )
        for alert in rows:
            self.session.delete(alert)
        self.session.flush()
        return len(rows)

    def convert_alert(self, alert_id: int, payload: dict) -> dict | None:
        """Converts a misclassified JobAlert into an Application or Upcoming Interview and removes the alert."""
        alert = self.get(alert_id)
        if not alert:
            return None

        target = str(payload.get("target", "")).strip().lower()
        if target not in ("application", "interview"):
            raise ValueError("Target must be 'application' or 'interview'.")

        company = (
            str(payload.get("company") or "").strip()
            or alert.company_name.strip()
            or f"Via {alert.source_app}"
        )
        role_title = str(payload.get("role_title") or "").strip() or alert.job_title
        source_platform = str(payload.get("source_platform") or "").strip() or alert.source_app
        job_url = clean_http_url(
            payload["job_url"] if "job_url" in payload else alert.job_url
        )
        today = now_iso()[:10]
        applied_date = (
            str(payload.get("applied_date") or "").strip()
            or (alert.received_at[:10] if alert.received_at else "")
            or today
        )

        app_repo = ApplicationRepository(self.session)
        iv_dict: dict | None = None

        if target == "application":
            status = str(payload.get("status") or "applied").strip()
            if status not in VALID_APP_STATUSES:
                status = "applied"

            resolve_duplicate = str(payload.get("resolve_duplicate") or "").strip().lower()
            existing_app_id = payload.get("existing_app_id")
            if resolve_duplicate == "add_anyway":
                existing = None
            elif resolve_duplicate == "update_existing" and existing_app_id:
                existing = app_repo.get(int(existing_app_id))
            else:
                existing = app_repo.find_match("", company, role_title)

            if existing:
                app_row = (
                    app_repo.merge_update(
                        existing.id,
                        {
                            "status": status,
                            "source_platform": source_platform,
                            "last_update_date": applied_date,
                            "latest_email_subject": alert.email_subject[:200],
                            "job_url": job_url,
                            "notes": f"Updated from {alert.source_app} alert",
                        },
                        preserve_progressed_stage=False,
                    )
                    or existing
                )
            else:
                app_row = app_repo.create(
                    {
                        "company": company,
                        "role_title": role_title,
                        "status": status,
                        "source_platform": source_platform,
                        "applied_date": applied_date,
                        "last_update_date": applied_date,
                        "notes": f"Moved from misclassified {alert.source_app} job alert",
                        "latest_email_subject": alert.email_subject[:200],
                        "job_url": job_url,
                    }
                )
        else:
            existing = app_repo.find_match("", company, role_title)
            if existing:
                if existing.status in ("applied", "ghosted"):
                    app_row = app_repo.update(
                        existing.id,
                        {
                            "status": "interviewing",
                            "last_update_date": today,
                            "latest_email_subject": alert.email_subject[:200],
                            "job_url": job_url or existing.job_url,
                        },
                    ) or existing
                else:
                    app_row = existing
                    if job_url and not existing.job_url:
                        app_repo.update(existing.id, {"job_url": job_url})
            else:
                app_row = app_repo.create(
                    {
                        "company": company,
                        "role_title": role_title,
                        "status": "interviewing",
                        "source_platform": source_platform,
                        "applied_date": applied_date,
                        "last_update_date": today,
                        "notes": f"Moved from misclassified {alert.source_app} job alert",
                        "latest_email_subject": alert.email_subject[:200],
                        "job_url": job_url,
                    }
                )

            iv_row = InterviewRepository(self.session).create(
                {
                    "application_id": app_row.id,
                    "company": app_row.company,
                    "role_title": app_row.role_title,
                    "round_label": str(payload.get("round_label") or "Interview").strip() or "Interview",
                    "scheduled_at": str(payload.get("scheduled_at") or "").strip() or f"{today}T10:00",
                    "timezone": str(payload.get("timezone") or "").strip(),
                    "meeting_link": clean_http_url(payload.get("meeting_link", "")),
                    "job_url": job_url,
                    "interviewer_names": str(payload.get("interviewer_names") or "").strip(),
                    "status": "upcoming",
                    "source_message_id": alert.source_message_id,
                }
            )
            iv_dict = iv_row.to_dict()

        if alert.source_message_id:
            other_exists = self.session.scalar(
                select(JobAlert.id)
                .where(
                    JobAlert.source_message_id == alert.source_message_id,
                    JobAlert.id != alert.id,
                )
                .limit(1)
            )
            if not other_exists:
                pe = self.session.get(ProcessedEmail, alert.source_message_id)
                if pe:
                    pe.category = "interview" if target == "interview" else "application_update"

        self.session.delete(alert)
        self.session.flush()
        return {
            "target": target,
            "application": app_row.to_dict(),
            "interview": iv_dict,
        }

    def delete_stale_unapplied(self, cutoff_date: str) -> int:
        """Deletes unreviewed or dismissed alerts received before cutoff_date, never touching applied alerts."""
        if not cutoff_date:
            return 0
        stmt = select(JobAlert).where(
            JobAlert.status.in_(("suggested", "dismissed")),
            func.substr(JobAlert.received_at, 1, 10) < cutoff_date,
        )
        rows = list(self.session.scalars(stmt))
        for row in rows:
            self.session.delete(row)
        if rows:
            self.session.flush()
        return len(rows)
