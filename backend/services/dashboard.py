"""Dashboard read-model aggregation service."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.core.constants import VALID_APP_STATUSES
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.imap_config import ImapConfigRepository
from backend.repositories.interviews import InterviewRepository
from backend.repositories.profile import ProfileRepository


class DashboardQueryService:
    """Composes aggregated dashboard read models from repositories."""

    def __init__(self, session: Session) -> None:
        self.apps = ApplicationRepository(session)
        self.interviews = InterviewRepository(session)
        self.alerts = JobAlertRepository(session)
        self.profile = ProfileRepository(session)
        self.imap = ImapConfigRepository(session)

    def build_summary(self) -> dict:
        self.apps.auto_ghost_stale(days_threshold=10)
        all_apps = self.apps.list_filtered()
        stage_counts = {s: 0 for s in VALID_APP_STATUSES}
        cutoff_10d = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d")
        active_count = 0
        for app in all_apps:
            if app.status in stage_counts:
                stage_counts[app.status] += 1
            if app.status in ("applied", "interviewing"):
                ref_date = (app.last_update_date or app.applied_date or app.updated_at or "")[:10]
                if not ref_date or ref_date > cutoff_10d:
                    active_count += 1

        upcoming_ivs = self.interviews.list_filtered(status="upcoming")
        cutoff_3d_iso = (datetime.now(timezone.utc) - timedelta(days=3)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        all_relevant_alerts = self.alerts.list_filtered(status="suggested", min_score=40)
        relevant_alerts = []
        for al in all_relevant_alerts:
            rec_ts = (al.received_at or al.created_at or "").strip()
            if len(rec_ts) == 10:
                rec_ts = f"{rec_ts}T23:59:59Z"
            if rec_ts >= cutoff_3d_iso:
                relevant_alerts.append(al)

        profile_dict = self.profile.get_or_create().to_dict()
        imap_status = self.imap.get_masked_status()

        return {
            "kpis": {
                "active_applications": active_count,
                "upcoming_interviews": len(upcoming_ivs),
                "offers": stage_counts["offer"],
                "relevant_alerts": len(relevant_alerts),
                "total_applications": len(all_apps),
            },
            "stage_counts": stage_counts,
            "applications": [a.to_dict() for a in all_apps],
            "upcoming_interviews": [iv.to_dict() for iv in upcoming_ivs[:8]],
            "suggested_alerts": [al.to_dict() for al in relevant_alerts[:12]],
            "alert_sources": self.alerts.list_sources(),
            "last_sync_at": profile_dict.get("last_sync_at", ""),
            "onboarding_completed": bool(
                profile_dict.get("onboarding_completed") or imap_status["connected"]
            ),
            "llm_backend": profile_dict.get("llm_backend", "rules"),
            "imap": imap_status,
        }
