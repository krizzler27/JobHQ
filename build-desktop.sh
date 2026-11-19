#!/usr/bin/env bash
set -e

echo "==================================================="
echo "          JobHQ Desktop Build Pipeline             "
echo "==================================================="

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# 1. Verify Virtual Environment
if [ ! -f ".venv/bin/python" ]; then
    echo "[ERROR] Python virtual environment not found in .venv."
    echo "Please run ./install.sh first."
    exit 1
fi

# 2. Run Quality Checks
echo ""
echo "[1/4] Running Code Quality and Test Suite..."
npm run lint
npm run test
.venv/bin/python -m unittest discover -s backend/tests -v

# 3. Package Python Sidecar
echo ""
echo "[2/4] Packaging Python Desktop Sidecar via PyInstaller..."
.venv/bin/pyinstaller jobhq_backend.spec --noconfirm

# Determine target triple
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
mkdir -p src-tauri/binaries

if [ "$OS" = "darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        TRIPLE="aarch64-apple-darwin"
    else
        TRIPLE="x86_64-apple-darwin"
    fi
else
    TRIPLE="x86_64-unknown-linux-gnu"
fi

cp -f dist/jobhq-backend-$TRIPLE "src-tauri/binaries/jobhq-backend-$TRIPLE"

# 4. Build Vite Frontend
echo ""
echo "[3/4] Building Vite Production Frontend..."
npm run build

# 5. Bundle Native Tauri App
echo ""
echo "[4/4] Bundling Native Desktop App via Tauri CLI..."
npm run tauri build

echo ""
echo "==================================================="
echo "[SUCCESS] JobHQ Desktop App built successfully!"
echo "==================================================="
