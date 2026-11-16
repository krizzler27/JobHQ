"""Unit tests for the generic worker runner and EmailJobSyncWorker."""

import time
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from backend.core.database import DatabaseManager
from backend.repositories.applications import ApplicationRepository
from backend.repositories.imap_config import ImapConfigRepository
from backend.repositories.interviews import InterviewRepository
from backend.repositories.profile import ProfileRepository
from backend.workers.auto_ghost import AutoGhostWorker
from backend.workers.core.base import BaseWorker
from backend.workers.core.runner import WorkerRunner
from backend.workers.email_job_sync import EmailJobSyncWorker
from backend.workers.interview_lifecycle import InterviewLifecycleWorker


class DummyTestWorker(BaseWorker):
    def __init__(
        self,
        name: str = "dummy",
        cron: str = "* * * * *",
        enabled: bool = True,
        fail_in: str = "",  # "enabled", "cron", "execute"
    ) -> None:
        self._name = name
        self._cron = cron
        self._enabled = enabled
        self._fail_in = fail_in
        self.executed_count = 0

    @property
    def name(self) -> str:
        return self._name

    def is_enabled(self, *args, **kwargs) -> bool:
        if self._fail_in == "enabled":
            raise RuntimeError("Failure in is_enabled")
        return self._enabled

    def get_cron(self, *args, **kwargs) -> str:
        if self._fail_in == "cron":
            raise RuntimeError("Failure in get_cron")
        return self._cron

    def execute(self, *args, **kwargs) -> None:
        self.executed_count += 1
        if self._fail_in == "execute":
            raise RuntimeError("Failure in execute")


class WorkerSubsystemTests(unittest.TestCase):
    def test_runner_tick_cron_matching_and_deduplication(self) -> None:
        matching_worker = DummyTestWorker(name="matching", cron="* * * * *", enabled=True)
        never_worker = DummyTestWorker(name="never", cron="0 0 1 1 *", enabled=True)
        disabled_worker = DummyTestWorker(name="disabled", cron="* * * * *", enabled=False)

        workers = [matching_worker, never_worker, disabled_worker]
        runner = WorkerRunner(workers=workers, tick_interval_seconds=1.0)

        # Minute 1
        dt1 = datetime(2026, 11, 15, 12, 30, tzinfo=timezone.utc)
        triggered = runner.run_tick(now_dt=dt1)

        self.assertIn("matching", triggered)
        self.assertNotIn("never", triggered)
        self.assertNotIn("disabled", triggered)

        # Same minute deduplication
        triggered_again = runner.run_tick(now_dt=dt1)
        self.assertEqual(triggered_again, [])

        # Next minute
        dt2 = datetime(2026, 11, 15, 12, 31, tzinfo=timezone.utc)
        triggered_next = runner.run_tick(now_dt=dt2)
        self.assertIn("matching", triggered_next)

    def test_runner_bulletproof_exception_containment(self) -> None:
        # Worker 1 fails in is_enabled
        w_enabled_fail = DummyTestWorker(name="fail_enabled", fail_in="enabled")
        # Worker 2 fails in get_cron
        w_cron_fail = DummyTestWorker(name="fail_cron", fail_in="cron")
        # Worker 3 fails in execute
        w_exec_fail = DummyTestWorker(name="fail_execute", fail_in="execute")
        # Worker 4 is healthy and must succeed despite other workers failing!
        w_healthy = DummyTestWorker(name="healthy", cron="* * * * *", enabled=True)

        runner = WorkerRunner(workers=[w_enabled_fail, w_cron_fail, w_exec_fail, w_healthy])
        dt = datetime(2026, 11, 15, 14, 0, tzinfo=timezone.utc)

        # Tick should NOT crash
        triggered = runner.run_tick(now_dt=dt)

        # Healthy and exec_fail were triggered; broken enabled/cron skipped cleanly
        self.assertIn("healthy", triggered)
        self.assertIn("fail_execute", triggered)
        self.assertNotIn("fail_enabled", triggered)
        self.assertNotIn("fail_cron", triggered)

        time.sleep(0.1)

        # Healthy completed
        healthy_meta = runner.get_meta("healthy")
        self.assertIsNotNone(healthy_meta)
        self.assertEqual(healthy_meta.last_status, "success")

        # Failing execute recorded error without bringing down the runner
        exec_meta = runner.get_meta("fail_execute")
        self.assertIsNotNone(exec_meta)
        self.assertEqual(exec_meta.last_status, "error")
        self.assertIn("Failure in execute", exec_meta.last_error or "")

    def test_email_job_sync_worker_evaluation_and_execution(self) -> None:
        db = DatabaseManager(":memory:")
        db.init_schema()

        mock_sync_jobs = MagicMock()
        mock_sync_jobs.get_status.return_value = {"status": "idle"}

        worker = EmailJobSyncWorker(db=db, sync_jobs=mock_sync_jobs)
        self.assertEqual(worker.name, "email_job_sync")

        # Initially disabled and no credentials
        self.assertFalse(worker.is_enabled())

        # Enable auto-sync in profile and save mock IMAP credentials
        with db.session_scope() as session:
            prof_repo = ProfileRepository(session)
            prof_repo.update({"auto_sync_enabled": True, "auto_sync_days": 14})

            imap_repo = ImapConfigRepository(session)
            imap_repo.save_config({
                "host": "imap.gmail.com",
                "port": 993,
                "email": "test@gmail.com",
                "password": "secret_password",
                "folder": "INBOX",
                "use_ssl": True,
            })

        # Worker is now enabled
        self.assertTrue(worker.is_enabled())
        self.assertEqual(worker.get_cron(), "0 */4 * * *")

        # Execute worker
        worker.execute()

        # Verify start_sync called with days=14
        mock_sync_jobs.start_sync.assert_called_once_with(days=14, force_rescan=False)

        # If sync is already running, worker skips execution
        mock_sync_jobs.reset_mock()
        mock_sync_jobs.get_status.return_value = {"status": "running"}
        worker.execute()
        mock_sync_jobs.start_sync.assert_not_called()

    def test_interview_lifecycle_worker(self) -> None:
        db = DatabaseManager(":memory:")
        db.init_schema()

        # Create past interview and future interview
        with db.session_scope() as session:
            repo = InterviewRepository(session)
            iv_past = repo.create({
                "company": "Past Corp",
                "role_title": "Backend Dev",
                "scheduled_at": "2026-11-10T10:00",
                "duration_minutes": 45,
                "status": "upcoming",
            })
            iv_future = repo.create({
                "company": "Future Corp",
                "role_title": "Lead Architect",
                "scheduled_at": "2026-11-20T14:00",
                "duration_minutes": 60,
                "status": "upcoming",
            })
            past_id = iv_past.id
            future_id = iv_future.id

        worker = InterviewLifecycleWorker(db=db)
        self.assertEqual(worker.name, "interview_lifecycle")
        self.assertTrue(worker.is_enabled())
        self.assertEqual(worker.get_cron(), "0 * * * *")

        # Execute worker
        worker.execute()

        # Verify statuses
        with db.session_scope() as session:
            repo = InterviewRepository(session)
            updated_past = repo.get(past_id)
            updated_future = repo.get(future_id)

            self.assertIsNotNone(updated_past)
            self.assertEqual(updated_past.status, "completed")

            self.assertIsNotNone(updated_future)
            self.assertEqual(updated_future.status, "upcoming")

    def test_auto_ghost_worker(self) -> None:
        db = DatabaseManager(":memory:")
        db.init_schema()

        # Create stale application and fresh application
        with db.session_scope() as session:
            repo = ApplicationRepository(session)
            app_stale = repo.create({
                "company": "Ghost Inc",
                "role_title": "Python Dev",
                "status": "applied",
                "applied_date": "2026-10-01",
                "last_update_date": "2026-10-01",
            })
            app_fresh = repo.create({
                "company": "Active Inc",
                "role_title": "Fullstack Dev",
                "status": "applied",
                "applied_date": "2026-11-15",
                "last_update_date": "2026-11-15",
            })
            stale_id = app_stale.id
            fresh_id = app_fresh.id

        worker = AutoGhostWorker(db=db, days_threshold=10)
        self.assertEqual(worker.name, "auto_ghost")
        self.assertTrue(worker.is_enabled())
        self.assertEqual(worker.get_cron(), "0 0 * * *")

        # Execute worker
        worker.execute()

        # Verify statuses
        with db.session_scope() as session:
            repo = ApplicationRepository(session)
            updated_stale = repo.get(stale_id)
            updated_fresh = repo.get(fresh_id)

            self.assertIsNotNone(updated_stale)
            self.assertEqual(updated_stale.status, "ghosted")

            self.assertIsNotNone(updated_fresh)
            self.assertEqual(updated_fresh.status, "applied")


if __name__ == "__main__":
    unittest.main()
