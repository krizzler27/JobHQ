"""Unit tests verifying the modularized backend packages against isolated :memory: SQLite."""

import unittest
from datetime import datetime, timedelta, timezone

from backend.core.cron import matches_cron, next_cron_run, validate_cron_expression
from backend.core.database import DatabaseManager
from backend.core.normalizers import normalize_company, normalize_url_key
from backend.main import create_app
from backend.api.deps import create_app_context
from backend.parsing.classifier import classify_email, detect_source_app
from backend.parsing.extractors import extract_application_info, extract_job_alert_titles
from backend.parsing.scorer import score_job_title
from backend.repositories.alerts import JobAlertRepository
from backend.repositories.applications import ApplicationRepository
from backend.repositories.interviews import InterviewRepository
from backend.repositories.processed_emails import ProcessedEmailRepository
from backend.repositories.profile import ProfileRepository
from backend.services.backup import BackupRestoreService
from backend.services.dashboard import DashboardQueryService
from backend.services.email_filter_context import EmailFilterContextService
from backend.services.stats import StatsQueryService


class ModularBackendTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = DatabaseManager(":memory:")
        self.db.init_schema()

    def tearDown(self) -> None:
        self.db.engine.dispose()

    def test_schema_and_default_rows(self) -> None:
        with self.db.session_scope() as session:
            profile = ProfileRepository(session).get_or_create()
            self.assertEqual(profile.id, 1)
            self.assertEqual(profile.auto_sync_cron, "0 */4 * * *")

    def test_cron_validation_and_next_run(self) -> None:
        self.assertTrue(validate_cron_expression("*/30 * * * *")[0])
        self.assertFalse(validate_cron_expression("invalid cron")[0])
        base = datetime(2026, 3, 10, 9, 15, 0)
        self.assertTrue(matches_cron("15 9 * * *", base))
        nxt = next_cron_run("0 10 * * *", after_dt=base)
        self.assertEqual(nxt, datetime(2026, 3, 10, 10, 0, 0))

    def test_normalizers_and_duplicate_guard(self) -> None:
        self.assertEqual(normalize_company("Acme Robotics, Inc."), "acme robotics")
        self.assertEqual(
            normalize_url_key("https://www.linkedin.com/jobs/view/12345/?utm_source=email"),
            "linkedin.com/jobs/view/12345",
        )
        with self.db.session_scope() as session:
            repo = ApplicationRepository(session)
            created = repo.create(
                {
                    "company": "Acme Corp",
                    "role_title": "Backend Engineer",
                    "job_url": "https://boards.greenhouse.io/acme/jobs/99?trk=mail",
                    "source_platform": "Greenhouse",
                }
            )
            dupes = repo.find_duplicates(
                company="Acme Corporation",
                role_title="Backend Engineer",
                job_url="",
            )
            self.assertEqual(len(dupes), 1)
            self.assertEqual(dupes[0]["id"], created.id)

            url_dupes = repo.find_duplicates(
                company="Other Name",
                role_title="Other Role",
                job_url="https://boards.greenhouse.io/acme/jobs/99",
            )
            self.assertEqual(len(url_dupes), 1)

    def test_auto_ghost_stale_and_stats_same_day_reply(self) -> None:
        today = datetime.now(timezone.utc).date().isoformat()
        stale_date = (datetime.now(timezone.utc).date() - timedelta(days=14)).isoformat()
        with self.db.session_scope() as session:
            app_repo = ApplicationRepository(session)
            stale_app = app_repo.create(
                {
                    "company": "Old Co",
                    "role_title": "Platform Engineer",
                    "status": "applied",
                    "applied_date": stale_date,
                    "last_update_date": stale_date,
                    "source_platform": "LinkedIn",
                }
            )
            recent_reply = app_repo.create(
                {
                    "company": "Fast Co",
                    "role_title": "Staff Python Engineer",
                    "status": "interviewing",
                    "applied_date": today,
                    "last_update_date": today,
                    "source_platform": "Wellfound",
                }
            )
            ghosted_count = app_repo.auto_ghost_stale(days_threshold=10)
            self.assertEqual(ghosted_count, 1)
            self.assertEqual(app_repo.get(stale_app.id).status, "ghosted")
            self.assertEqual(app_repo.get(recent_reply.id).status, "interviewing")

            stats_all = StatsQueryService(session).build_stats(days=None)
            self.assertEqual(stats_all["funnel"]["total_applications"], 2)
            self.assertEqual(stats_all["funnel"]["avg_response_days"], 0.0)

            stats_7d = StatsQueryService(session).build_stats(days=7)
            self.assertEqual(stats_7d["funnel"]["total_applications"], 1)

            dash = DashboardQueryService(session).build_summary()
            self.assertEqual(dash["stage_counts"]["ghosted"], 1)
            self.assertEqual(dash["stage_counts"]["interviewing"], 1)

    def test_parsing_scoring_and_email_filter_context(self) -> None:
        category = classify_email(
            subject="Your interview invitation with Nova AI",
            sender="recruiting@nova.ai",
            body="We would love to schedule a technical interview on Zoom at https://zoom.us/j/123456.",
        )
        self.assertEqual(category, "interview")
        self.assertEqual(detect_source_app("jobs-noreply@linkedin.com", "LinkedIn Alert", ""), "LinkedIn")

        app_info = extract_application_info(
            sender="no-reply@ashbyhq.com",
            subject="Thank you for applying to Senior Backend Engineer at Orbit Labs",
            body="We received your application for Senior Backend Engineer at Orbit Labs.",
            link_items=[],
        )
        self.assertIn("Orbit", app_info["company"])

        titles = extract_job_alert_titles(
            subject="30+ new jobs for Python Engineer",
            body="Senior Backend Engineer - Stripe - Remote\nView job: https://www.linkedin.com/jobs/view/111222/",
            link_items=[("Senior Backend Engineer", "https://www.linkedin.com/jobs/view/111222/")],
        )
        self.assertTrue(len(titles) >= 1)

        score, _reason = score_job_title(
            "Senior Backend Engineer",
            "Stripe",
            {"target_titles": ["Backend Engineer"], "keywords": ["Python"], "excluded_keywords": []},
            [],
        )
        self.assertGreaterEqual(score, 40)

        with self.db.session_scope() as session:
            ProcessedEmailRepository(session).upsert(
                message_id="<msg-1@example.com>",
                thread_id="t-1",
                category="job_alert",
                subject="Weekly Tech Digest Notification",
                sender="Promo <digest@newsletter.io>",
                received_at="2026-03-10T09:00:00Z",
            )
            alert = JobAlertRepository(session).create(
                {
                    "job_title": "Weekly Tech Digest",
                    "company_name": "Newsletter",
                    "source_app": "Email",
                    "relevance_score": 45,
                    "relevance_reason": "Keyword match",
                    "email_subject": "Weekly Tech Digest Notification",
                    "received_at": "2026-03-10T09:00:00Z",
                    "source_message_id": "<msg-1@example.com>",
                }
            )
            ctx = EmailFilterContextService(session).get_context("alert", alert.id)
            self.assertIsNotNone(ctx)
            self.assertEqual(ctx["sender_email"], "digest@newsletter.io")
            self.assertEqual(ctx["sender_domain"], "newsletter.io")

    def test_backup_export_and_import_roundtrip(self) -> None:
        with self.db.session_scope() as session:
            app_row = ApplicationRepository(session).create(
                {"company": "Stripe", "role_title": "API Engineer", "status": "applied"}
            )
            InterviewRepository(session).create(
                {
                    "application_id": app_row.id,
                    "company": "Stripe",
                    "role_title": "API Engineer",
                    "round_label": "Phone Screen",
                    "status": "upcoming",
                }
            )
            exported = BackupRestoreService(session).export_json()

        db2 = DatabaseManager(":memory:")
        db2.init_schema()
        try:
            with db2.session_scope() as session2:
                result = BackupRestoreService(session2).import_json(
                    exported, mode="replace", include_profile=True
                )
                self.assertEqual(result["added"]["applications"], 1)
                self.assertEqual(result["added"]["interviews"], 1)
        finally:
            db2.engine.dispose()

    def test_fastapi_app_route_registration(self) -> None:
        ctx = create_app_context(db_path=":memory:")
        try:
            app = create_app(context=ctx)
            paths = set(app.openapi()["paths"].keys())
            expected = {
                "/api/health",
                "/api/dashboard",
                "/api/stats",
                "/api/applications",
                "/api/applications/check-duplicate",
                "/api/applications/bulk",
                "/api/interviews",
                "/api/interviews/bulk",
                "/api/alerts",
                "/api/alerts/bulk",
                "/api/alerts/rescore",
                "/api/imap/status",
                "/api/imap/folders",
                "/api/imap/connect",
                "/api/imap/disconnect",
                "/api/imap/sync",
                "/api/imap/sync-status",
                "/api/imap/sync-cancel",
                "/api/profile",
                "/api/profile/reset-scan-filters",
                "/api/onboarding/complete",
                "/api/emails/log",
                "/api/emails/log/ignored",
                "/api/emails/filter-context",
                "/api/backup/export",
                "/api/backup/sqlite",
                "/api/backup/import",
                "/api/llm/recommendations",
                "/api/llm/status",
                "/api/llm/test",
                "/api/llm/download",
                "/api/llm/download-status",
            }
            self.assertTrue(expected.issubset(paths), f"Missing routes: {expected - paths}")
        finally:
            ctx.db.engine.dispose()


if __name__ == "__main__":
    unittest.main()
