# Setup, Configuration & Development Guide

This guide covers everything needed after cloning the repository: local installation, configuration, email provider setup, background task management, Tauri desktop development, and safe testing commands.

---

## 1. Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- *(Recommended)* **`uv`** (fast Python package and project manager)
- *(Optional for Desktop)* **Rust & Cargo** (for Tauri v2 desktop development)

---

## 2. Installation Options

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

Both installer scripts:
1. Ensure `uv` is available and run `uv sync` (creates `.venv` and installs FastAPI, Uvicorn, SQLAlchemy, `cryptography`, `pydantic-settings`, and prebuilt CPU wheels for `llama-cpp-python`).
2. Run `npm install` for frontend build tools, Vite, Tailwind CSS v4, and Tauri v2 dependencies.

### Option B: Manual Setup via `uv`
```bash
# 1. Sync Python dependencies and virtual environment
uv sync

# 2. Install frontend and build packages
npm install
```

---

## 3. Configuration & Storage Paths (`~/.jobhq`)

JobHQ defaults to storing all databases, backups, models, and secret keys in `~/.jobhq/` ([backend/core/config.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/core/config.py)). No `.env` file is required for standard usage, but path and port overrides are supported via environment variables:

| Setting | Variable | Default | Description |
| :--- | :--- | :--- | :--- |
| **Home Directory** | `JOBHQ_HOME_DIR` | `~/.jobhq` | Root directory for application state |
| **Database Path** | `JOBHQ_DB_PATH` or `DB_PATH` | `~/.jobhq/jobhq.db` | Primary SQLite database |
| **Secret Key Path** | `JOBHQ_SECRET_KEY_PATH` or `SECRET_KEY_PATH` | `~/.jobhq/.secret.key` | Fernet AES-128 encryption key |
| **Backups Directory**| `JOBHQ_BACKUPS_DIR` or `BACKUPS_DIR` | `~/.jobhq/backups/` | Automated and manual database snapshots |
| **Models Directory** | `JOBHQ_MODELS_DIR` or `MODELS_DIR` | `~/.jobhq/models/` | Quantized `.gguf` local AI model files |
| **Backend Port** | `JOBHQ_PORT` or `PY_BACKEND_PORT` | `3001` | FastAPI port |
| **Master Fernet Key**| `JOBHQ_ENCRYPTION_KEY` or `JOB_TRACKER_KEY` | *(None)* | Optional custom symmetric Fernet key string |

---

## 4. Connecting Your Email (App Passwords)

Major email providers require dedicated **App Passwords** for IMAP access:
- **Gmail:** Enable 2-Step Verification in Google Account Security → search **App passwords** → generate a 16-character password for *Mail*. Confirm IMAP is enabled in Gmail Settings (*Forwarding and POP/IMAP*).
- **Outlook / Hotmail:** Microsoft Account Security → *Advanced security options* → *Create a new app password* (Host: `outlook.office365.com:993`).
- **Yahoo Mail:** Yahoo Account Security → *Generate app password* (Host: `imap.mail.yahoo.com:993`).

Inside **Connect Email** (or Quick Setup Step 1), click **Load My Folders** to select specific folders or Gmail labels (e.g. `INBOX`, `Careers`, `Job Alerts`).

---

## 5. Development & Running the Application

### Web Development Mode
```bash
npm run dev
```
Spawns:
1. Python Web API (`127.0.0.1:3001`).
2. Python Worker Daemon (`python -m backend.workers`).
3. Express + Vite development server on **http://localhost:3000**.

### Tauri Native Desktop Development Mode
```bash
npm run tauri:dev
```
Launches the native desktop application shell with the custom frameless Studio window titlebar, native OS notifications, and Vite hot-reloading.

### Production Build & Serving (Web)
```bash
npm run build
npm start
```

### Standalone Worker Daemon Execution
To run only the background worker loop in your terminal for debugging:
```bash
# macOS / Linux
.venv/bin/python -m backend.workers

# Windows
.venv\Scripts\python.exe -m backend.workers
```

---

## 6. Verification & Automated Testing

Always verify both frontend and backend suites before making changes:

```bash
# 1. Frontend type checking and unit tests
npm run lint          # runs tsc --noEmit
npm run test          # runs tsx --test src/**/*.test.ts

# 2. Backend unit tests (in-memory isolated tests)
# macOS / Linux
.venv/bin/python -m unittest discover -s backend/tests -v

# Windows
.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

### Safe In-Memory Python Testing
When testing database logic via Python CLI, always use in-memory databases (`:memory:`) to ensure live database files remain untouched:
```python
from backend.core.database import DatabaseManager
db = DatabaseManager(":memory:")
db.init_schema()
print("Schema verified cleanly.")
```

---

## 7. Password Recovery & Decryption CLI

If you need to view or debug your stored IMAP password outside of the UI:
```bash
# macOS / Linux
.venv/bin/python -m backend.cli.decrypt_password

# Windows
.venv\Scripts\python.exe -m backend.cli.decrypt_password
```
Supports optional flags `--db <path>`, `--key-file <path>`, and `--key <fernet_key_string>`.
