# Desktop Architecture & Packaging

This document outlines the architecture, packaging model, and operational characteristics of JobHQ's native desktop application.

---

## 1. Process Model & Architecture

JobHQ desktop is packaged with [Tauri v2](https://v2.tauri.app/) and embeds a Python FastAPI + background worker sidecar backend.

```text
┌────────────────────────────────────────────────────────┐
│                   JobHQ Desktop App                    │
│                                                        │
│  ┌───────────────────────┐   HTTP / REST (port 3001)   │
│  │   Tauri WebView2 UI   │ ◄─────────────────────────► │
│  │ (http://tauri.localhost)                            │
│  └───────────────────────┘                             │
│              │                                         │
│              │ (Lifecycle Supervision)                 │
│              ▼                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Rust App Core (src-tauri/src/lib.rs)             │ │
│  │  - Spawns backend on startup                      │ │
│  │  - Direct child.kill() on exit                    │ │
│  └───────────────────────────────────────────────────┘ │
│              │ std::process::Command                   │
│              ▼ (CREATE_NO_WINDOW)                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │  jobhq-backend (PyInstaller onedir distribution)  │ │
│  │  - FastAPI web server (port 3001)                 │ │
│  │  - Cooperative background worker thread (15s tick)│ │
│  │  - SQLite WAL database (~/.jobhq/data/jobhq.db)   │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 2. Why Onedir Packaging (vs Onefile)

Previously, the backend was packaged as a PyInstaller `--onefile` standalone binary. 

Under Tauri release builds on Windows:
- Spawning `--onefile` windowless (`CREATE_NO_WINDOW`) caused the PyInstaller self-extracting bootloader process to hang silently before unpacking to `%TEMP%/_MEI*`.
- Port 3001 was never bound, causing webview requests to fail with `net::ERR_CONNECTION_REFUSED`.
- While the exact root cause in the PyInstaller onefile bootloader under handle redirection/windowless creation flags is an upstream quirk, switching to PyInstaller `--onedir` completely bypasses the temporary extraction step and intermediate bootloader hop.

### Onedir Advantages
1. **Immediate Execution**: Pre-extracted binary starts in <1 second without disk decompression overhead.
2. **Direct Supervision**: The spawned process is the actual Python interpreter/server process, eliminating intermediate child PID lookups or complex process-tree termination hacks (`taskkill /T`).
3. **Deterministic Resources**: Assets, shared DLLs, and site-packages reside in a known directory relative to the executable.

---

## 3. Tauri Resource Bundling & Lifecycle

### Bundling Configuration
In `jobhq_backend.spec`, PyInstaller produces a distribution directory `dist_backend/jobhq-backend/`.

In `src-tauri/tauri.conf.json`:
```json
"bundle": {
  "resources": {
    "../dist_backend/jobhq-backend": "jobhq-backend"
  }
}
```
When Tauri compiles the installer, the entire directory is placed into the application's installed resources:
- Build/Dev location: `src-tauri/target/release/resources/jobhq-backend/`
- Installed location: `C:\Users\<user>\AppData\Local\JobHQ\resources\jobhq-backend\`

### Process Spawn & Clean Shutdown
In `src-tauri/src/lib.rs`:
- Resolves `app.path().resolve("jobhq-backend", BaseDirectory::Resource)`.
- Spawns `jobhq-backend.exe` (Windows) or `jobhq-backend` (Unix) with `Stdio::null()` for stdin/stdout/stderr to prevent unread pipe buffer deadlocks.
- On Windows, passes `CREATE_NO_WINDOW (0x08000000)` via `CommandExt::creation_flags`.
- On application exit (`RunEvent::Exit`), calls `child.kill()` followed by `child.wait()`.

---

## 4. Building & Running

### Full Desktop Build
To compile the Python backend onedir distribution, build the Vite frontend, and package the NSIS installer:
```bash
npm run desktop:build
```
This runs:
1. `python -m PyInstaller jobhq_backend.spec --noconfirm --distpath dist_backend`
2. `tauri build`

The final NSIS installer is generated at:
`src-tauri/target/release/bundle/nsis/JobHQ_0.1.0_x64-setup.exe`

---

## 5. Logs & Diagnostic Verification

### Log Locations
- **Python Backend & Uvicorn**:
  `%USERPROFILE%\.jobhq\logs\jobhq.log`
  Contains uvicorn startup banners, requests, errors, and worker tick logs.
- **Rust Sidecar Lifecycle**:
  `%USERPROFILE%\.jobhq\logs\rust-sidecar.log`
  Contains backend resource resolution, process spawn events, and termination logs (capped at 5MB with auto-rotation).

### Remote Debugging Release Builds (CDP)
Release builds do not ship with DevTools enabled. To verify or inspect a packaged build without rebuilding:
1. Launch the executable with WebView2 remote debugging enabled:
   ```powershell
   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
   & "$env:LOCALAPPDATA\JobHQ\app.exe"
   ```
2. Run the automated CDP test script:
   ```bash
   node scripts/debug/cdp_test.js
   ```
   This script connects over WebSocket to Chrome DevTools Protocol on port 9222, evaluates `fetch('http://127.0.0.1:3001/api/dashboard')` inside the webview context, and logs the HTTP status and response.

---

## 6. Portability & Follow-up Recommendations

1. **Cross-Platform Compilation**:
   - PyInstaller distributions are OS-specific. Building for macOS or Linux requires running PyInstaller and Tauri build on their respective operating systems.
   - The Rust sidecar spawn code uses `#[cfg(target_os = "windows")]` conditionals for Windows-specific flags (`CREATE_NO_WINDOW`, `.exe` extension) and falls back to standard POSIX conventions for macOS and Linux.
2. **Orphan Process Protection**:
   - **Windows (Fixed)**: On Windows, the spawned backend sidecar process is assigned to an NT Job Object configured with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` immediately after spawn. If `app.exe` crashes, terminates abnormally, or is force-killed (e.g., via Task Manager "End Task" or `taskkill /F`), the Windows kernel automatically terminates all processes in the job object immediately, preventing orphaned `jobhq-backend.exe` processes and freeing port 3001. The job handle is retained in managed `SidecarState` for the app's lifetime.
   - **macOS & Linux (Not Handled Yet)**: On POSIX systems, a process killed abruptly (e.g. `SIGKILL`) does not execute user-space cleanup and orphans child processes, reparenting them to init/systemd. Options for follow-up include using `PR_SET_PDEATHSIG` on Linux, or implementing a stdin-EOF watcher in the backend sidecar that terminates the server when the parent closes the piped stdin handle (which works across both macOS and Linux).
3. **Database Schema Migrations (Follow-up)**:
   - Currently, schema initialization relies on `Base.metadata.create_all(..., checkfirst=True)` which is idempotent and safe for existing tables.
   - Before public releases with evolving database schemas, integrate an automated migration tool (such as Alembic) for non-additive column alterations.
