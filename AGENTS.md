# JobHQ — Agent & Development Instructions

This document records the core architectural principles, design standards, and collaboration workflows for **JobHQ**. All agents and developers working on this codebase must follow these conventions.

---

## 1. Project & Brand Identity

- **Official Name**: **JobHQ**
- **Brand Assets** (`public/img/`):
  - `Logo Icon Light No BG.png` — Mark / icon only (transparent).
  - `Logo Text Light No BG.png` — Wordmark typography only (transparent).
  - `Logo Light No BG.png` — Combined mark and wordmark.
- **Tone & Voice**: Editorial, calm, high-density, and utilitarian.
  - Zero corporate fluff or generic AI marketing jargon (avoid phrasing like "AI-powered insights engine" or "pipeline progression tracker").
  - Use clear, professional English: *"Applications & Activity: Breakdown by stage and your daily pace."*
  - Format metrics, counters, and dates with tabular figures (`font-mono-tabular`).

---

## 2. Design System & Frontend Principles

JobHQ uses a tactile, editorial aesthetic built on warm neutral surfaces and high-contrast accents:

| Token / Layer | Specification | Usage |
| :--- | :--- | :--- |
| **Canvas** | `--canvas: #f6f5f2` | Warm off-white background foundation. |
| **Cards & Surfaces** | `.studio-card` (`#ffffff` / dark `#131926`) | Elevated cards with crisp hairline borders (`--border-main: #e5e3dc`). |
| **Primary Accent** | `--accent: #234aff` (`.btn-cobalt`) | High-contrast electric Cobalt Blue for active navigation tabs and primary CTAs. |
| **Typography** | Display: `Plus Jakarta Sans`<br>Body: `DM Sans`<br>Numbers: `JetBrains Mono` | Strict hierarchy; tabular numbers for metrics, timestamps, and data tables. |
| **Status Indicators** | Solid `h-2 w-2 rounded-full` + matching 20% ring | Calm, static indicators. Avoid continuous pulsing or distracting animations (`animate-ping`). |

### Frontend UI & Interaction Guidelines
- **Desktop Density**: Prioritize dense, scannable layouts with pinned sidebars and tabbed/card views that eliminate excessive vertical scrolling.
- **Immediate User Feedback**: Every user mutation (saving settings, moving cards, dismissing alerts, trigger actions) must emit immediate feedback via toast notifications (`useToast()`).
- **Progress Tracking**: Long-running asynchronous tasks (e.g. email ingestion, backups) must compute deterministic, strictly monotonic progress (never jump backwards or reset between phases).

---

## 3. Core Backend Architecture & Conventions

JobHQ follows a decoupled 3-tier execution model:

```text
Worker (When to run) ──► Service (What business rules to run) ──► Repository (Pure DB queries)
```

### Triad Responsibilities
1. **Workers (`backend/workers/`)**:
   - Act strictly as **scheduled triggers** inheriting from `BaseWorker`.
   - Lightweight, zero SQL queries, and zero business math.
   - Declare identity, schedule (`name`, `is_enabled()`, `get_cron()`), and delegate work to a domain service.
   - Receive dependencies (e.g. database managers, services) via constructor injection.
2. **Services (`backend/services/`)**:
   - Own all **business rules and domain logic** (e.g. `JobHQLifecycleService`, `SyncJobManager`, `DashboardQueryService`).
   - Single source of truth for business calculations and entity lifecycles.
   - Coordinate across repositories and manage transaction scopes (`db.session_scope()`).
3. **Repositories (`backend/repositories/`)**:
   - Pure **data access layer** (SQLAlchemy ORM queries).
   - Contain zero business policy or lifecycle decisions.
   - Exclusively perform CRUD, filtering, and bulk database operations.

### Multi-Process Execution Model
- `server.ts` supervises independent Python child processes:
  - **Web API** (`python -m backend`): FastAPI on port `3001` dedicated to request/response serving.
  - **Worker Daemon** (`python -m backend.workers`): Background daemon running `WorkerRunner` on a 15-second tick loop.
- **Zero GIL Contention**: Background sync, parsing, or CPU-bound tasks never block API responsiveness.
- **Database Concurrency**: Both processes share SQLite in WAL mode (`PRAGMA journal_mode=WAL`) with a 15-second busy timeout (`PRAGMA busy_timeout=15000`).
- **Fault Isolation**: Each worker runs in an isolated daemon thread. An exception in one worker is caught, logged, and never crashes the runner or sibling workers.

---

## 4. Engineering Principles: DRY, KISS, YAGNI

All development across the full stack must strictly follow these engineering principles:

### A. DRY (Don't Repeat Yourself)
- **Single Source of Truth**: Business logic and lifecycle rules must live exclusively in designated domain Services, never duplicated across routers, repositories, workers, or frontend helpers.
- **Documentation Without Code Duplication**: Architecture and reference docs explain concepts, contracts, and APIs in prose/tables and link directly to source files via `file:///` links. Never copy whole class implementations into Markdown documentation.

### B. KISS (Keep It Simple, Stupid)
- **Direct & Explicit Module Imports**: Always import directly and explicitly from the target file (e.g., `from backend.services.job_hq_lifecycle import JobHQLifecycleService`). Avoid complex re-export barrels in package index files to prevent circular import chains and eager import overhead.
- **Decoupled Contracts**: Base classes and runners accept generic arguments (`*args, **kwargs`) rather than hardcoding domain-specific dependencies into shared infrastructure.

### C. YAGNI (You Aren't Gonna Need It)
- **No Premature Architecture**: Avoid introducing external task brokers (Redis, Celery, RabbitMQ), separate task databases, or heavy orchestration frameworks when native Python threads, event tick loops, and SQLite WAL mode reliably handle local-first scale.

---

## 5. Agent Collaboration & Workflow Rules

When working on this codebase, all AI agents must adhere to the following workflow guidelines:

### A. Git & Permissions Guardrails
- **NEVER commit or push without explicit user approval**: Always show what was changed, state modified/created files, and wait for confirmation before staging or committing.
- **Do Not Commit Working / Roadmap Files**: Temporary planning documents (e.g. `BACKGROUND_JOBS_ROADMAP.md`), scratch notes, or temporary test artifacts must remain strictly untracked.
- **Clean Commits**: Follow Conventional Commits format (e.g. `feat(backend): ...`, `fix(ui): ...`).

### B. Communication & Domain Boundaries
- **Interactive Step-by-Step Updates**: Explain what is being investigated or run before executing. Do not run silent batches of complex operations.
- **Speech-to-Text Tolerance**: The user frequently uses speech-to-text. Intelligently deduce phonetic, punctuation, or grammar typos. If an instruction is genuinely ambiguous, ask for clarification directly.
- **Domain Boundaries**: If another agent or user is actively working on a specific domain (e.g. frontend redesign in `src/`), do not touch, format, or re-stage files in that domain.

---

## 6. Verification & Testing Guardrails

Always run and verify both suites before completing tasks or proposing commits:

```bash
# Frontend type check & unit tests:
cmd /c npm run lint        # (tsc --noEmit)
cmd /c npm run test        # (tsx --test src/**/*.test.ts)

# Backend unit tests (runs isolated in-memory tests):
.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

> [!IMPORTANT]
> - Ensure all frontend imports use explicit extensions compatible with Vite and Node ESM resolution (`.tsx`, `.ts`).
> - Ensure all Python imports use direct module paths.
