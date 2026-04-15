#!/bin/bash
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building frontend..."
cd "$REPO/frontend"
npm install
npm run build

echo "==> Starting backend..."
cd "$REPO/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000
