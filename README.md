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

### 🐍 Backend (Python + FastAPI)

We use a **Python Virtual Environment** to keep dependencies isolated and avoid conflicts with Homebrew's system Python.

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate the virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
   *(You should see `(venv)` appear in your terminal prompt)*

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the development server:**
   ```bash
   uvicorn main:app --reload
   ```

> **Note:** Type `deactivate` to exit the environment when finished.

---

### 📦 Frontend (React + Vite)

The frontend requires a modern version of Node.js to support Vite's latest features.

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Ensure the correct Node version is active:**
   ```bash
   nvm use 22 || nvm install 22
   ```

3. **Install packages:**
   ```bash
   npm install
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

---