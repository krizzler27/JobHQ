# Development & Build Playbook

This is the primary developer guide for **JobHQ**. It covers local environment setup, configuration paths, development execution modes, build pipelines, production installer outputs, testing, and debugging.

---

## 1. Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- *(Recommended)* **`uv`** (fast Python package and virtual environment manager)
- *(Optional for Desktop)* **Rust & Cargo** (for building Tauri v2 native desktop packages)

---

## 2. Environment Setup

### Option A: One-Step Automated Installer
- **macOS / Linux:**
  ```bash
  chmod +x install.sh
  ./install.sh
  ```
- **Windows:**
  ```cmd
  install.bat
  ```

Both scripts:
1. Ensure `uv` is available and run `uv sync` (creates `.venv` and installs FastAPI, Uvicorn, SQLAlchemy, `cryptography`, `pydantic-settings`, and prebuilt CPU wheels for `llama-cpp-python`).
2. Run `npm install` for Vite, React 19, Tailwind CSS v4, and Tauri v2 dependencies.

### Option B: Manual Setup via `uv`
```bash
# 1. Sync Python dependencies and virtual environment
uv sync

# 2. Install frontend and build packages
npm install
```

---

## 3. Configuration & Storage Paths (`~/.jobhq`)

JobHQ defaults to storing all application state, databases, backups, models, and secret keys in the user's home directory `~/.jobhq/` ([backend/core/config.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/core/config.py)). No `.env` file is required for normal operation. The following environment variables can override defaults:

| Setting | Variable | Default | Description |
| :--- | :--- | :--- | :--- |
| **Home Directory** | `JOBHQ_HOME_DIR` | `~/.jobhq` | Root directory for application state |
| **Database Path** | `JOBHQ_DB_PATH` or `DB_PATH` | `~/.jobhq/data/job_tracker.db` | Primary SQLite database |
| **Secret Key Path** | `JOBHQ_SECRET_KEY_PATH` or `SECRET_KEY_PATH` | `~/.jobhq/.secret.key` | Fernet AES-128 encryption key |
| **Backups Directory**| `JOBHQ_BACKUPS_DIR` or `BACKUPS_DIR` | `~/.jobhq/backups/` | Automated and manual database snapshots |
| **Models Directory** | `JOBHQ_MODELS_DIR` or `MODELS_DIR` | `~/.jobhq/models/` | Quantized `.gguf` local AI model files |
| **Backend Port** | `JOBHQ_PORT` or `PY_BACKEND_PORT` | `3001` | FastAPI server port |
| **Master Fernet Key**| `JOBHQ_ENCRYPTION_KEY` or `JOB_TRACKER_KEY` | *(None)* | Optional custom symmetric Fernet key string |

---

## 4. Connecting Your Email (App Passwords)

Major email providers require dedicated **App Passwords** for IMAP access:
- **Gmail:** Enable 2-Step Verification in Google Account Security → search **App passwords** → generate a 16-character password for *Mail*. Confirm IMAP is enabled in Gmail Settings (*Forwarding and POP/IMAP*).
- **Outlook / Hotmail:** Microsoft Account Security → *Advanced security options* → *Create a new app password* (Host: `outlook.office365.com:993`).
- **Yahoo Mail:** Yahoo Account Security → *Generate app password* (Host: `imap.mail.yahoo.com:993`).

Inside **Connect Email** (or Quick Setup Step 1), click **Load My Folders** to select specific folders or Gmail labels (e.g. `INBOX`, `Careers`, `Job Alerts`).

---

## 5. Development Modes & Command Flags

JobHQ offers two distinct execution architectures: multi-process web mode and unified desktop mode.

### A. Full-Stack Web Development Mode
```bash
npm run dev
```
- **Spawns**:
  1. Python Web API (`python -m backend`) on port `3001`.
  2. Python Background Worker Daemon (`python -m backend.workers`).
  3. Express supervisor and Vite dev server on **`http://localhost:3000`** with live Hot Module Replacement (HMR).
- **Flags**:
  - `npm run dev -- --desktop` (or `JOBHQ_DESKTOP_DEV=1 npm run dev`):
    Runs the unified `backend.desktop` backend (FastAPI and workers sharing cooperative threads) instead of two independent Python child processes. Use this when debugging desktop-specific thread lifecycle behavior in the browser.

### B. Tauri Native Desktop Development Mode
```bash
npm run tauri:dev
```
- **What it does**:
  1. Executes `beforeDevCommand` (`npm run dev -- --desktop`).
  2. Spawns the native desktop application shell using the WebView2 runtime.
  3. Provides live code reloading, custom frameless Studio window titlebar, and DevTools inspection (`Ctrl+Shift+I` / right-click Inspect).

### C. Standalone Worker Daemon (Terminal Debugging)
To run only the background worker loop in isolation:
```bash
# Windows
.venv\Scripts\python.exe -m backend.workers

# macOS / Linux
.venv/bin/python -m backend.workers
```

---

## 6. Production Builds & Installer Types

JobHQ can be built for production either as a web distribution or as a native desktop installer.

### Production Web Build
```bash
npm run build      # Bundles frontend assets into dist/
npm start          # Runs production Express server
npm run preview    # Locally serves dist/ for build verification
```

### Native Desktop Production Pipeline
To build the complete standalone desktop application on Windows:
```cmd
npm run desktop:build
# Or run directly: build-desktop.bat
```

This automated pipeline performs four stages:
1. **Sidecar Compilation**: Runs PyInstaller (`jobhq_backend.spec`) to compile `backend/desktop.py` into a single standalone binary (`dist/jobhq-backend-x86_64-pc-windows-msvc.exe`) with `llama_cpp` and C++ GGML math acceleration DLLs included.
2. **Binary Placement**: Copies the compiled sidecar into `src-tauri/binaries/`.
3. **Frontend Build**: Compiles static assets via `npm run build` using relative paths (`base: './'`).
4. **Tauri Packaging**: Runs `npm run tauri build` to output the final production artifacts.

### Generated Desktop Artifacts

| Artifact | File Path | Purpose |
| :--- | :--- | :--- |
| **Windows Setup Installer (`.exe`)** | `src-tauri/target/release/bundle/nsis/JobHQ_0.1.0_x64-setup.exe` | **Recommended for end users.** Standard NSIS installation wizard with Desktop/Start Menu shortcuts and clean uninstaller in Windows Settings. |
| **Enterprise Installer (`.msi`)** | `src-tauri/target/release/bundle/msi/JobHQ_0.1.0_x64_en-US.msi` | **Enterprise / IT deployment.** Built via WiX Toolset for silent command-line installations (`msiexec /i JobHQ.msi /quiet`). |
| **Standalone Portable (`app.exe`)** | `src-tauri/target/release/app.exe` | **Portable developer executable.** Runs in-place without running setup, pairing with the companion `jobhq-backend.exe` sidecar. |

---

## 7. Verification & Automated Testing

Always verify both test suites before committing or proposing changes:

```bash
# 1. Frontend type checking and unit tests
npm run lint          # runs tsc --noEmit
npm run test          # runs tsx --test src/**/*.test.ts

# 2. Backend unit tests (in-memory isolated suite)
# Windows
.venv\Scripts\python.exe -m unittest discover -s backend/tests -v

# macOS / Linux
.venv/bin/python -m unittest discover -s backend/tests -v
```

### Safe In-Memory Database Testing
When testing database logic via Python CLI, always use in-memory databases (`:memory:`) to ensure live database files remain untouched:
```python
from backend.core.database import DatabaseManager
db = DatabaseManager(":memory:")
db.init_schema()
print("Schema verified cleanly.")
```

---

## 8. Password Recovery & Decryption CLI

If you need to view or debug your stored IMAP password outside of the UI:
```bash
# Windows
.venv\Scripts\python.exe -m backend.cli.decrypt_password

# macOS / Linux
.venv/bin/python -m backend.cli.decrypt_password
```
Supports optional flags `--db <path>`, `--key-file <path>`, and `--key <fernet_key_string>`.
