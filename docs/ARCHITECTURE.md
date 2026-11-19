# System Architecture

**JobHQ** is a **local-first personal job application tracker and career command center**. It operates under a decoupled multi-process execution topology available both as a web application (Node/Express + Vite + React 19) and as a standalone native desktop application packaged via Tauri v2 with a custom frameless Studio window shell.

---

## 1. Runtime & Process Topology

### Web Application Mode (`npm run dev` / `npm start`)

```text
+-------------------------------------------------------------------------------+
| Browser (React 19 + Vite + Tailwind CSS v4)                                   |
| http://localhost:3000                                                         |
+---------------------------------------+---------------------------------------+
                                        | HTTP /api/* & static assets
                                        v
+-------------------------------------------------------------------------------+
| Node / Express Host (server.ts): 127.0.0.1:3000                               |
| - Spawns & supervises two independent Python child processes                  |
| - Dev: mounts Vite middleware (appType: 'spa')                                |
| - Prod: serves built ./dist static files                                      |
| - Proxies all /api/* requests -> http://127.0.0.1:3001                        |
+--------------------+------------------------------------+---------------------+
                     |                                    |
         Spawns & supervises                  Spawns & supervises
                     |                                    |
                     v                                    v
+------------------------------------+  +------------------------------------+
|  Python Web API (`-m backend`)     |  | Python Worker Daemon (`-m workers`)|
|  FastAPI + Uvicorn (Port 3001)     |  | Standalone Background Daemon       |
|  - REST endpoints & OpenAPI docs   |  | - WorkerRunner tick loop (15s)     |
|  - SyncJobManager manual sync runs |  | - 7 automated maintenance workers  |
|  - Zero background cron execution  |  | - Isolated per-worker threads      |
+-----------------+------------------+  +------------------+-----------------+
                  |                                        |
                  +--------------------+-------------------+
                                       |
                   Concurrent SQLite Access (WAL Mode)
                                       v
                     +-----------------------------------+
                     |        SQLite Database            |
                     |      ~/.jobhq/jobhq.db            |
                     |  - PRAGMA journal_mode=WAL        |
                     |  - PRAGMA busy_timeout=15000      |
                     +-----------------+-----------------+
                                       |
                       +---------------+---------------+
                       |                               |
                       v                               v
             +-------------------+           +-------------------+
             |    IMAP Server    |           | Local GGUF Models |
             |   (SSL/TLS :993)  |           | ~/.jobhq/models/  |
             +-------------------+           +-------------------+
```

### Native Desktop Mode (`npm run tauri:dev` / Packaged App)

For detailed packaging architecture and sidecar process lifecycles, see [Desktop Architecture](DESKTOP_ARCHITECTURE.md).

```text
+-------------------------------------------------------------------------------+
| Tauri v2 Desktop Host (Rust / Wry WebView)                                    |
| - Frameless Studio window with native OS titlebar controls                    |
| - Auto-spawns Python Backend Sidecar binary (jobhq-backend.exe)               |
| - Native OS notification bridge & graceful process termination on window close|
+---------------------------------------+---------------------------------------+
                                        | Direct HTTP /api/* requests
                                        v
+-------------------------------------------------------------------------------+
| Standalone Python Sidecar (`backend/desktop.py` / PyInstaller binary)        |
| - Thread 1: FastAPI Web API server on 127.0.0.1:3001                          |
| - Thread 2: WorkerRunner daemon evaluating background tasks every 15s         |
| - Concurrent WAL-mode SQLite access to ~/.jobhq/jobhq.db                      |
+-----------------------------------------------+-------------------------------+
```

---

## 2. Centralized Configuration & Storage (`~/.jobhq`)

JobHQ manages all file storage, database persistence, secrets, and model weights in a clean, user-scoped home directory `~/.jobhq` managed via Pydantic Settings ([backend/core/config.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/core/config.py)):

| Resource | Default Location | Environment Override |
| :--- | :--- | :--- |
| **Home Directory** | `~/.jobhq` | `JOBHQ_HOME_DIR` |
| **SQLite Database** | `~/.jobhq/jobhq.db` | `JOBHQ_DB_PATH` or `DB_PATH` |
| **Secret Cipher Key** | `~/.jobhq/.secret.key` | `JOBHQ_SECRET_KEY_PATH` or `SECRET_KEY_PATH` |
| **Database Backups** | `~/.jobhq/backups/` | `JOBHQ_BACKUPS_DIR` or `BACKUPS_DIR` |
| **Local AI Models** | `~/.jobhq/models/` | `JOBHQ_MODELS_DIR` or `MODELS_DIR` |
| **FastAPI Port** | `3001` | `JOBHQ_PORT` or `PY_BACKEND_PORT` |
| **Master Fernet Key** | Generated automatically in key file | `JOBHQ_ENCRYPTION_KEY` or `JOB_TRACKER_KEY` |

---

## 3. Backend Architecture: 3-Tier Execution Model

The backend strictly separates triggers, business policies, and database queries:

```text
Worker (When to run) ──► Service (What business rules to run) ──► Repository (Pure DB queries)
```

1. **Workers (`backend/workers/`)**:
   - Act strictly as scheduled triggers subclassing `BaseWorker`.
   - Lightweight, zero direct SQL queries, and zero business math.
   - For worker contracts, intervals, and architecture, see [Background Worker System](WORKERS.md).
2. **Services (`backend/services/`)**:
   - Own all business rules and domain logic (`JobHQLifecycleService`, `SyncJobManager`, `DashboardQueryService`, `StatsQueryService`, `BackupRestoreService`, `EmailFilterContextService`).
   - Single source of truth for business calculations and entity lifecycles.
   - Coordinate across repositories and manage transaction scopes (`db.session_scope()`).
3. **Repositories (`backend/repositories/`)**:
   - Pure data access layer (SQLAlchemy ORM queries).
   - Contain zero business policy or lifecycle decisions.
   - Exclusively perform CRUD, filtering, pagination, and bulk database operations (`applications`, `interviews`, `alerts`, `profile`, `imap_config`, `processed_emails`, `worker_state`).

---

## 4. Subsystems & Pipelines

### 4.1 Two-Stage IMAP Sync Pipeline
1. **Batched IMAP Search**: Builds small OR-trees (`chunk_size=6`) with provider-safe `SINCE "<DD-Mon-YYYY>"` constraints.
2. **Header Pre-Filter (Stage 1)**: Inspects lightweight headers (`Subject`, `From`, `Date`, `Message-ID`). Messages already in `processed_emails` or matching `scan_exclude_keywords` are filtered out before downloading full message bodies.
3. **Full Fetch & Hybrid Parse (Stage 2)**: Downloads RFC822 MIME bodies with cooperative cancellation checkpoints.
   - HTML stripping, tracking URL cleanup, and regex extraction.
   - Deterministic rule classification into applications, interview invites, and job digest alerts.
   - When enabled and ambiguous (`needs_ai_refinement == True`), invokes offline local GGUF model via `llama-cpp-python`, unloading from RAM immediately upon sync completion.

### 4.2 Pipeline Stages & Rejection Learnings
Applications track full lifecycle stages: `applied`, `interviewing`, `offer`, `rejected`, and `ghosted`.
- `rejected` captures structured outcome tags (`rejection_reason`) and freeform retrospective notes (`rejection_notes`).
- Inactive `applied` applications automatically transition to `ghosted` via `auto_ghost` worker. See [WORKERS.md § 4](WORKERS.md#4-concrete-workers).

### 4.3 Duplicate Guard
Before creating an application or promoting an alert, duplicate detection checks:
- Normalized URL comparison (stripping query parameters, protocols, trailing slashes).
- Normalized Company & Role matching (stripping corporate entity suffixes like `Inc`, `LLC`, `Ltd`).

### 4.4 Security, Privacy & API Specification
- **Loopback Only**: FastAPI and Express bind exclusively to `127.0.0.1`.
- **Encryption at Rest**: IMAP passwords encrypted with AES-128 Fernet keys stored in `~/.jobhq/.secret.key`.
- **Zero Cloud Telemetry**: 100% offline, local-first data ownership.
- **Interactive OpenAPI**: Interactive Swagger UI is hosted at `http://127.0.0.1:3001/docs`, ReDoc at `http://127.0.0.1:3001/redoc`, and the OpenAPI JSON specification at `http://127.0.0.1:3001/openapi.json`.
