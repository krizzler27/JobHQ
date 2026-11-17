"""24/7 background worker runner engine with database-persisted interval scheduling."""

import logging
import signal
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from types import FrameType
from typing import Any, Optional

from backend.core.cron import matches_cron, next_cron_run
from backend.core.database import DatabaseManager
from backend.repositories.worker_state import WorkerStateRepository
from backend.workers.core.base import BaseWorker

logger = logging.getLogger("job_tracker.workers.runner")


@dataclass
class WorkerRuntimeMeta:
    last_run_at: str | None = None
    last_status: str = "never_run"  # "never_run", "success", "error", "running"
    last_duration_s: float = 0.0
    last_error: str | None = None
    last_cron: str = ""
    last_skip_reason: str | None = None


class WorkerRunner:
    """Desktop-first background worker scheduler that triggers workers based on elapsed intervals or cron schedules."""

    def __init__(
        self,
        workers: list[BaseWorker],
        db: Optional[DatabaseManager] = None,
        tick_interval_seconds: float = 15.0,
        heartbeat_interval_ticks: int = 40,  # ~10 minutes at 15s ticks
        *args: Any,
        **kwargs: Any,
    ) -> None:
        self.workers = workers
        self.db = db
        self._tick_interval = tick_interval_seconds
        self._heartbeat_interval = heartbeat_interval_ticks
        self._tick_count = 0
        self._extra_args = args
        self._extra_kwargs = kwargs
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_triggered_minutes: dict[str, str] = {}
        self._meta: dict[str, WorkerRuntimeMeta] = {w.name: WorkerRuntimeMeta() for w in workers}

    @property
    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive() and not self._stop_event.is_set())

    def get_meta(self, worker_name: str) -> WorkerRuntimeMeta | None:
        return self._meta.get(worker_name)

    def run_tick(self, now_dt: datetime | None = None) -> list[str]:
        """Runs a single scheduler tick.

        Evaluates registered workers using database elapsed intervals and cron matching with complete exception isolation.
        """
        ref_now = now_dt or datetime.now(timezone.utc)
        if ref_now.tzinfo is None:
            ref_now = ref_now.replace(tzinfo=timezone.utc)

        minute_key = ref_now.strftime("%Y-%m-%d %H:%M")
        triggered: list[str] = []

        for worker in self.workers:
            name = worker.name
            meta = self._meta.setdefault(name, WorkerRuntimeMeta())

            # 1. Check if enabled (fully isolated)
            try:
                enabled = worker.is_enabled(*self._extra_args, **self._extra_kwargs)
            except Exception as exc:
                logger.error("[Worker:%s] Error checking is_enabled: %s", name, exc, exc_info=True)
                continue

            if not enabled:
                if meta.last_skip_reason != "disabled":
                    meta.last_skip_reason = "disabled"
                    logger.info("[Worker:%s] Skipped: disabled in settings.", name)
                continue
            else:
                meta.last_skip_reason = None

            # 2. Check if due via persisted interval state in database
            cron_expr = ""
            cron_error = False
            try:
                cron_expr = str(worker.get_cron(*self._extra_args, **self._extra_kwargs) or "").strip()
            except Exception as exc:
                logger.error("[Worker:%s] Error getting cron expression: %s", name, exc, exc_info=True)
                cron_error = True

            meta.last_cron = cron_expr
            is_due = False

            if cron_error:
                continue

            if self.db:
                try:
                    with self.db.session_scope() as session:
                        repo = WorkerStateRepository(session)
                        is_due = repo.is_due(
                            name=name,
                            default_interval_minutes=worker.default_interval_minutes,
                            default_enabled=True,
                            now_dt=ref_now,
                        )
                except Exception as exc:
                    logger.error("[Worker:%s] Error checking worker state: %s", name, exc, exc_info=True)
                    is_due = False
            else:
                # Fallback in-memory evaluation (for tests without a db)
                if cron_expr:
                    try:
                        is_due = matches_cron(cron_expr, ref_now)
                    except Exception as exc:
                        logger.error("[Worker:%s] Invalid cron expression '%s': %s", name, cron_expr, exc)
                        is_due = False
                else:
                    is_due = (meta.last_run_at is None)

            if not is_due:
                continue

            # 3. Deduplicate: do not execute multiple times in the same wall-clock minute
            if self._last_triggered_minutes.get(name) == minute_key:
                continue

            self._last_triggered_minutes[name] = minute_key
            triggered.append(name)
            logger.info("[Worker:%s] Triggered (interval=%dm, cron='%s')", name, worker.default_interval_minutes, cron_expr)
            self._dispatch(worker, cron_expr, now_dt=ref_now)

        return triggered

    def _dispatch(self, worker: BaseWorker, cron_expr: str, now_dt: datetime | None = None) -> None:
        """Executes worker in an isolated thread so the scheduler loop is never blocked."""
        t = threading.Thread(
            target=self._execute_safely,
            args=(worker, cron_expr, now_dt),
            name=f"worker-exec-{worker.name}",
            daemon=True,
        )
        t.start()

    def _execute_safely(self, worker: BaseWorker, cron_expr: str, now_dt: datetime | None = None) -> None:
        name = worker.name
        meta = self._meta.setdefault(name, WorkerRuntimeMeta())
        meta.last_status = "running"

        ref_now = now_dt or datetime.now(timezone.utc)
        if ref_now.tzinfo is None:
            ref_now = ref_now.replace(tzinfo=timezone.utc)
        meta.last_run_at = ref_now.strftime("%Y-%m-%d %H:%M:%SZ")

        start_time = time.perf_counter()
        try:
            worker.execute(*self._extra_args, **self._extra_kwargs)
            duration = round(time.perf_counter() - start_time, 2)

            # Persist success in worker_states table
            if self.db:
                try:
                    with self.db.session_scope() as session:
                        WorkerStateRepository(session).record_success(name, duration, now_dt=ref_now)
                except Exception as db_exc:
                    logger.warning("[Worker:%s] Failed to record state in DB: %s", name, db_exc)

            meta.last_duration_s = duration
            meta.last_status = "success"
            meta.last_error = None

            logger.info("[Worker:%s] Completed in %.2fs", name, duration)
        except Exception as exc:
            duration = round(time.perf_counter() - start_time, 2)

            # Persist failure in worker_states table
            if self.db:
                try:
                    with self.db.session_scope() as session:
                        WorkerStateRepository(session).record_failure(name, duration, str(exc), now_dt=ref_now)
                except Exception as db_exc:
                    logger.warning("[Worker:%s] Failed to record state in DB: %s", name, db_exc)

            meta.last_duration_s = duration
            meta.last_status = "error"
            meta.last_error = str(exc)

            logger.error("[Worker:%s] Failed after %.2fs: %s", name, duration, exc, exc_info=True)

    def _log_heartbeat(self) -> None:
        """Logs periodic status summary of all workers."""
        for worker in self.workers:
            name = worker.name
            meta = self._meta.get(name) or WorkerRuntimeMeta()
            last_run_str = (
                f"{meta.last_run_at} [{meta.last_status}, {meta.last_duration_s}s]"
                if meta.last_run_at
                else "never"
            )
            logger.info(
                "[Worker:runner] Status '%s': last run: %s, interval: %dm",
                name,
                last_run_str,
                worker.default_interval_minutes,
            )

    def start(self) -> None:
        """Starts the runner in a background daemon thread."""
        if self.is_running:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop, name="job-tracker-worker-daemon", daemon=True
        )
        self._thread.start()
        worker_names = ", ".join(w.name for w in self.workers) or "none"
        logger.info(
            "[Worker:runner] Started with %d worker(s): %s",
            len(self.workers),
            worker_names,
        )

    def stop(self, timeout: float = 3.0) -> None:
        """Stops the background runner thread."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=timeout)
        logger.info("[Worker:runner] Stopped.")

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.run_tick()
                self._tick_count += 1
                if self._tick_count % self._heartbeat_interval == 0:
                    self._log_heartbeat()
            except Exception as exc:
                logger.warning("[Worker:runner] Unexpected loop error: %s", exc)
            self._stop_event.wait(self._tick_interval)

    def run_forever(self) -> None:
        """Blocks and runs the runner in the main process with signal handling."""
        worker_names = ", ".join(w.name for w in self.workers) or "none"
        logger.info(
            "[Worker:runner] Started standalone process with %d worker(s): %s",
            len(self.workers),
            worker_names,
        )

        def handle_shutdown(signum: int, _frame: FrameType | None) -> None:
            logger.info("[Worker:runner] Received shutdown signal (%s). Exiting...", signum)
            self.stop()
            sys.exit(0)

        signal.signal(signal.SIGINT, handle_shutdown)
        signal.signal(signal.SIGTERM, handle_shutdown)

        self.start()
        try:
            while not self._stop_event.is_set():
                time.sleep(1.0)
        except (KeyboardInterrupt, SystemExit):
            self.stop()
            logger.info("[Worker:runner] Terminated.")
