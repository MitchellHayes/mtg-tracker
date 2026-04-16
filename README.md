# MTG Tracker

A real-time, multi-device life tracker for Magic: The Gathering Commander.

Each player tracks their own life on their phone and a TV displays the dashboard — all synced through a shared Python backend via WebSocket.

---

## Views

| Route | Description |
|---|---|
| `/` | Home — pick your player or start a new game |
| `/player/:id` | Mobile controller for a single player |
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
- Real-time sync across all devices via WebSocket (2-second reconnect backoff)
- **Day/Night state machine** — tracks Innistrad Day/Night cycle; prompted at end of each turn
- **Monarch token** — crown a player; auto-transfers to the active player when the Monarch is eliminated
- **Initiative token** — track who holds the Initiative; auto-transfers on elimination
- **Energy, Rad, and Speed counters** per player (Aetherdrift racing mechanics)
  - Speed auto-increments once per turn when the active player deals damage to an opponent (capped at 4)
  - Manual speed adjustments consume the auto-increment for that turn
- **End-of-turn checklist** — prompted before passing, with per-item Skip support and a Rad life-loss calculator
- **Elimination handling** — token buttons are disabled for eliminated players; Monarch/Initiative auto-transfer to the active player on death

---

## API

Interactive docs are available at `/docs` (Swagger UI) when the backend is running.

| Method | Route | Description |
|---|---|---|
| WS | `/ws` | WebSocket — broadcasts full game state to all clients on any change |
| GET | `/state` | Returns full game state |
| POST | `/init` | Start a new game |
| POST | `/update` | Update a player's life total |
| POST | `/commander_damage` | Record commander damage |
| POST | `/poison` | Update a player's poison counters |
| POST | `/next_turn` | Advance to the next living player's turn |
| POST | `/reset` | Clear all game state |
| POST | `/monarch` | Set or clear the Monarch token |
| POST | `/initiative` | Set or clear the Initiative token |
| POST | `/day_night` | Set Day/Night state (`"day"`, `"night"`, or `null`) |
| POST | `/counter` | Update an energy, rad, or speed counter for a player |

---

## Running Locally (dev)

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

The frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:8000`.

---

## Running in LXC (or any server)

Everything is served from a single port. The frontend is built to static files and served by the FastAPI backend.

### Requirements

- Python 3.11+
- Node.js 22+

### Setup

```bash
# Inside the container
git clone <repo-url> mtg-tracker
cd mtg-tracker
bash start.sh
```

`start.sh` installs dependencies, builds the frontend, and starts the server on `http://0.0.0.0:8000`.

All devices on your network can then reach the app at `http://<container-ip>:8000`.

### Running as a systemd service

```ini
[Unit]
Description=MTG Tracker
After=network.target

[Service]
WorkingDirectory=/opt/mtg-tracker/backend
ExecStartPre=/bin/bash -c 'cd /opt/mtg-tracker/frontend && npm run build'
ExecStart=/opt/mtg-tracker/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
