"""Unit tests for HTML-to-text extraction, link sanitation, and backup merge deduplication."""

import unittest

from backend.core.database import DatabaseManager
from backend.core.normalizers import clean_http_url, normalize_url_key
from backend.parsing.html_links import (
    html_to_text_and_links,
    html_to_text_links_rich,
    is_noise_link,
    pick_application_link,
)
from backend.repositories.applications import ApplicationRepository
from backend.repositories.interviews import InterviewRepository
from backend.services.backup import BackupRestoreService


class HtmlParsingAndLinkTests(unittest.TestCase):
    def test_html_stripping_and_text_extraction(self) -> None:
        sample_html = """
        <html>
          <head><style>body { font-size: 12px; }</style></head>
          <body>
            <h1>Thank you for applying!</h1>
            <p>We received your application for the <b>Backend Engineer</b> position at Stripe.</p>
            <script>console.log('tracking');</script>
            <div>Please view your <a href="https://jobs.stripe.com/status/12345?utm_source=email">application status</a>.</div>
            <p><a href="https://stripe.com/unsubscribe">Unsubscribe from emails</a></p>
          </body>
        </html>
        """
        text, link_items = html_to_text_links_rich(sample_html)
        self.assertIn("Thank you for applying!", text)
        self.assertIn("Backend Engineer", text)
        self.assertNotIn("console.log", text)
        self.assertNotIn("font-size", text)

        # Ensure links were extracted
        self.assertTrue(any("jobs.stripe.com" in url for url, _ in link_items))

        # Check noise filter
        unsub_url = "https://stripe.com/unsubscribe"
        self.assertTrue(is_noise_link(unsub_url, "Unsubscribe from emails"))

        # Check job URL picker
        picked = pick_application_link(link_items, company="Stripe", role="Backend Engineer")
        self.assertIn("jobs.stripe.com/status/12345", picked)
        norm_picked = normalize_url_key(picked)
        self.assertNotIn("utm_source", norm_picked)
        self.assertEqual(norm_picked, "jobs.stripe.com/status/12345")

    def test_clean_url_and_normalizer_keys(self) -> None:
        raw_url = "https://www.linkedin.com/jobs/view/987654/?utm_campaign=digest&ref=email#section"
        self.assertEqual(clean_http_url(raw_url), raw_url)
        norm_key = normalize_url_key(raw_url)
        self.assertEqual(norm_key, "linkedin.com/jobs/view/987654")

        # Invalid schemes blocked
        self.assertEqual(clean_http_url("javascript:alert(1)"), "")
        self.assertEqual(clean_http_url("data:text/html,..."), "")

    def test_backup_merge_mode_deduplicates(self) -> None:
        db = DatabaseManager(":memory:")
        db.init_schema()
        try:
            with db.session_scope() as session:
                app_repo = ApplicationRepository(session)
                app1 = app_repo.create(
                    {
                        "company": "Linear",
                        "role_title": "Product Engineer",
                        "status": "applied",
                        "job_url": "https://linear.app/careers/1",
                    }
                )
                backup_data = {
                    "version": 1,
                    "exported_at": "2026-03-10T12:00:00Z",
                    "applications": [
                        {
                            "company": "Linear",
                            "role_title": "Product Engineer",
                            "status": "interviewing",
                            "job_url": "https://linear.app/careers/1?utm_medium=email",
                            "notes": "First round scheduled",
                        },
                        {
                            "company": "Notion",
                            "role_title": "Frontend Lead",
                            "status": "applied",
                            "job_url": "https://notion.so/careers/2",
                        },
                    ],
                    "interviews": [],
                    "job_alerts": [],
                }
                res = BackupRestoreService(session).import_json(backup_data, mode="merge")
                # 1 new added (Notion), 1 skipped duplicate (Linear)
                self.assertEqual(res["added"]["applications"], 1)
                self.assertEqual(res["skipped"]["applications"], 1)

                all_apps = app_repo.list_filtered()
                self.assertEqual(len(all_apps), 2)
        finally:
            db.engine.dispose()


if __name__ == "__main__":
    unittest.main()
