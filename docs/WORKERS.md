# Background Worker System (`backend/workers/`)

This document outlines the architecture, execution model, lifecycle, and developer workflow for background jobs and cron workers in Job Tracker.

---

## 1. Architecture Overview (Setup B: Multi-Process Isolation)

Job Tracker uses a **multi-process supervisor architecture** orchestrated by [server.ts](file:///C:/Disk-S/Projects/Job-Tracker/server.ts). The Web API and Background Worker Daemon run as completely distinct OS processes:

```text
                     +---------------------------------------+
                     |         Node / Express Host           |
                     |             (server.ts)               |
                     +-------------------+-------------------+
                                         |
                       spawns & supervises child processes
                                         |
             +---------------------------+---------------------------+
             |                                                       |
             v                                                       v
+------------------------------------+  +------------------------------------+
|         Python Web API             |  |      Python Worker Daemon          |
|      (`python -m backend`)         |  |   (`python -m backend.workers`)    |
| - FastAPI + Uvicorn (Port 3001)    |  | - Standalone Background Process    |
| - Pure request/response serving    |  | - WorkerRunner tick loop (15s)     |
| - 0 background cron tasks          |  | - EmailJobSyncWorker + future jobs |
| - High availability & low latency  |  | - Isolated per-worker threads      |
+-----------------+------------------+  +------------------+-----------------+
                  |                                        |
                  +--------------------+-------------------+
                                       |
                   Concurrent SQLite Access (WAL Mode)
                                       v
                     +-----------------------------------+
                     |        SQLite Database            |
                     |      data/job_tracker.db          |
                     |  - PRAGMA journal_mode=WAL        |
                     |  - PRAGMA busy_timeout=15000      |
                     +-----------------------------------+
```

### Why Multi-Process Isolation?
- **Zero GIL Contention**: Heavy parsing, regex matching, or GGUF tokenization in background jobs never blocks FastAPI event loop requests or API latency.
- **Crash Resilience**: If a background worker hits an unhandled exception or memory issue, the Web API continues serving traffic without interruption.
- **Independent Lifecycles**: The worker daemon can be restarted, profiled, or run standalone via CLI (`python -m backend.workers`) without cycling the web server.
- **Minimal Idle Overhead**: The worker process consumes ~25-30 MB RAM and 0.0% idle CPU while waiting on its tick event.
- **Database Concurrency**: With SQLite WAL mode (`PRAGMA journal_mode=WAL`) and a 15-second busy timeout (`PRAGMA busy_timeout=15000`), the Web API and worker processes execute concurrent reads and non-blocking writes seamlessly.

---

## 2. Directory Layout

Scheduling infrastructure is strictly separated from concrete domain jobs:

- [backend/workers/core/base.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/core/base.py) — Abstract `BaseWorker` contract.
- [backend/workers/core/runner.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/core/runner.py) — Generic `WorkerRunner` scheduler and thread dispatcher.
- [backend/workers/email_job_sync.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/email_job_sync.py) — Concrete worker synchronizing job pipeline updates from IMAP email.
- [backend/workers/__main__.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/__main__.py) — Daemon process entrypoint (`python -m backend.workers`).
- `backend/workers/__init__.py` and `backend/workers/core/__init__.py` — Empty package markers (0 bytes). Modules use explicit imports to avoid re-export bloat and circular dependencies.

---

## 3. Worker Core Engine

### 3.1 `BaseWorker` Contract ([core/base.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/core/base.py))
All background tasks subclass `BaseWorker`, which defines four abstract members:
- `name` (`str`): Unique identifier for logging and metrics (e.g. `'email_job_sync'`).
- `is_enabled(*args, **kwargs) -> bool`: Dynamically evaluated each tick (e.g. checking a database profile toggle).
- `get_cron(*args, **kwargs) -> Optional[str]`: Returns a standard 5-field cron expression (e.g. `'0 */4 * * *'`).
- `execute(*args, **kwargs) -> None`: The primary workload to run.

`BaseWorker` is 100% domain-agnostic. Workers receive dependencies (such as `DatabaseManager` or specific services) via standard constructor injection.

### 3.2 `WorkerRunner` ([core/runner.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/core/runner.py))
The daemon orchestrator:
- **Tick Loop**: Evaluates registered workers every 15 seconds (`poll_interval=15.0`) using a `threading.Event` wait for immediate, clean termination on `stop()`.
- **Minute Deduplication**: Tracks `_last_dispatched_minute` (`YYYY-MM-DD HH:MM`) so cron jobs fire exactly once per matching minute regardless of tick frequency.
- **Thread Isolation**: Each due job runs in an independent daemon thread (`WorkerThread-<name>`). Slow tasks never block the scheduler tick or delay sibling workers.
- **Exception Containment**: Exceptions in `is_enabled`, `get_cron`, or `execute` are caught and logged per-worker. A failure in one worker cannot crash the daemon or affect other tasks.
- **Logging Standards**:
  - `[Worker:runner] Registered worker: <name>`
  - `[Worker:<name>] Triggered (cron='<expr>')`
  - `[Worker:<name>] Completed in X.XXs (next run: YYYY-MM-DD HH:MM)`
  - `[Worker:<name>] Failed after X.XXs: <error>`
  - `[Worker:<name>] Skipped: <reason>`
- **Runtime Metrics**: `runner.get_worker_metrics(name)` exposes `last_run`, `last_duration_seconds`, `last_status` (`"success" | "failed" | "never_run"`), `last_error`, and `next_run`.

---

## 4. Concrete Workers

### `EmailJobSyncWorker` ([email_job_sync.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/email_job_sync.py))
The default background worker:
- Injects `DatabaseManager` and `SyncJobManager`.
- Checks `profile_settings.auto_sync_enabled` and `profile_settings.auto_sync_cron` (default: `0 */4 * * *`).
- Executes `sync_jobs.start_sync(days=profile.auto_sync_days)`.
- If an IMAP sync is already running (e.g. triggered manually from the UI), it safely skips execution without conflicting.

---

## 5. Adding a New Background Worker

To add a new background task, refer to [email_job_sync.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/email_job_sync.py) as a working template:

1. **Subclass `BaseWorker`** in `backend/workers/<name>.py`:
   - Implement `name`, `is_enabled()`, `get_cron()`, and `execute()`.
   - Accept dependencies via `__init__(self, db: DatabaseManager, ...)`.
2. **Register with the Runner** in [backend/workers/__main__.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/__main__.py):
   ```python
   runner.register(YourNewWorker(db=db))
   ```
3. **Add Tests** in [backend/tests/test_workers.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/tests/test_workers.py) verifying evaluation, execution, and exception containment.

---

## 6. Process Supervision & CLI

- **Supervisor**: [server.ts](file:///C:/Disk-S/Projects/Job-Tracker/server.ts) launches `python -m backend.workers` once the Web API passes its health check, monitors the child process, and restarts it if it exits unexpectedly.
- **Standalone CLI execution**:
  ```bash
  .venv/bin/python -m backend.workers
  # Windows:
  .venv\Scripts\python.exe -m backend.workers
  ```
- **Automated Tests**:
  ```bash
  .venv/bin/python -m unittest backend/tests/test_workers.py -v
  ```
