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

To solve this cleanly, [backend/desktop.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/desktop.py) acts as a **unified desktop pod**:
- **Central Worker Registry**: [backend/workers/core/registry.py](file:///C:/Disk-S/Projects/Job-Tracker/backend/workers/core/registry.py) acts as the single source of truth (`get_default_workers`) for all background jobs.
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
| **Web Dev** | `npm run dev` | Vite Dev Server (`:3000`) | `server.ts` runs FastAPI (`backend`) & standalone worker (`backend.workers`) | Development mode (Python interpreter with hot reloading) |
| **Desktop Dev** | `npm run tauri:dev` | Vite Dev Server (`:3000`) in WebView2 | Runs `backend.desktop` unified runner (`JOBHQ_DESKTOP_DEV=1`) | Executes identical multi-thread code as the production sidecar |
| **Single-Command Build** | `npm run desktop:build` | Full build & test pipeline | Packages sidecar via PyInstaller and creates installer via Tauri | Self-contained `.exe` installer in `src-tauri/target/release/bundle/nsis/` |

---

## 5. Building the Desktop Application

You can build the entire production desktop application with **one command**:

```bash
# Windows
npm run desktop:build
# (or double-click build-desktop.bat)

# macOS / Linux
./build-desktop.sh
```

This single command automatically:
1. Runs all TypeScript checks (`npm run lint`), frontend tests (`npm run test`), and backend tests (`python -m unittest`).
2. Compiles the Python desktop backend into a standalone native binary in `src-tauri/binaries/` via PyInstaller.
3. Builds the production Vite frontend bundle (`npm run build`).
4. Bundles everything into the native installer (`npm run tauri build`).

Output installer location: `src-tauri/target/release/bundle/nsis/JobHQ_0.1.0_x64-setup.exe`.
