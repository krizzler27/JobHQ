# Desktop Architecture & Sidecar Topology

> **Guide for JobHQ Desktop**: Explains how the React frontend, Python backend, and Tauri v2 native desktop shell are orchestrated into a self-contained, high-performance desktop application.

---

## 1. Overview & Kubernetes Analogy

JobHQ was architecturally designed with a decoupled **3-tier execution model**:
- **Frontend**: High-density React 19 SPA running in WebKit / WebView2.
- **Web API**: FastAPI handling REST endpoints on port 3001.
- **Worker Daemon**: `WorkerRunner` running a 15-second tick loop evaluating 7 automated background jobs.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Kubernetes Analogy vs JobHQ                       │
 ├───────────────────────────────────┬────────────────────────────────────┤
 │ Kubernetes Production Topology    │ JobHQ Local Desktop Packaging      │
 ├───────────────────────────────────┼────────────────────────────────────┤
 │ - Frontend Ingress / Service      │ - Tauri v2 Native Window Shell     │
 │ - Backend API Pod (FastAPI)       │ - Thread 1: FastAPI Uvicorn Server │
 │ - Worker Pod (Scheduled Cron)     │ - Thread 2: WorkerRunner Daemon    │
 │ - Shared PVC Volume (SQLite WAL)  │ - Shared Local DB (~/.jobhq/data)  │
 └───────────────────────────────────┴────────────────────────────────────┘
```

On a user's desktop, running two separate OS processes (`jobhq-api.exe` and `jobhq-worker.exe`) creates operational issues: dual process trees, orphaned background processes on window close, and complex IPC monitoring.

To solve this cleanly, [desktop_entry.py](file:///C:/Disk-S/Projects/Job-Tracker/desktop_entry.py) acts as a **unified desktop pod**:
- **Main Thread**: Runs the Uvicorn ASGI server serving the FastAPI REST API on loopback `127.0.0.1:3001`.
- **Background Daemon Thread**: Runs `WorkerRunner` with cooperative 1-second interruptible sleep steps so workers never block API responsiveness or desktop shutdown.

---

## 2. Process Architecture & Lifecycles

```text
+-------------------------------------------------------------------------------+
|                      Tauri v2 Desktop Application                             |
|  - Window Manager: Frameless Studio Window (decorations: false)               |
|  - Desktop TitleBar: Drag Region, Brand Mark, Minimize, Maximize/Restore, Close|
|  - Webview: Microsoft Edge WebView2 (Windows) / WebKit (macOS / Linux)        |
+---------------------------------------+---------------------------------------+
                                        |
                 Spawns & Supervises (tauri-plugin-shell)
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                 Python Native Sidecar (`jobhq-backend.exe`)                    |
|                      Compiled via PyInstaller (6.22+)                         |
|                                                                               |
|   +------------------------------------+  +--------------------------------+  |
|   | Thread 1: FastAPI Web API (:3001)  |  | Thread 2: Worker Daemon (15s)  |  |
|   | - REST endpoints & schemas         |  | - 7 Automated hygiene workers  |  |
|   | - Dynamic report generation        |  | - Persistent interval checks   |  |
|   +-----------------+------------------+  +----------------+---------------+  |
|                     |                                      |                  |
|                     +------------------+-------------------+                  |
+----------------------------------------|--------------------------------------+
                                         |
                       Concurrent SQLite Access (WAL Mode)
                                         v
                         +-------------------------------+
                         |      ~/.jobhq/data/jobhq.db   |
                         |    PRAGMA journal_mode=WAL    |
                         |    PRAGMA busy_timeout=15000  |
                         +-------------------------------+
```

---

## 3. Component Details

### A. Frontend Window Shell & Titlebar
- **Location**: [src/components/DesktopTitleBar.tsx](file:///C:/Disk-S/Projects/Job-Tracker/src/components/DesktopTitleBar.tsx) & [src-tauri/tauri.conf.json](file:///C:/Disk-S/Projects/Job-Tracker/src-tauri/tauri.conf.json)
- **Frameless Configuration**: `"decorations": false` removes the native OS bar, allowing our Studio Alabaster aesthetic to run edge-to-edge.
- **Draggable Region**: Marked with `data-tauri-drag-region`, letting the user grab anywhere along the 36px top bar to move the window.
- **Window Controls**: Minimize, Maximize/Restore, and Close buttons invoke native window methods via `@tauri-apps/api/window` (`getCurrentWindow().minimize()`, etc.).
- **Auto-Detection**: Only renders when running inside Tauri (`isTauriEnvironment()`), rendering nothing in browser mode so `npm run dev` stays 100% web-compatible.
- **Fixed Layout**: Locked to `h-screen w-screen overflow-hidden` so the sidebar and bottom Gmail connection box never scroll off-screen.

### B. Python Sidecar Packaging (PyInstaller)
- **Specification**: [jobhq_backend.spec](file:///C:/Disk-S/Projects/Job-Tracker/jobhq_backend.spec)
- **Output Target**: `src-tauri/binaries/jobhq-backend-<target-triple>.exe` (e.g. `jobhq-backend-x86_64-pc-windows-msvc.exe`)
- **Included Packages**:
  - FastAPI, Starlette, Uvicorn (ASGI HTTP stack)
  - SQLAlchemy SQLite Dialects (Database persistence)
  - Cryptography & Fernet (Credential security at rest)
  - Pydantic & Pydantic-Settings (Strongly-typed runtime config)
- **Self-Contained**: The frozen binary contains its own embedded Python runtime and prebuilt C extensions. End users do not need Python, Node.js, or visual C++ compilers installed.

### C. Tauri Sidecar Supervision
- **Rust Entrypoint**: [src-tauri/src/lib.rs](file:///C:/Disk-S/Projects/Job-Tracker/src-tauri/src/lib.rs)
- **Tauri Plugin**: `tauri-plugin-shell` declared in `Cargo.toml`.
- **Execution Hook**:
  ```rust
  let sidecar_command = app.shell().sidecar("jobhq-backend");
  if let Ok(cmd) = sidecar_command {
      let _ = cmd.spawn(); // Starts Python sidecar on app launch
  }
  ```
- **Process Lifecycle Guard**: When the Tauri application window is closed or killed, the OS process group is torn down, preventing orphaned Python background processes from persisting in Task Manager.

---

## 4. Development vs Production Workflows

| Mode | Command | Frontend | Backend | Sidecar Status |
| :--- | :--- | :--- | :--- | :--- |
| **Web Dev** | `npm run dev` | Vite Dev Server (`:3000`) | `server.ts` supervises `.venv` Python child processes | Not used (hot-reloading via Python interpreter) |
| **Desktop Dev** | `npm run tauri:dev` | Vite Dev Server (`:3000`) in WebView2 | Runs sidecar if built, or uses running dev backend | Hot reload frontend; native desktop controls active |
| **Production Build** | `npm run tauri build` | Built `./dist` assets bundled in webview | Frozen binary in `src-tauri/binaries` | Bundled directly into `.msi` / `.exe` installer |

---

## 5. Rebuilding the Python Sidecar

When backend models, routes, or workers are updated, recompile the sidecar executable with one command:

```powershell
uv run pyinstaller --distpath src-tauri/binaries --workpath build jobhq_backend.spec
```

The output binary is automatically placed into `src-tauri/binaries/jobhq-backend-x86_64-pc-windows-msvc.exe` and bundled on the next `npm run tauri build`.
