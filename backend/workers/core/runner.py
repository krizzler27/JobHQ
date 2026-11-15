"""24/7 background worker runner engine and scheduler loop."""

import logging
import signal
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from types import FrameType
from typing import Any

from backend.core.cron import matches_cron, next_cron_run
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
    """Continuous 24/7 background worker scheduler that triggers registered workers according to their cron schedules."""

    def __init__(
        self,
        workers: list[BaseWorker],
        tick_interval_seconds: float = 15.0,
        heartbeat_interval_ticks: int = 40,  # ~10 minutes at 15s ticks
        *args: Any,
        **kwargs: Any,
    ) -> None:
        self.workers = workers
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

        Evaluates registered workers with complete exception containment so one misconfigured worker never breaks the runner.
        """
        dt = now_dt or datetime.now().astimezone()
        minute_key = dt.strftime("%Y-%m-%d %H:%M")
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

            # 2. Get cron expression (fully isolated)
            try:
                cron_expr = worker.get_cron(*self._extra_args, **self._extra_kwargs)
            except Exception as exc:
                logger.error("[Worker:%s] Error getting cron expression: %s", name, exc, exc_info=True)
                continue

            meta.last_cron = cron_expr
            if not cron_expr:
                continue

            # 3. Check if cron matches current time (fully isolated)
            try:
                is_match = matches_cron(cron_expr, dt)
            except Exception as exc:
                logger.error("[Worker:%s] Invalid cron expression '%s': %s", name, cron_expr, exc)
                continue

            if not is_match:
                continue

            # 4. Deduplicate: do not execute multiple times in the same wall-clock minute
            if self._last_triggered_minutes.get(name) == minute_key:
                continue

            self._last_triggered_minutes[name] = minute_key
            triggered.append(name)
            logger.info("[Worker:%s] Triggered (cron='%s')", name, cron_expr)
            self._dispatch(worker, cron_expr)

        return triggered

    def _dispatch(self, worker: BaseWorker, cron_expr: str) -> None:
        """Executes worker in an isolated thread so the 24/7 scheduler loop is never blocked."""
        t = threading.Thread(
            target=self._execute_safely,
            args=(worker, cron_expr),
            name=f"worker-exec-{worker.name}",
            daemon=True,
        )
        t.start()

    def _execute_safely(self, worker: BaseWorker, cron_expr: str) -> None:
        name = worker.name
        meta = self._meta.setdefault(name, WorkerRuntimeMeta())
        meta.last_status = "running"
        meta.last_run_at = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")

        start_time = time.perf_counter()
        try:
            worker.execute(*self._extra_args, **self._extra_kwargs)
            duration = time.perf_counter() - start_time
            meta.last_duration_s = round(duration, 2)
            meta.last_status = "success"
            meta.last_error = None

            next_dt = next_cron_run(cron_expr)
            next_str = next_dt.strftime("%Y-%m-%d %H:%M") if next_dt else "unknown"
            logger.info(
                "[Worker:%s] Completed in %.2fs (next run: %s)",
                name,
                duration,
                next_str,
            )
        except Exception as exc:
            duration = time.perf_counter() - start_time
            meta.last_duration_s = round(duration, 2)
            meta.last_status = "error"
            meta.last_error = str(exc)

            next_dt = next_cron_run(cron_expr)
            next_str = next_dt.strftime("%Y-%m-%d %H:%M") if next_dt else "unknown"
            logger.error(
                "[Worker:%s] Failed after %.2fs: %s (next run: %s)",
                name,
                duration,
                exc,
                next_str,
                exc_info=True,
            )

    def _log_heartbeat(self) -> None:
        """Logs periodic status summary of all workers with last-run and next-run details."""
        for worker in self.workers:
            name = worker.name
            meta = self._meta.get(name) or WorkerRuntimeMeta()
            cron_expr = meta.last_cron or "* * * * *"
            next_dt = next_cron_run(cron_expr)
            next_str = next_dt.strftime("%Y-%m-%d %H:%M") if next_dt else "not scheduled"
            last_run_str = (
                f"{meta.last_run_at} [{meta.last_status}, {meta.last_duration_s}s]"
                if meta.last_run_at
                else "never"
            )
            logger.info(
                "[Worker:runner] Status '%s': last run: %s, next run: %s",
                name,
                last_run_str,
                next_str,
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
