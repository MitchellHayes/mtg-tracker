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

- Up to 8 players with commander and optional partner support
- Commander (and partner) art pulled automatically from Scryfall
- Crossfading split art on the dashboard for partner commanders
- Commander damage tracking per source with 21-damage lethal threshold
- Poison counter tracking with 10-counter lethal threshold
- Turn order tracking with active turn indicator across all views
- Long-press life buttons to change life in increments of 5
- In-app card lookup — search any Magic card by name and view its art, set, and rarity
- Real-time sync across all devices via 1-second polling

---

## API

| Method | Route | Description |
|---|---|---|
| GET | `/state` | Returns full game state |
| POST | `/init` | Start a new game |
| POST | `/update` | Update a player's life total |
| POST | `/commander_damage` | Record commander damage |
| POST | `/poison` | Update a player's poison counters |
| POST | `/next_turn` | Advance to the next living player's turn |

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
