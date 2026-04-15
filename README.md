# MTG Tracker

A real-time, multi-device life tracker for Magic: The Gathering Commander.

Each player tracks their own life on their phone, a tablet runs the full controller, and a TV displays the dashboard — all synced through a shared Python backend.

---

## Views

| Route | Description |
|---|---|
| `/` | Home — pick your player or start a new game |
| `/player/:id` | Mobile controller for a single player |
| `/controller` | Full tablet controller for all players |
| `/dashboard` | Read-only TV display |

---

## Features

- Up to 8 players with commander and partner support
- Commander art pulled automatically from Scryfall
- Commander damage tracking with 21-damage elimination
- Life totals update automatically when commander damage is recorded
- Real-time sync across all devices via 1-second polling

---

## API

| Method | Route | Description |
|---|---|---|
| GET | `/state` | Returns full game state |
| POST | `/init` | Start a new game |
| POST | `/update` | Update a player's life total |
| POST | `/commander_damage` | Record commander damage |

---

## Running Locally

### Backend (Python + FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React + Vite)

```bash
cd frontend
nvm use 22 || nvm install 22
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and expects the backend at `http://localhost:8000`.
