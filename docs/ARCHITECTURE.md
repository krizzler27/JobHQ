# System Architecture

Job Tracker is a **local-first single-user web application** composed of a Node/Express web host (`127.0.0.1:3000`), a React + TypeScript SPA frontend, and a Python FastAPI backend (`127.0.0.1:3001`) backed by SQLite, standard-library IMAP, and an optional local quantized LLM runtime (`llama-cpp-python`).

---

## 1. Runtime & Process Topology

```text
+-------------------------------------------------------------------+
| Browser (React 19 + Vite + Tailwind CSS v4)                       |
| http://localhost:3000                                             |
+---------------------------------+---------------------------------+
                                  | HTTP /api/* & static assets
                                  v
+-------------------------------------------------------------------+
| Node / Express Host (server.ts) — 127.0.0.1:3000                  |
| - Spawns & supervises Python backend child process                |
| - Dev: mounts Vite middleware (appType: 'spa')                    |
| - Prod: serves built ./dist static files                          |
| - Proxies all /api/* requests -> http://127.0.0.1:3001            |
+---------------------------------+---------------------------------+
                                  | HTTP JSON / Binary (127.0.0.1:3001)
                                  v
+-------------------------------------------------------------------+
| Python FastAPI + Uvicorn (`python -m backend`) — 127.0.0.1:3001  |
|                                                                   |
|  +-----------------------+     +-------------------------------+  |
|  | FastAPI Routes        |     | Background Daemon Threads     |  |
|  | - CRUD & Bulk Ops     |     | - SyncJobManager (IMAP sync)  |  |
|  | - StatsQueryService   |     | - AutoSyncScheduler (Cron)    |  |
|  | - BackupRestoreService|     | - ModelDownloadManager (GGUF) |  |
|  +-----------+-----------+     +---------------+---------------+  |
|              |                                 |                  |
|              +----------------+----------------+                  |
|                               |                                   |
|                               v                                   |
|              +---------------------------------+                  |
|              | Repositories & Services         |                  |
|              | (SQLAlchemy 2.0 ORM)            |                  |
|              +--------+---------------+--------+                  |
|                       |               |                           |
+-----------------------+---------------+---------------------------+
                        |               |
        +---------------+---+       +---+--------------------+
        v                   |       |                        v
+-------------------+       |   +---+---+          +-------------------+
| SQLite Database   |       |   | IMAP  |          | Local GGUF Models |
| data/job_tracker.db       |   | (SSL) |          | ./models/*.gguf   |
| + data/.secret.key|       |   | :993  |          | (llama-cpp-python)|
+-------------------+       |   +-------+          +-------------------+
```

### Lifecycle & Process Management (`server.ts`)
1. On `npm run dev` (or `npm start`), `server.ts` resolves the workspace Python binary (`.venv/bin/python` on Unix, `.venv\Scripts\python.exe` on Windows, or system fallback) and spawns `python -m backend` (`backend/main.py`).
2. Express polls `http://127.0.0.1:3001/api/health` before opening port `3000`.
3. All `/api/*` requests are forwarded verbatim (with body up to `2 MB`) to FastAPI.
4. `SIGINT`, `SIGTERM`, `SIGBREAK`, and Node `exit` hooks terminate the child Python process cleanly (using `taskkill /t /f` on Windows) before closing Vite/HTTP servers.

---

## 2. Backend Architecture (`backend/`)

The backend follows a clean **layered package structure**:

| Package / Entrypoint | Responsibility |
| :--- | :--- |
| `backend/__main__.py` & `backend/main.py` | FastAPI app factory (`create_app`), `lifespan` hook (`db.init_schema()` + `auto_sync_scheduler.start()/stop()`), exception normalization, and Uvicorn runner (`127.0.0.1:3001`). |
| `backend/api/` | `deps.py` (`AppContext`, `get_db`, `get_app_context`), domain `schemas/` (Pydantic v2 payloads), and domain `routers/` (`health`, `dashboard`, `applications`, `interviews`, `alerts`, `imap`, `profile`, `emails`, `backup`, `llm`). |
| `backend/core/` | Shared infrastructure: `constants.py`, 5-field `cron.py`, Fernet `crypto.py` (`SecretCipher`), `normalizers.py`, SQLAlchemy ORM `models.py`, and `database.py` (`DatabaseManager`). |
| `backend/repositories/` | Entity-scoped data access: `base.py`, `applications.py` (with Duplicate Guard & 10-day auto-ghosting), `interviews.py`, `alerts.py`, `profile.py`, `imap_config.py`, and `processed_emails.py`. |
| `backend/parsing/` | Deterministic email intelligence: `html_links.py` (HTML extraction & URL noise filtering), `classifier.py`, `extractors.py`, and `scorer.py` (relevance scoring `0–100`). |
| `backend/imap/` | `queries.py` (batched OR-tree IMAP search builder & folder/MIME header decoding) and `client.py` (`ImapClient` over SSL/TLS with `SyncCancelledError`). |
| `backend/llm/` | Optional local SLM layer: `prompts.py` (GGUF catalog & prompt builder), `downloader.py` (`ModelDownloadManager`), and `runtime.py` (`LlamaCppPythonAdapter`, CPU thread sizing, RAM unload). |
| `backend/services/` | Multi-entity orchestration & read models: `dashboard.py`, `stats.py`, `sync.py` (`ImapSyncService`, `SyncJobManager`, `AutoSyncScheduler`), `backup.py`, `email_filter_context.py`, and `alert_scoring.py`. |
| `backend/cli/decrypt_password.py` | Offline CLI utility (`python -m backend.cli.decrypt_password`) to decrypt `imap_configs.password` locally using `data/.secret.key` or `JOB_TRACKER_KEY`. |

---

## 3. Data Model & Storage (`data/job_tracker.db`)

All persistence uses SQLite with `PRAGMA foreign_keys=ON`. Schema updates are applied idempotently on startup via `DatabaseManager._migrate_missing_columns()` and `_ensure_indexes()`.

### Tables
1. **`applications`**
   - Core fields: `company`, `role_title`, `status` (`applied`, `interviewing`, `offer`, `rejected`, `ghosted`), `source_platform`, `applied_date`, `last_update_date`, `location`, `notes`, `job_url`.
   - Email linkage: `thread_id`, `latest_email_subject`, `latest_email_snippet`.
   - **Auto-Ghosting Rule**: `ApplicationRepository.auto_ghost_stale(days_threshold=10)` automatically moves `applied` rows whose latest activity date is older than 10 days to `ghosted`. Legacy `screening` rows are normalized to `applied`.
2. **`interviews`**
   - Linked via `application_id` (`ForeignKey("applications.id", ondelete="SET NULL")`).
   - Core fields: `company`, `role_title`, `round_label`, `scheduled_at`, `duration_minutes`, `timezone`, `meeting_link`, `job_url`, `interviewer_names`, `status` (`upcoming`, `completed`, `cancelled`), `source_message_id`.
3. **`job_alerts`**
   - Extracted job board / digest items: `job_title`, `company_name`, `source_app`, `relevance_score` (`0–100`), `relevance_reason`, `status` (`suggested`, `applied`, `dismissed`), `email_subject`, `job_url`, `received_at`, `source_message_id`.
4. **`profile_settings`** (singleton `id=1`)
   - Matching preferences: JSON arrays for `target_titles`, `keywords`, `excluded_keywords`, `preferred_locations`.
   - IMAP filter lists: `scan_subject_keywords`, `scan_sender_keywords`, `scan_exclude_keywords` (falls back to curated defaults in `backend/core/constants.py` when blank).
   - Auto-sync settings: `auto_sync_enabled`, `auto_sync_cron` (default `0 */4 * * *`), `auto_sync_days`.
   - Reader settings: `llm_backend` (`rules` | `llama_cpp_python`), `llm_model_path`, `onboarding_completed`, `last_sync_at`.
5. **`imap_configs`** (singleton `id=1`)
   - `provider`, `host`, `port`, `email`, encrypted `password` (`enc:<fernet_token>`), comma-separated `folder` list, `use_ssl`.
   - Environment variables (`IMAP_EMAIL`, `IMAP_PASSWORD`, etc.) take precedence over DB-saved settings.
6. **`processed_emails`**
   - Audit & deduplication log keyed by `message_id`: `thread_id`, `category` (`application_update`, `interview`, `job_alert`, `ignored`), `subject`, `sender`, `received_at`, `processed_at`.

---

## 4. Core Subsystems

### 4.1 Two-Stage IMAP Sync Pipeline (`backend/services/sync.py` + `backend/imap/` + `backend/parsing/`)
1. **Batched IMAP Search**: `build_imap_search_queries()` combines `scan_subject_keywords`, `target_titles`, `keywords`, `scan_sender_keywords`, and active company names into small IMAP OR-trees (`chunk_size=6`) scoped with `SINCE "<DD-Mon-YYYY>"` so Gmail, Outlook, and Yahoo handle searches reliably without query-length errors.
2. **Header Pre-Filter (Stage 1)**: Fetches lightweight headers (`Subject`, `From`, `Date`, `Message-ID`) for up to **1,000 newest matching UIDs per folder**.
   - Messages already in `processed_emails` (unless `force_rescan=True`) are skipped.
   - Messages matching `scan_exclude_keywords` or failing job relevance checks are recorded as `ignored` without downloading full bodies.
3. **Full Fetch & Hybrid Parse (Stage 2)**: Downloads RFC822 MIME bodies in batches with cancellation checkpoints.
   - `backend/parsing/` extracts plain text, HTML anchors, cleaned job URLs (stripping tracking/unsubscribe links), interview links, company, role, and stage updates.
   - When `llm_backend == "llama_cpp_python"`, ambiguous/incomplete emails invoke the local GGUF engine (`backend/llm/runtime.py`) with rule-based fallback if no model is loaded.
   - When sync finishes or is cancelled, the adapter immediately unloads model weights from RAM.
4. **Auto-Sync Scheduler (`AutoSyncScheduler`)**: Background thread polls every 30 seconds; when `auto_sync_enabled=1` and the cron slot since `last_check` matches `next_cron_run()`, triggers `SyncJobManager.start_sync(days=profile.auto_sync_days)`.

### 4.2 Built-in Parser & Local AI Hybrid Pipeline (`backend/parsing/` + `backend/llm/`)

Job Tracker uses a two-tier hybrid parsing architecture designed for speed, privacy, and zero idle resource consumption:

```text
Incoming Email MIME Body
            │
            ▼
┌─────────────────────────────────────────┐
│   Tier 1: Built-in Deterministic Parser │
│   - HTML stripping & link normalization │
│   - Case-insensitive regex matching     │
│   - Substring & token Jaccard scoring   │
└───────────────────┬─────────────────────┘
                    │
                    ▼
     Is result complete & unambiguous?
     (needs_ai_refinement() == False)
         ├── YES ──► Save to Database
         │
         └── NO  ──► Is Local AI enabled? (llm_backend == "llama_cpp_python")
                         ├── NO  ──► Fallback to Best Rule Result ──► Save
                         └── YES ──► Wake Local LLM (llama-cpp-python)
                                           │
                                           ▼
                               Strict JSON Field Patching
                               (company, role, round, meeting link)
                                           │
                                           ▼
                               Save & Unload Model from RAM
```

#### Deterministic Parser Mechanics
1. **Case-Insensitive Matching**:
   - All classification rules, header pre-filters, and domain detectors convert input strings to lowercase (`s_low = normalize_text(subject).lower()`, `b_low = normalize_text(body).lower()`).
   - All extraction regexes use `re.IGNORECASE` (and `re.MULTILINE` where applicable).
2. **Whitespace & Spacing Handling**:
   - `_TextExtractor` (`html_links.py`) collapses multiple tabs and spaces into single spaces on every extracted line (`re.sub(r"[ \t]+", " ", line).strip()`).
   - Regex patterns explicitly use flexible whitespace tokens (`\s+`, `\s*`), matching across arbitrary spacing, tabs, and newlines.
   - Substring phrase matching (e.g. `STRONG_APP_PHRASES`) operates on normalized text blocks with single spaces.
3. **Token Set Scoring**:
   - `score_job_title` (`scorer.py`) uses `tokenize_text(text)` to extract words matching `[a-z0-9+#.]{2,}` into a `set[str]`, removing stop words. Spacing, punctuation, and word ordering do not alter the overlap similarity score against `target_titles` and `keywords`.

#### Local AI Escalation Contract (`needs_ai_refinement`)
The CPU LLM is **never** invoked for every email. It is awakened only when `profile.llm_backend == "llama_cpp_python"` and `needs_ai_refinement()` returns `True`:
- **Applications**: `company` is `"Unknown Company"` or empty, OR `role_title` resolved to a generic fallback (`"Software / Product Role"`, `"untitled role"`, or missing known role indicator words).
- **Interviews**: An interview was detected, but `company` or `role_title` could not be reliably extracted by regex.
- **Job Alerts**: The message looks like a job digest, but HTML link/anchor parsing extracted 0 job titles.
- **Ambiguous Emails**: Classified as `ignored` by rules, but contains 2 or more career transactional signals (*"recruiter"*, *"hiring"*, *"candidate"*, *"opportunity"*, *"moving forward"*, etc.).

#### LLM Payload & Field-Patching Contract
- **Runtime**: Quantized GGUF models (`Qwen 2.5 3B`, `Llama 3.2 3B`, `Gemma 3 4B`, `Qwen 2.5 1.5B`) run locally on CPU via `llama-cpp-python`.
- **Output Schema**: Instructed to return strict JSON containing `category`, `company`, `role_title`, `status`, `round_label`, `scheduled_at`, `meeting_link`, `source_app`, and `job_titles`.
- **Field Patching & Guardrails**: The LLM output selectively patches missing or default fields. If the email contains a strong transactional signal (`has_strong_transactional_signal()`), guardrails prevent the LLM from misclassifying it as `ignored` or `job_alert`.
- **Memory Lifecycle**: The model is loaded into RAM only when sync begins and is unloaded immediately via `LlamaCppPythonAdapter.unload()` when the sync job finishes or is cancelled.

### 4.3 Duplicate Guard (`ApplicationRepository.find_duplicates`)
Before creating an application manually or promoting/converting a job alert, `POST /api/applications/check-duplicate` checks existing rows using:
1. **URL Key Match**: Strips protocol, `www.`, trailing slash, and tracking query parameters (`utm_*`, `trk*`, `ref*`, `fbclid`, `gclid`, `mc_*`, `referrer`, `source`).
2. **Normalized Company & Role Match**: Strips legal entity suffixes (`Inc`, `LLC`, `Ltd`, `Corp`, `Pvt`, `GmbH`, etc.) and punctuation.
If matches exist, `DuplicateGuardModal` lets the user choose **Update Existing** (`merge_update`, preserving `interviewing`/`offer` stages and appending unique notes) or **Add Anyway**.

### 4.4 Non-Career Email Filter Context (`EmailFilterContextService`)
From any **Application**, **Interview**, or **Job Alert**, `GET /api/emails/filter-context?kind=...&id=...` resolves the originating `ProcessedEmail` (via `source_message_id`, `thread_id`, or `subject`), extracts `sender_email`, `sender_domain`, and meaningful subject tokens, and reports which `scan_subject_keywords` / `scan_sender_keywords` matched. The user can add noise terms to `scan_exclude_keywords`, uncheck broad allowed terms, and optionally delete the item.

### 4.5 Stats Engine (`StatsQueryService`)
Aggregates metrics for a chosen lookback window (`3d`, `7d`, `15d`, `30d`, `90d`, or `all`):
- **KPIs & Stages**: Total applications, active count (`interviewing` or `applied` updated within 10 days), Reply Rate (`interviewing`/`offer`/`rejected` or linked interview), average response days (including same-day `0d` replies on responded applications), Interview Rate, Offer Rate, and Ghosted %.
- **Pace Series**: Both 12-week Monday-anchored buckets (`weekly_pace`) and window-matched daily buckets (`daily_pace`).
- **Alert Review Stats**: Totals, Suggested/Applied/Dismissed counts, match tiers (`40%+`, `70%+`), Applied vs Reviewed rate, and per-source breakdown.
- **Board / Source Breakdown**: Per-platform counts, reply %, interview %, and avg response days.

### 4.6 Backup & Restore (`BackupRestoreService`)
- **JSON Export (`GET /api/backup/export`)**: Portable format (`job-tracker-backup` v1) containing `applications`, `interviews`, `job_alerts`, and `profile_settings`—intentionally excluding `imap_configs` passwords/secrets.
- **JSON Import (`POST /api/backup/import`)**: Supports `merge` (deduplicates via `thread_id`, normalized company+role, `source_message_id`, and interview/alert signatures while remapping `application_id` foreign keys) and `replace` (clears tracked tables inside the transaction while leaving `imap_configs` intact).
- **SQLite Snapshot (`GET /api/backup/sqlite`)**: Uses Python `sqlite3.Connection.backup()` to stream an atomic hot snapshot `.db` file via a temporary file cleaned up by Starlette `BackgroundTask`.

---

## 5. Security & Privacy Model

- **Local Loopback Binding**: Express binds to `127.0.0.1:3000` and FastAPI binds to `127.0.0.1:3001` by default.
- **Encryption at Rest**: Saved IMAP App Passwords use `cryptography.fernet.Fernet` (AES-128-CBC + HMAC-SHA256) with a key stored in `data/.secret.key` (`chmod 0600`) or supplied via `JOB_TRACKER_KEY`. Legacy plaintext rows are transparently upgraded on read.
- **URL Sanitization**: Stored `job_url` and `meeting_link` fields strictly enforce `http://` or `https://` (`<= 2000` chars) to block `javascript:` or unsafe schemes.
- **Zero External Telemetry**: No third-party analytics, error reporters, or cloud LLM calls exist anywhere in the codebase.

---

## 6. Frontend Architecture (`src/`)

- **Single Source of Truth (`src/App.tsx`)**: Holds top-level workspace state (`dashboard`, `interviews`, `alerts`, `profile`, `syncJob`) and coordinates modal/drawer workflows (`AddApplicationModal`, `AddInterviewModal`, `MoveAlertModal`, `DuplicateGuardModal`, `BatchDeleteKeywordModal`, `EmailFilterModal`, `OnboardingWizard`, `ImapModal`).
- **Typed API Layer (`src/api.ts` & `src/types.ts`)**: Centralized `request<T>()` wrapper normalizing FastAPI `{ error }` / `{ detail }` responses.
- **Views (`src/components/`)**: Tabular and board views share `PaginationBar` (`pageSizeOptions` customizable per view) and `utils/appHelpers.ts` (local timezone formatting, 10-day stale detection, CSV export with formula-safe escaping, cron humanizer).
