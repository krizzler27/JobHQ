@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo           JobHQ Desktop Build Pipeline
echo ===================================================

cd /d "%~dp0"

REM 1. Verify Virtual Environment
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in .venv.
    echo Please run install.bat first.
    exit /b 1
)

REM 2. Run Quality Checks
echo.
echo [1/4] Running Code Quality and Test Suite...
call npm run lint
if errorlevel 1 (
    echo [ERROR] Frontend TypeScript check failed.
    exit /b 1
)

call npm run test
if errorlevel 1 (
    echo [ERROR] Frontend unit tests failed.
    exit /b 1
)

.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
if errorlevel 1 (
    echo [ERROR] Backend unit tests failed.
    exit /b 1
)

REM 3. Package Python Sidecar
echo.
echo [2/4] Packaging Python Desktop Sidecar via PyInstaller...
.venv\Scripts\pyinstaller.exe jobhq_backend.spec --noconfirm --distpath dist_backend
if errorlevel 1 (
    echo [ERROR] PyInstaller failed to build sidecar executable.
    exit /b 1
)

REM 4. Build Vite Frontend
echo.
echo [3/4] Building Vite Production Frontend...
call npm run build
if errorlevel 1 (
    echo [ERROR] Vite build failed.
    exit /b 1
)

REM 5. Bundle Native Tauri App
echo.
echo [4/4] Bundling Native Desktop App via Tauri CLI...
call npm run tauri build
if errorlevel 1 (
    echo [ERROR] Tauri build failed.
    exit /b 1
)

echo.
echo ===================================================
echo [SUCCESS] JobHQ Desktop App built successfully!
echo Installer located in: src-tauri\target\release\bundle\nsis\
echo ===================================================
