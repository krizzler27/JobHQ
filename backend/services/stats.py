"""Funnel, platform conversion, daily/weekly pace, and alert triage analytics service."""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.core.constants import VALID_APP_STATUSES
from backend.core.models import Application, JobAlert
from backend.core.normalizers import parse_iso_date
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.interviews import InterviewRepository


class StatsQueryService:
    """Aggregates funnel, platform, weekly pace, and job alert analytics."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.apps = ApplicationRepository(session)
        self.interviews = InterviewRepository(session)
        self.alerts = JobAlertRepository(session)

    def build_stats(self, days: int | None = None) -> dict[str, Any]:
        self.apps.auto_ghost_stale(days_threshold=10)
        now = datetime.now(timezone.utc)
        cutoff_dt = (now - timedelta(days=days)) if days and days > 0 else None
        cutoff_str = cutoff_dt.strftime("%Y-%m-%d") if cutoff_dt else ""
        cutoff_10d = (now - timedelta(days=10)).strftime("%Y-%m-%d")

        all_apps = self.apps.list_filtered()
        all_ivs = self.interviews.list_filtered()
        all_alerts = self.alerts.list_filtered()

        interviewed_app_ids = {
            iv.application_id for iv in all_ivs if iv.application_id is not None
        }
        earliest_iv_by_app: dict[int, datetime] = {}
        for iv in all_ivs:
            if iv.application_id is None:
                continue
            iv_dt = parse_iso_date(iv.scheduled_at or iv.created_at)
            if iv_dt and (
                iv.application_id not in earliest_iv_by_app
                or iv_dt < earliest_iv_by_app[iv.application_id]
            ):
                earliest_iv_by_app[iv.application_id] = iv_dt

        filtered_apps: list[Application] = []
        for app in all_apps:
            ref_date = (app.applied_date or app.created_at or "")[:10]
            if cutoff_str and ref_date and ref_date < cutoff_str:
                continue
            filtered_apps.append(app)

        stage_counts = {s: 0 for s in VALID_APP_STATUSES}
        active_count = 0
        responded_count = 0
        interview_reached_count = 0
        response_days_samples: list[int] = []

        platform_buckets: dict[str, dict[str, Any]] = {}

        for app in filtered_apps:
            if app.status in stage_counts:
                stage_counts[app.status] += 1

            ref_10d = (app.last_update_date or app.applied_date or app.updated_at or "")[:10]
            if app.status == "interviewing" or (
                app.status == "applied" and (not ref_10d or ref_10d > cutoff_10d)
            ):
                active_count += 1

            reached_iv = app.status in ("interviewing", "offer") or app.id in interviewed_app_ids
            responded = app.status in ("interviewing", "offer", "rejected") or app.id in interviewed_app_ids
            if responded:
                responded_count += 1
            if reached_iv:
                interview_reached_count += 1

            applied_dt = parse_iso_date(app.applied_date or app.created_at)
            resp_dt = earliest_iv_by_app.get(app.id)
            if not resp_dt and responded:
                resp_dt = parse_iso_date(app.last_update_date)
            resp_days: int | None = None
            if applied_dt and resp_dt and resp_dt >= applied_dt:
                delta = (resp_dt - applied_dt).days
                if 0 <= delta <= 180 and (
                    responded
                    or app.last_update_date != app.applied_date
                    or app.id in earliest_iv_by_app
                ):
                    resp_days = delta
                    response_days_samples.append(delta)

            plat_name = (app.source_platform or "").strip() or "Unknown"
            plat_key = plat_name.lower()
            if plat_key not in platform_buckets:
                platform_buckets[plat_key] = {
                    "platform": plat_name,
                    "total": 0,
                    "active": 0,
                    "applied": 0,
                    "interviewing": 0,
                    "offers": 0,
                    "rejected": 0,
                    "ghosted": 0,
                    "responded": 0,
                    "reached_interview": 0,
                    "resp_samples": [],
                }
            pb = platform_buckets[plat_key]
            pb["total"] += 1
            if app.status in ("applied", "interviewing", "rejected", "ghosted"):
                pb[app.status] += 1
            elif app.status == "offer":
                pb["offers"] += 1
            if app.status in ("applied", "interviewing"):
                pb["active"] += 1
            if responded:
                pb["responded"] += 1
            if reached_iv:
                pb["reached_interview"] += 1
            if resp_days is not None:
                pb["resp_samples"].append(resp_days)

        total_apps = len(filtered_apps)
        platforms_out: list[dict[str, Any]] = []
        for pb in platform_buckets.values():
            t = pb["total"]
            samples = pb["resp_samples"]
            platforms_out.append(
                {
                    "platform": pb["platform"],
                    "total": t,
                    "active": pb["active"],
                    "applied": pb["applied"],
                    "interviewing": pb["interviewing"],
                    "offers": pb["offers"],
                    "rejected": pb["rejected"],
                    "ghosted": pb["ghosted"],
                    "response_rate_pct": round((pb["responded"] / t) * 100, 1) if t else 0.0,
                    "interview_rate_pct": round((pb["reached_interview"] / t) * 100, 1) if t else 0.0,
                    "avg_response_days": round(sum(samples) / len(samples), 1) if samples else None,
                }
            )
        platforms_out.sort(key=lambda p: (-p["total"], -p["interview_rate_pct"], p["platform"].lower()))

        today_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        current_monday = today_dt - timedelta(days=today_dt.weekday())
        week_starts = [current_monday - timedelta(days=7 * i) for i in range(11, -1, -1)]
        week_counts: dict[str, int] = {ws.strftime("%Y-%m-%d"): 0 for ws in week_starts}
        for app in filtered_apps:
            dt = parse_iso_date(app.applied_date or app.created_at)
            if not dt:
                continue
            monday = dt - timedelta(days=dt.weekday())
            key = monday.strftime("%Y-%m-%d")
            if key in week_counts:
                week_counts[key] += 1

        weekly_pace: list[dict[str, Any]] = []
        for ws in week_starts:
            key = ws.strftime("%Y-%m-%d")
            weekly_pace.append(
                {
                    "week_start": key,
                    "label": ws.strftime("%b %d").replace(" 0", " "),
                    "count": week_counts[key],
                }
            )

        if days == 3:
            pace_window_weeks = 1
        elif days == 7:
            pace_window_weeks = 2
        elif days == 15:
            pace_window_weeks = 3
        elif days == 30:
            pace_window_weeks = 5
        else:
            pace_window_weeks = 12
        recent_counts = [w["count"] for w in weekly_pace[-pace_window_weeks:]]
        avg_per_week = round(sum(recent_counts) / max(1, len(recent_counts)), 1)
        this_week_count = weekly_pace[-1]["count"] if weekly_pace else 0
        peak_week = max(weekly_pace, key=lambda w: w["count"]) if weekly_pace else {"label": "-", "count": 0}

        daily_span = days if days in (3, 7, 15, 30) else 14
        day_dates = [today_dt - timedelta(days=i) for i in range(daily_span - 1, -1, -1)]
        day_counts: dict[str, int] = {d.strftime("%Y-%m-%d"): 0 for d in day_dates}
        for app in filtered_apps:
            dt = parse_iso_date(app.applied_date or app.created_at)
            if not dt:
                continue
            key = dt.strftime("%Y-%m-%d")
            if key in day_counts:
                day_counts[key] += 1

        daily_pace: list[dict[str, Any]] = []
        for d in day_dates:
            key = d.strftime("%Y-%m-%d")
            daily_pace.append(
                {
                    "date": key,
                    "label": d.strftime("%b %d").replace(" 0", " "),
                    "short_label": d.strftime("%a") if daily_span <= 7 else d.strftime("%b %d").replace(" 0", " "),
                    "count": day_counts[key],
                }
            )
        daily_total = sum(d["count"] for d in daily_pace)
        today_count = daily_pace[-1]["count"] if daily_pace else 0
        peak_day = max(daily_pace, key=lambda d: d["count"]) if daily_pace else {"label": "-", "count": 0}

        filtered_alerts: list[JobAlert] = []
        for al in all_alerts:
            rec_date = (al.received_at or al.created_at or "")[:10]
            if cutoff_str and rec_date and rec_date < cutoff_str:
                continue
            filtered_alerts.append(al)

        alert_counts = {"suggested": 0, "applied": 0, "dismissed": 0}
        relevant_alerts_count = 0
        strong_match_count = 0
        alert_sources_map: dict[str, dict[str, Any]] = {}
        for al in filtered_alerts:
            if al.status in alert_counts:
                alert_counts[al.status] += 1
            if al.relevance_score >= 40:
                relevant_alerts_count += 1
            if al.relevance_score >= 70:
                strong_match_count += 1
            src = (al.source_app or "").strip() or "Other"
            if src not in alert_sources_map:
                alert_sources_map[src] = {
                    "source_app": src,
                    "total": 0,
                    "suggested": 0,
                    "applied": 0,
                    "dismissed": 0,
                    "score_sum": 0,
                }
            sb = alert_sources_map[src]
            sb["total"] += 1
            if al.status in ("suggested", "applied", "dismissed"):
                sb[al.status] += 1
            sb["score_sum"] += int(al.relevance_score or 0)

        total_alerts = len(filtered_alerts)
        triaged_total = alert_counts["applied"] + alert_counts["dismissed"]
        top_alert_sources = [
            {
                "source_app": sb["source_app"],
                "total": sb["total"],
                "suggested": sb["suggested"],
                "applied": sb["applied"],
                "dismissed": sb["dismissed"],
                "avg_score": round(sb["score_sum"] / sb["total"], 1) if sb["total"] else 0.0,
            }
            for sb in alert_sources_map.values()
        ]
        top_alert_sources.sort(key=lambda s: (-s["total"], -s["applied"], s["source_app"].lower()))

        # Rejection & Ghosting Retro Breakdown
        retro_counts: dict[str, int] = {}
        retro_total = 0
        for app in filtered_apps:
            if app.status in ("rejected", "ghosted"):
                retro_total += 1
                reason = (app.rejection_reason or "").strip() or "No reason specified"
                retro_counts[reason] = retro_counts.get(reason, 0) + 1

        retro_breakdown = [
            {
                "reason": reason,
                "count": count,
                "percentage": round((count / retro_total) * 100, 1) if retro_total else 0.0,
            }
            for reason, count in sorted(retro_counts.items(), key=lambda x: (-x[1], x[0]))
        ]

        return {
            "range_days": days if days and days > 0 else None,
            "funnel": {
                "total_applications": total_apps,
                "active_count": active_count,
                "stage_counts": stage_counts,
                "responded_count": responded_count,
                "interview_reached_count": interview_reached_count,
                "response_rate_pct": round((responded_count / total_apps) * 100, 1) if total_apps else 0.0,
                "interview_rate_pct": round((interview_reached_count / total_apps) * 100, 1) if total_apps else 0.0,
                "offer_rate_pct": round((stage_counts["offer"] / total_apps) * 100, 1) if total_apps else 0.0,
                "ghosted_rate_pct": round((stage_counts["ghosted"] / total_apps) * 100, 1) if total_apps else 0.0,
                "avg_response_days": (
                    round(sum(response_days_samples) / len(response_days_samples), 1)
                    if response_days_samples
                    else None
                ),
            },
            "platforms": platforms_out,
            "weekly_pace": weekly_pace,
            "pace_summary": {
                "this_week_count": this_week_count,
                "avg_per_week": avg_per_week,
                "peak_label": peak_week["label"],
                "peak_count": peak_week["count"],
            },
            "daily_pace": daily_pace,
            "daily_pace_summary": {
                "today_count": today_count,
                "avg_per_day": round(daily_total / max(1, len(daily_pace)), 1),
                "peak_label": peak_day["label"],
                "peak_count": peak_day["count"],
            },
            "alert_stats": {
                "total_alerts": total_alerts,
                "suggested": alert_counts["suggested"],
                "applied": alert_counts["applied"],
                "dismissed": alert_counts["dismissed"],
                "relevant_count": relevant_alerts_count,
                "strong_match_count": strong_match_count,
                "conversion_rate_pct": (
                    round((alert_counts["applied"] / total_alerts) * 100, 1) if total_alerts else 0.0
                ),
                "triaged_conversion_pct": (
                    round((alert_counts["applied"] / triaged_total) * 100, 1) if triaged_total else 0.0
                ),
                "top_sources": top_alert_sources[:8],
            },
            "retro_stats": {
                "total_lost": retro_total,
                "reasons": retro_breakdown,
            },
        }
