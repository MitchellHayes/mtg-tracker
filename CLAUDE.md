# CLAUDE.md

## Commands

### Frontend
```bash
cd frontend
npm run dev       # Dev server on localhost:5173
npm run build     # Production build to /dist
npm run lint      # ESLint
```

### Backend
```bash
cd backend
source ../.venv/bin/activate   # or .venv/bin/activate if inside backend
uvicorn main:app --reload      # Dev server on localhost:8000
```

### Production
```bash
bash start.sh   # Installs deps, builds frontend, starts backend on 0.0.0.0:8000
```

## Architecture

Full-stack app: React SPA frontend + FastAPI backend with real-time WebSocket sync.

### Data flow
All game mutations go through a REST endpoint → backend updates in-memory state → broadcasts full game state over WebSocket to all connected clients → frontend `useGameState` hook updates React state. Life totals and elimination are owned by the backend: poison ≥ 10 and commander damage ≥ 21 set life to 0, and commander damage subtracts from life, all applied atomically before the broadcast.

State persists to `backend/game_state.db` (SQLite, `INSERT OR REPLACE` on a single row). Auto-loaded on startup. Migrates from legacy `game_state.json` if DB doesn't exist yet.

### Backend (`backend/`)
- `main.py` — FastAPI app. REST endpoints listed below. WebSocket at `/ws`. Also serves the built frontend as static files.
- `game_state.py` — In-memory state: `player_health` dict, `current_turn_id`, `monarch_id`, `initiative_id`, `day_night`, `turn_started_at`. Pydantic `Player` model. Single module-level SQLite connection (`_conn`). Call `_save()` after any mutation.
  - `update_player` auto-transfers Monarch/Initiative to the active player when a player is eliminated (life ≤ 0).
  - `update_player` auto-increments the active player's speed once per turn when they deal damage to an opponent; gated by `speed_increased_this_turn`.
  - `update_counter` sets `speed_increased_this_turn = True` on any manual speed increase to prevent double-increment.
  - `next_turn` resets `speed_increased_this_turn = False` for all players.
- Scryfall API called during `/init`; rate-limited to one call per 0.5s.

**REST endpoints:**
- `POST /init` — Start game, fetch Scryfall data for commanders
- `GET /state` — Read current game state
- `POST /update` — Adjust a player's life total
- `POST /poison` — Adjust poison counters (floor 0)
- `POST /commander_damage` — Record commander damage (per source, with partner flag)
- `POST /counter` — Adjust energy/rad/speed counters (speed capped at 4)
- `POST /next_turn` — Advance to next living player
- `POST /monarch` — Set/clear Monarch token
- `POST /initiative` — Set/clear Initiative
- `POST /day_night` — Set day/night state (`"day"`, `"night"`, or null)
- `POST /reset` — Clear all state

### Frontend (`frontend/src/`)
- **Routes:** `/` (Home), `/dashboard` (Dashboard — TV/spectator view), `/player/:id` (PlayerController)
- **`hooks/useGameState.js`** — WebSocket connection with 2-second reconnect backoff. Returns `{ gameState, setGameState, currentTurnId, setCurrentTurnId, connected }`.
- **`api/`** — One file per endpoint, all use `API_URL` from `config.js` (set via `VITE_API_URL` env var, defaults to `window.location.origin`).
- **Dashboard** is a read-only spectator screen — no interactive elements. QR code shows `window.location.origin` so people can scan to join.

### Key conventions
- Player IDs are 1-based integers.
- Commander damage keys: `"{source_id}"` for normal commander, `"{source_id}_p"` for partner.
- CSS uses custom properties defined in `index.css` (--bg-base, --gold, --crimson-bright, --text-muted, etc.).
- `QRWidget` encodes `window.location.origin` — used only on Dashboard.
