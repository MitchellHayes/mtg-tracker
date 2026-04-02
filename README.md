# 🛡️ MTG Command Center

A real-time, multi-device life tracker for Magic: The Gathering.

Track life totals for up to 8 players from a central tablet controller while broadcasting a high-visibility dashboard to a TV.

---

## 🚀 The Vision

- **Single source of truth** — A Python (FastAPI) backend manages all game state
- **Tablet controller** — Large touch targets for updating player stats
- **TV dashboard** — High-contrast, read-only 2×4 grid visible to the whole table
- **Real-time sync** — Polling every second (MVP), WebSockets planned for v2.0

---

## 📡 API

| Method | Route     | Description                  |
|--------|-----------|------------------------------|
| GET    | `/state`  | Returns all player life totals |
| POST   | `/update` | Updates a player's life total  |

### POST /update body
```json
{
  "player_id": 1,
  "delta": -1
}
```

---

## 🖥️ Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---