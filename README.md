# JobHQ

> **The unified, local-first personal career command center.**  
> *Stop juggling spreadsheets, browser extensions, and multiple job portals. JobHQ silently connects to your mailbox, turns application emails and interview calendar invites into an organized Kanban pipeline, and scores inbound job alerts with zero cloud tracking, completely on your device.*

Connect any email inbox over standard IMAP (Gmail, Outlook, Yahoo, or custom mail servers) to automatically aggregate updates across LinkedIn, Indeed, Naukri, Greenhouse, Lever, Workday, and more. Built with a responsive React 19 + TypeScript frontend, a tactile Studio aesthetic, FastAPI + SQLite backend, an autonomous background worker daemon, and a fast 2-tier parsing engine (instant deterministic rules + optional offline Local AI), available both as a web app and a native desktop app via Tauri v2.

---

## Why JobHQ?

- **Zero Manual Copy-Pasting & No Browser Extensions**: Works backwards from your email inbox. Every job application confirmation, interview invite, and status update is detected and organized automatically without clicking buttons on every application.
- **Universal Multi-Platform Aggregation**: Aggregates updates from major global boards (LinkedIn, Indeed, Glassdoor) and top enterprise ATS platforms (Greenhouse, Lever, Ashby, Workday, Naukri, Instahyre).
- **Sub-Millisecond 2-Tier Parsing**: High-speed deterministic rules parse 90% of structured emails in under 5 milliseconds with near-zero CPU and RAM footprint, gracefully escalating ambiguous recruiter threads to offline Local AI (`llama-cpp-python`).
- **100% Local & Private**: No cloud accounts, subscriptions, or external tracking. Your database, resumes, and email credentials reside strictly on your machine in `~/.jobhq/`.

---

## Key Features

- **Unified Dashboard & Analytics**: Live pipeline KPIs, stage distribution, pacing charts, and job search metrics with post-mortem analytics on rejected/ghosted applications.
- **Applications Pipeline (`Kanban` + `Table`)**: 5-stage tracking (`Applied`, `Interviewing`, `Offer`, `Rejected`, `Ghosted`), 10-day auto-ghosting, clickable job links, rejection outcome reasons with retro learnings notes, and bulk actions.
- **Duplicate Guard**: Checks normalized URLs, company names, and role titles before adding manual applications or promoting alerts, offering merge or add anyway options.
- **Interviews & Calendar**: Automatic extraction of rounds, interviewers, dates, and meeting links (`Zoom`, `Google Meet`, `Teams`), with Month/Week/Agenda calendar views and a high-density Day Inspector.
- **Job Alert Matching**: Parses job board digests, scores relevance against target roles and skills, and provides one-click conversion to applications or interviews.
- **One-Click Non-Career Email Filtering**: Inspect source email headers directly from any item to block noisy senders, domains, or topics into skip lists.
- **Autonomous Background Worker Daemon**: Independent multi-process daemon executing periodic IMAP synchronization, interview transitions, application auto-ghosting, digest pruning, and database snapshots. See [Background Worker System](docs/WORKERS.md).
- **Built-in Reader + Optional Local AI**: Fast deterministic regex/HTML rules handle structured emails immediately; optionally run quantized GGUF models (`llama-cpp-python`) for ambiguous recruiter threads.
- **Native Desktop App (Tauri v2)**: Frameless Studio titlebar with custom window controls, native OS notifications, and bundled standalone backend sidecar. See [Desktop Architecture](docs/DESKTOP_ARCHITECTURE.md).
- **Local Storage & Privacy**: Zero cloud accounts or external telemetry. Data and encryption keys reside locally in `~/.jobhq/`. See [System Architecture](docs/ARCHITECTURE.md).

---

## Quick Start

### 1. Installation

Run the one-step installer for your OS:

- **macOS / Linux:**
  ```bash
  chmod +x install.sh
  ./install.sh
  ```
- **Windows:**
  ```cmd
  install.bat
  ```

*For manual setup via `uv` or custom environment configuration, see the [Setup & Development Guide](docs/SETUP_AND_DEVELOPMENT.md).*

### 2. Run the App

- **Web Application** (Express + Vite + FastAPI + Worker Daemon):
  ```bash
  npm run dev
  ```
  Open **http://localhost:3000**. On first launch, the 5-step Quick Setup Wizard walks you through connecting your email and target preferences.

- **Desktop Application** (Tauri v2):
  ```bash
  npm run tauri:dev
  ```

---

## Documentation

- **[System Architecture](docs/ARCHITECTURE.md)**: Process topology, unified configuration (`~/.jobhq`), 3-tier backend execution model, and security model.
- **[Desktop Architecture](docs/DESKTOP_ARCHITECTURE.md)**: Architectural blueprint for the Tauri v2 desktop shell, PyInstaller sidecar, single-pod backend model, and lifecycle hooks.
- **[Background Worker System](docs/WORKERS.md)**: Multi-process supervisor architecture, desktop interval scheduling, worker catalog, and REST controls.
- **[Setup & Development Guide](docs/SETUP_AND_DEVELOPMENT.md)**: Installation options, email provider App Password guides, environment overrides, and verification test commands.

---

## Interactive API Documentation (Swagger / OpenAPI)

JobHQ’s backend is powered by FastAPI, which automatically generates live interactive documentation:

- **Swagger UI**: [http://127.0.0.1:3001/docs](http://127.0.0.1:3001/docs)
- **ReDoc**: [http://127.0.0.1:3001/redoc](http://127.0.0.1:3001/redoc)
- **OpenAPI JSON**: [http://127.0.0.1:3001/openapi.json](http://127.0.0.1:3001/openapi.json)
