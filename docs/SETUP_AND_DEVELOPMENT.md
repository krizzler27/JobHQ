# Setup, Configuration & Development Guide

This guide covers everything needed after cloning the repository: installation, environment variables, email provider setup, scan filters, backup/restore, and local development/testing.

---

## 1. Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- *(Optional)* **Git** and **`uv`** (automatically installed by `install.sh` / `install.bat` if missing)

---

## 2. Installation Options

### Option A: One-Step Installer (Recommended)
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
1. Ensure `uv` is installed and run `uv sync` (creates `.venv` and installs FastAPI, Uvicorn, SQLAlchemy, `cryptography`, and prebuilt CPU wheels for `llama-cpp-python`).
2. Initialize `data/job_tracker.db`.
3. Run `npm install`.

### Option B: Manual Setup via `uv`
```bash
# 1. Sync Python virtual environment & dependencies
uv sync

# 2. Initialize SQLite schema
.venv/bin/python -c "from backend.core.database import DatabaseManager; DatabaseManager().init_schema()"

# 3. Install frontend packages
npm install
```

---

## 3. Configuration & Local Storage

All mailbox credentials, search filters, and application preferences are managed directly through the web UI and persisted in `data/job_tracker.db` with zero `.env` files required:

- **Email Credentials**: Configured via the Setup Wizard or Settings modal and stored with Fernet AES-128 encryption.
- **Provider Hosts**: Presets for Gmail, Outlook, and Yahoo are built-in automatically.
- **Optional System Environment Variables**:
  - `HOST`: Bind address for Express (`127.0.0.1` by default).
  - `PY_BACKEND_PORT`: Internal FastAPI port (`3001` by default).
  - `JOB_TRACKER_KEY`: Optional custom Fernet key overriding `data/.secret.key`.

---

## 4. Connecting Your Email (App Passwords & Multi-Folder Sync)

Because standard password logins are disabled by major providers for IMAP, generate an **App Password**:
- **Gmail:** Enable 2-Step Verification in Google Account Security → search **App passwords** → create one for *Mail* (16 characters, spaces optional). Make sure IMAP is enabled in Gmail Settings → *Forwarding and POP/IMAP*.
- **Outlook / Hotmail:** Microsoft Account Security → *Advanced security options* → *Create a new app password* (if 2FA is active). Host: `outlook.office365.com:993`.
- **Yahoo Mail:** Yahoo Account Security → *Generate app password*. Host: `imap.mail.yahoo.com:993`.

Inside **Connect Email** (or Quick Setup Step 1), click **Load My Folders** to pick multiple folders or Gmail labels at once.

---

## 5. Customizing Scan Filters & Auto-Sync

### Scan Keywords (`Settings → Email Scan Filters` or Quick Setup Step 4)
Before downloading full message bodies, IMAP searches headers using:
1. **Subject Keywords to Scan** (combined with your **Target Job Titles** & **Skills**)
2. **Sender & Domain Keywords to Scan** (plus companies currently in your Applications list)
3. **Skip / Noise Words (Always Ignore)** — drops any message whose sender or subject contains a blocked term.

**Tip:** Whenever non-job mail slips into Applications, Interviews, or Job Alerts, use **Filter Non-Career Email** directly on that item to add its sender, domain, or subject words to **Skip / Noise Words** and optionally delete the item. After changing keywords, click **Force Re-scan** in the **Scanned Emails** tab to re-evaluate recent messages.

### Auto-Sync Schedule (Unix Cron)
Enable **Auto-Sync** in **Settings** using either quick templates (`Every 30 min`, `Every 4 hours`, `Daily 9 AM`, `Weekdays 9–6 (2h)`) or any 5-field Unix cron expression (`minute hour day month weekday`). Auto-sync runs automatically whenever `npm run dev` / `npm start` is active.

---

## 6. Local Data, Encryption & Backups

- **Database file:** `data/job_tracker.db`
- **Encryption key:** `data/.secret.key` (`0600` permissions; never commit `data/` to Git).
- **Decrypting a saved password locally:**
  ```bash
  .venv/bin/python -m backend.cli.decrypt_password
  # Optional flags: --db path/to/db --key-file path/to/key --key <fernet_key>
  ```
- **Backups (`Settings → Data Backup & Restore`):**
  - **Export JSON:** Downloads a secret-free `.json` archive of applications, interviews, job alerts, and profile/scan preferences. Restorable in **Merge** mode (adds missing items safely) or **Replace** mode.
  - **Download `.db`:** Downloads an atomic SQLite snapshot of `data/job_tracker.db`.

---

## 7. Development & Verification Commands

| Task | Command | Notes |
| :--- | :--- | :--- |
| Start dev server | `npm run dev` | Starts FastAPI (`:3001`) + Express/Vite (`:3000`). |
| TypeScript check | `npm run lint` | Runs `tsc --noEmit`. |
| Production build | `npm run build` | Builds frontend assets to `dist/`. |
| Start production build | `npm start` | Serves `dist/` via Express + FastAPI backend. |
| Backend unit tests | `.venv/bin/python -m unittest discover -s backend/tests -v` | Runs isolated `:memory:` tests cleanly. |

### Safe Backend Testing (Without Touching `data/job_tracker.db`)
Always pass `":memory:"` (never `"sqlite:///:memory:"`) to `DatabaseManager` when running ad-hoc Python checks so your live SQLite database remains untouched:

```bash
.venv/bin/python -c "
from backend.core.database import DatabaseManager
db = DatabaseManager(':memory:')
db.init_schema()
print('In-memory schema OK')
"
```
