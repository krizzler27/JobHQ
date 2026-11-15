# Background Worker System (`backend/workers/`)

This document outlines the architecture, execution model, lifecycle, and development workflow for background jobs and cron workers in Job Tracker.

---

## 1. Architecture Overview (Setup B: Multi-Process Isolation)

Job Tracker uses a **multi-process supervisor architecture** orchestrated by `server.ts`. The Web API and Background Worker Daemon run as completely distinct OS processes:

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
1. **Zero GIL Contention**: Heavy parsing, regex matching, or GGUF tokenization in the background worker never blocks FastAPI event loop requests or API latency.
2. **Crash Resilience**: If a background worker hits a fatal memory leak or segfault, the Web API continues running without interruption.
3. **Independent Lifecycles**: Workers can be restarted, profiled, or run standalone in CLI mode (`python -m backend.workers`) without bringing down the web server.
4. **Lean Memory Footprint**: The worker daemon consumes ~25-30 MB RAM and 0.0% idle CPU, sleeping on an OS event wait.
5. **Database Concurrency**: With SQLite WAL mode (`PRAGMA journal_mode=WAL`) and a 15-second busy timeout (`PRAGMA busy_timeout=15000`), the Web API and worker processes execute concurrent reads and non-blocking writes seamlessly.

---

## 2. Directory Layout

The worker system cleanly separates generic scheduling infrastructure from concrete domain jobs:

```text
backend/workers/
├── __init__.py           # Empty package marker (0 bytes)
├── __main__.py           # Process entrypoint (`python -m backend.workers`)
├── core/
│   ├── __init__.py       # Empty package marker (0 bytes)
│   ├── base.py           # BaseWorker abstract base class
│   └── runner.py         # WorkerRunner daemon engine & scheduler
└── email_job_sync.py     # EmailJobSyncWorker (IMAP fetch & pipeline sync)
```

> **Design Rule**: `__init__.py` files are kept strictly empty (0 bytes). Modules import directly from explicit paths (e.g. `from backend.workers.core.base import BaseWorker`), avoiding re-export bloat and circular dependencies.

---

## 3. Worker Core Engine

### 3.1 `BaseWorker` (`backend/workers/core/base.py`)
All background tasks inherit from `BaseWorker`:

```python
from abc import ABC, abstractmethod
from typing import Any, Optional

class BaseWorker(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for this worker (e.g. 'email_job_sync')."""
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        """Check whether this worker is enabled (e.g. profile flag in DB)."""
        pass

    @abstractmethod
    def get_cron(self) -> Optional[str]:
        """Return 5-field cron expression or None for interval/manual."""
        pass

    @abstractmethod
    def execute(self, *args: Any, **kwargs: Any) -> None:
        """Primary work payload executed when scheduled."""
        pass
```

- **Domain Decoupled**: `BaseWorker` is 100% generic. It accepts `*args, **kwargs` so concrete workers can receive custom parameters or manage their own dependencies.
- **Dependency Injection**: Concrete workers receive necessary repositories or database managers in their `__init__()` constructors.

### 3.2 `WorkerRunner` (`backend/workers/core/runner.py`)
The `WorkerRunner` manages the execution loop and scheduling:

- **Tick Loop**: Wakes every 15 seconds (`poll_interval=15.0`) using an internal `threading.Event`, allowing instant, clean shutdown when `stop()` is called.
- **Minute Deduplication**: Keeps track of `_last_dispatched_minute` (`YYYY-MM-DD HH:MM`) so cron jobs fire exactly once per matching minute regardless of poll frequency.
- **Cron Scheduling**: Uses `backend.core.cron.cron_matches()` to evaluate standard 5-field cron expressions against the current UTC/local time.
- **Thread Isolation**: Each due worker is dispatched into its own daemon thread (`WorkerThread-<name>`). A slow worker never blocks the scheduler loop or delays other workers.
- **Bulletproof Exception Containment**:
  - If `worker.is_enabled()` throws, the exception is caught, logged, and other workers proceed.
  - If `worker.get_cron()` throws, the exception is caught, logged, and other workers proceed.
  - If `worker.execute()` throws, the worker thread catches the exception, updates failure metrics, logs the traceback, and terminates cleanly without affecting any other worker or the daemon.
- **Clean Logging**: Follows standard conventions:
  - `[Worker:runner] Registered worker: email_job_sync`
  - `[Worker:runner] Started background worker daemon loop (1 registered)`
  - `[Worker:email_job_sync] Scheduled run started (cron='0 */4 * * *')`
  - `[Worker:email_job_sync] Run completed in 2.34s`
  - `[Worker:email_job_sync] Run failed in 1.12s: Connection timed out`
- **Telemetry & Metrics**: `runner.get_worker_metrics(name)` tracks:
  - `last_run`: Timestamp of the latest execution
  - `last_duration_seconds`: Wall-clock duration of the latest run
  - `last_status`: `"success"`, `"failed"`, or `"never_run"`
  - `last_error`: Formatted error message if failed
  - `next_run`: Calculated next execution timestamp via `backend.core.cron.next_cron_run()`

---

## 4. Concrete Workers

### `EmailJobSyncWorker` (`backend/workers/email_job_sync.py`)
Synchronizes the job application pipeline from incoming emails:

1. **Responsibilities**:
   - Queries `profile_settings.auto_sync_enabled` to determine `is_enabled()`.
   - Reads `profile_settings.auto_sync_cron` (default: `0 */4 * * *`) via `get_cron()`.
   - Injects `DatabaseManager` and `SyncJobManager`.
   - Calls `sync_jobs.start_sync(days=profile.auto_sync_days)` to trigger the two-stage IMAP sync pipeline.
2. **Concurrency Safe**: If a sync job is already running (e.g. triggered manually by the user from the web UI), `SyncJobManager.start_sync()` safely skips or manages concurrency without crashing.

---

## 5. How to Add a New Background Worker

Follow these steps to create and register a new worker:

### Step 1: Create the Worker Module
Create your worker in `backend/workers/<worker_name>.py`. Inherit from `BaseWorker`:

```python
# backend/workers/alert_rescore.py
from typing import Any, Optional
import logging
from backend.workers.core.base import BaseWorker
from backend.core.database import DatabaseManager

logger = logging.getLogger(__name__)

class AlertRescoreWorker(BaseWorker):
    def __init__(self, db: Optional[DatabaseManager] = None) -> None:
        self.db = db or DatabaseManager()

    @property
    def name(self) -> str:
        return "alert_rescore"

    def is_enabled(self) -> bool:
        # Check database or config to see if this worker should run
        with self.db.session() as session:
            # Example: check profile setting or return True
            return True

    def get_cron(self) -> Optional[str]:
        # Run daily at 02:00 AM
        return "0 2 * * *"

    def execute(self, *args: Any, **kwargs: Any) -> None:
        logger.info("[Worker:alert_rescore] Re-scoring suggested job alerts...")
        # Domain logic here:
        # e.g., re-evaluate alerts against updated target titles and keywords
```

### Step 2: Register in `backend/workers/__main__.py`
Instantiate and register your worker with the runner in `backend/workers/__main__.py`:

```python
# In backend/workers/__main__.py:
from backend.workers.alert_rescore import AlertRescoreWorker

def main() -> None:
    runner = WorkerRunner(poll_interval=15.0)
    
    # Existing workers
    runner.register(EmailJobSyncWorker(db=db, sync_jobs=sync_jobs))
    
    # Register your new worker
    runner.register(AlertRescoreWorker(db=db))
    
    # Run loop
    runner.run_forever()
```

### Step 3: Add Unit Tests
Add a test in `backend/tests/test_workers.py`:

```python
def test_alert_rescore_worker_execution(self):
    mock_db = MagicMock()
    worker = AlertRescoreWorker(db=mock_db)
    self.assertEqual(worker.name, "alert_rescore")
    self.assertTrue(worker.is_enabled())
    self.assertEqual(worker.get_cron(), "0 2 * * *")
    
    worker.execute()
    # Verify expectations...
```

---

## 6. Process Supervision in `server.ts`

`server.ts` acts as the master process supervisor:

1. **Startup Sequence**:
   - Spawns `python -m backend` on port 3001.
   - Waits for `http://127.0.0.1:3001/api/health` to return 200 OK.
   - Spawns `python -m backend.workers` as an unbuffered detached child process (`stdio: ['ignore', 'inherit', 'inherit']`, `PYTHONUNBUFFERED=1`).
   - Starts Express on port 3000.
2. **Auto-Restart on Crash**:
   - If the worker process exits unexpectedly with non-zero exit code, `server.ts` catches the `exit` event, logs the error, and restarts the worker process after a brief backoff (up to 5 attempts).
3. **Clean Shutdown**:
   - On `SIGINT`, `SIGTERM`, or `SIGBREAK`, `stopPythonProcesses()` terminates both the Web API process and the Worker Daemon process using `taskkill /t /f` on Windows or `SIGTERM` on Unix.

---

## 7. Manual Testing & CLI Execution

You can run and test the worker daemon directly from the command line:

```bash
# Run standalone worker daemon
.venv/bin/python -m backend.workers
# Windows:
.venv\Scripts\python.exe -m backend.workers
```

To run all worker test suites:
```bash
.venv/bin/python -m unittest backend/tests/test_workers.py -v
# Windows:
.venv\Scripts\python.exe -m unittest backend/tests/test_workers.py -v
```
