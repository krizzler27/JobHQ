#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "  Job Tracker - One-Click Setup"
echo "=========================================="
echo

if ! command -v uv >/dev/null 2>&1; then
  echo "[1/3] Installing uv package manager..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
else
  echo "[1/3] uv is already installed."
fi

echo "[2/3] Installing Python dependencies (FastAPI, Uvicorn, SQLAlchemy, llama-cpp-python CPU wheel)..."
uv sync

echo "[3/3] Installing frontend dependencies & preparing database..."
.venv/bin/python -c "from backend.core.database import DatabaseManager; DatabaseManager().init_schema()"
npm install

echo
echo "Setup complete! Start Job Tracker anytime with:"
echo "  npm run dev"
echo
