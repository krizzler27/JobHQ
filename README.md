# Job Tracker

A private, local-first personal job application tracker. Connect any email inbox over standard IMAP (Gmail, Outlook, Yahoo, or any custom IMAP server) to automatically track application updates, interview invites, and job alerts—alongside a unified pipeline board, stats dashboard, duplicate guard, and local backups, with zero cloud accounts or external telemetry.

---

## Key Features

- **Unified Dashboard (`Overview`)**: Live KPIs (`Active Applications < 10d`, `Upcoming Interviews`, `Offers Received`, `Relevant Job Alerts (Last 3d)`), side-by-side **Applications by Stage** and **Applications per Day / Week** cards with an **Open Application Board** shortcut, upcoming calls, and top job alert matches.
- **Job Search Stats (`Stats`)**: Time-windowed analytics (`3d`, `7d`, `15d`, `30d`, `90d`, `All time`) covering Reply Rate & average response days, Interview & Offer rates, clickable **Applications by Stage**, interactive **Applications per Day / Week** chart, **Job Alert Review Stats**, and paginated **Results by Job Board & Source** (`5 / 10 / 25` per page).
- **Applications Pipeline (`Kanban` + `Table`)**: Track applications across 5 stages (`Applied`, `Interviewing`, `Offer`, `Rejected`, `Ghosted`), auto-move `Applied` entries unchanged for 10+ days to `Ghosted`, store clickable **Job / Portal Links** (`job_url`), sort/group by stage/source/company, export CSV, and run bulk stage moves or deletes.
- **Duplicate Guard**: Checks normalized job links and company/role names before adding a manual application or promoting a job alert, offering **Update Existing** (merge details & notes) or **Add Anyway**.
- **Interview Schedule (`Interviews`)**: Extracts rounds, dates, timezones, interviewers, job links, and meeting URLs (`Zoom`, `Google Meet`, `Microsoft Teams`, `Calendly`), with Upcoming / Past & Cancelled tabs, CSV export, and bulk selection delete.
- **Job Alert Matching (`Job Alerts`)**: Parses job digests (LinkedIn, Indeed, Wellfound, Glassdoor, ZipRecruiter, Otta, Greenhouse, Lever, etc.), scores titles against your target roles/skills, supports sorting/grouping/pagination in row view, and includes a `⋮` menu to move misclassified emails to **Applications** or **Upcoming Interviews**.
- **Batch Delete by Title or Keyword**: Available across **Applications**, **Interviews**, and **Job Alerts** with comma-separated keyword matching, field scope toggles (`Title / Role`, `Company`, `Source / Subject`), optional current-filter scoping, and a live preview before deleting.
- **One-Click Non-Career Email Filtering**: Open **Filter Non-Career Email** from any Application drawer, Interview row, or Job Alert `⋮` menu to inspect the source email's sender/subject, block sender/domain/topic keywords into **Skip / Noise Words**, prune overly broad allowed keywords, and optionally delete the item in one step.
- **Automatic IMAP Sync + Unix Cron Auto-Sync**:
  - Scans multiple folders/labels (e.g., `INBOX, Careers, Job Alerts`) with provider-safe OR-tree header queries (`SINCE`, `SUBJECT`, `FROM`), skipping noise and already-seen `Message-ID`s before downloading bodies.
  - Background **Auto-Sync Scheduler** runs inside the Python backend using standard 5-field Unix cron expressions while the server is running.
- **Built-in Reader + Optional Local AI (`llama-cpp-python`)**: Fast deterministic rules handle structured emails immediately; optionally download a quantized `.gguf` model (`Qwen 2.5 3B`, `Llama 3.2 3B`, `Gemma 3 4B`, `Qwen 2.5 1.5B`) for ambiguous recruiter threads, auto-unloaded from RAM when sync finishes.
- **Local Encrypted Storage & Backups**: Persists everything in `data/job_tracker.db` (SQLite + SQLAlchemy). IMAP App Passwords are encrypted at rest with Fernet (`cryptography`). Export secret-free portable `.json` backups (with **Merge** or **Replace** restore) or download a consistent SQLite `.db` snapshot.

---

## Requirements

- **Python 3.10+**
- **Node.js 18+** (with `npm`)

---

## Quick Start

Clone the repository and run the one-step installer for your OS:

### macOS / Linux
```bash
chmod +x install.sh
./install.sh
```

### Windows
Double-click `install.bat` or run:
```cmd
install.bat
```

### Manual Setup (Any OS)
```bash
# 1. Install Python dependencies (FastAPI, Uvicorn, SQLAlchemy, cryptography, llama-cpp-python CPU wheel)
uv sync

# 2. Install frontend & proxy dependencies
npm install
```

> `uv` automatically manages the Python virtual environment (`.venv`), dependencies, and prebuilt CPU wheels as configured in `pyproject.toml`. See [Setup & Development Guide](docs/SETUP_AND_DEVELOPMENT.md) for details.

### Start the App
```bash
npm run dev
```
Open **http://localhost:3000** (bound to `127.0.0.1` by default). On first launch, the **5-step Quick Setup Wizard** guides you through:
1. **Connect Email** (provider preset, App Password, folder/label selection)
2. **Jobs You Want** (target titles, skills, excluded terms)
3. **Email Reader** (Built-in Reader or Local AI GGUF model)
4. **Scan Filters** (IMAP subject, sender/domain, and skip/noise keywords)
5. **Auto Sync** (background Unix cron schedule templates, custom expression & lookback window)

For production mode:
```bash
npm run build
npm start
```

---

## Documentation

Detailed technical and operational docs live in the [`docs/`](docs/) directory:

- **[System Architecture (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)** — Process topology, backend/frontend module design, SQLite schema, two-stage IMAP sync pipeline, hybrid parser/SLM flow, Unix cron scheduler, duplicate guard, and security model.
- **[API Reference (`docs/API_REFERENCE.md`)](docs/API_REFERENCE.md)** — Complete REST endpoint reference for dashboard, stats, applications, interviews, job alerts, IMAP sync, email filtering, profile/cron, local AI, and backups.
- **[Setup & Development Guide (`docs/SETUP_AND_DEVELOPMENT.md`)](docs/SETUP_AND_DEVELOPMENT.md)** — Installation, Gmail/Outlook/Yahoo App Passwords, scan filter tuning, `backend.cli.decrypt_password` recovery CLI, and safe testing commands.

---

## Project Structure

```text
├── backend/
│   ├── __main__.py               # Module runner (`python -m backend`)
│   ├── main.py                   # FastAPI factory, lifespan hooks & Uvicorn entrypoint
│   ├── api/
│   │   ├── deps.py               # AppContext & FastAPI session/context dependencies
│   │   ├── schemas/              # Pydantic request payloads (applications, interviews, alerts, imap, profile, backup, llm)
│   │   └── routers/              # Domain APIRouter modules (health, dashboard, applications, interviews, alerts, imap, profile, emails, backup, llm)
│   ├── core/                     # Constants, 5-field cron parser, Fernet crypto, normalizers, ORM models & DatabaseManager
│   ├── repositories/             # Entity repositories (applications, interviews, alerts, profile, imap_config, processed_emails)
│   ├── parsing/                  # HTML/link extraction, email classifier, field extractors & alert relevance scorer
│   ├── imap/                     # Batched IMAP search query builder & multi-folder SSL/TLS ImapClient
│   ├── llm/                      # Recommended GGUF catalog, downloader & llama-cpp-python runtime adapter
│   ├── services/                 # Dashboard, Stats, Sync/AutoSyncScheduler, Backup/Restore, EmailFilterContext & rescoring
│   ├── cli/decrypt_password.py   # Standalone CLI tool (`python -m backend.cli.decrypt_password`)
│   └── tests/                    # Automated unit tests (`python -m unittest discover -s backend/tests`)
├── docs/
│   ├── ARCHITECTURE.md         # System & data architecture documentation
│   ├── API_REFERENCE.md        # Backend REST API specification
│   └── SETUP_AND_DEVELOPMENT.md# Installation, configuration & contributor guide
├── src/
│   ├── App.tsx                 # Main navigation shell, top sync bar & modal orchestration
│   ├── api.ts                  # Typed frontend REST client
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── utils/appHelpers.ts     # Date formatting, stale checks, CSV download & cron labels
│   └── components/
│       ├── StatsView.tsx               # Pipeline & job board analytics view
│       ├── PipelineActivityCards.tsx   # Shared stage breakdown & daily/weekly pace chart cards
│       ├── KanbanBoard.tsx             # 5-stage drag-and-drop Kanban board
│       ├── ApplicationsTableView.tsx   # Sortable/grouped table & bulk action view
│       ├── ApplicationDrawer.tsx       # Slide-over application editor & email filter trigger
│       ├── InterviewsView.tsx          # Upcoming/past interview manager & bulk actions
│       ├── JobAlertsView.tsx           # Scored job alerts row/grouped list & ⋮ action menu
│       ├── ScanLogView.tsx             # Processed email audit log & Force Re-scan
│       ├── ProfileSettingsView.tsx     # Goals, cron auto-sync, scan filters, reader & backup/restore
│       ├── OnboardingWizard.tsx        # 5-step Quick Setup modal
│       ├── ImapModal.tsx               # Email connection & folder picker modal
│       ├── AddModals.tsx               # Manual Add Application & Add Interview modals
│       ├── MoveAlertModal.tsx          # Convert misclassified alert to App or Interview
│       ├── DuplicateGuardModal.tsx     # Update Existing vs Add Anyway conflict resolver
│       ├── BatchDeleteKeywordModal.tsx # Keyword/title match preview & batch deletion modal
│       ├── EmailFilterModal.tsx        # Block non-career senders/keywords from synced items
│       ├── EmailReaderPanel.tsx        # Built-in vs Local AI GGUF selector & downloader
│       └── PaginationBar.tsx           # Shared pagination controls
├── server.ts                   # Express dev/prod server serving UI & proxying /api/* to FastAPI
├── pyproject.toml              # uv dependencies & llama-cpp-python CPU wheel index
└── install.sh / install.bat    # One-step OS setup scripts
```
