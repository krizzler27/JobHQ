@echo off
setlocal
echo ==========================================
echo   Job Tracker - One-Click Setup (Windows)
echo ==========================================
echo.

where uv >nul 2>nul
if %errorlevel% neq 0 (
  echo [1/3] Installing uv package manager...
  powershell -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
  set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"
) else (
  echo [1/3] uv is already installed.
)

echo [2/3] Installing Python dependencies (FastAPI, Uvicorn, SQLAlchemy, llama-cpp-python CPU wheel)...
uv sync
if %errorlevel% neq 0 (
  echo Failed to install Python dependencies with uv. Make sure Python 3.10+ is installed.
  pause
  exit /b 1
)

echo [3/3] Preparing local database and frontend...
.venv\Scripts\python.exe -c "from backend.core.database import DatabaseManager; DatabaseManager().init_schema()"
call npm install
if %errorlevel% neq 0 (
  echo Failed to run npm install. Make sure Node.js 18+ is installed.
  pause
  exit /b 1
)

echo.
echo Setup complete! Start Job Tracker anytime by running:
echo   npm run dev
echo.
pause
