#!/bin/bash
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"

echo "==> Stopping app..."
systemctl stop mtg-tracker

echo "==> Pulling latest..."
cd "$REPO"
git checkout -- frontend/package-lock.json backend/game_state.db 2>/dev/null || true
git pull

echo "==> Building frontend..."
cd "$REPO/frontend"
npm install
npm run build

echo "==> Installing backend deps..."
cd "$REPO/backend"
source .venv/bin/activate
pip install -r requirements.txt -q

echo "==> Starting app..."
systemctl start mtg-tracker

echo "==> Done."
