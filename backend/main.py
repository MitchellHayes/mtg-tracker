import asyncio
import json
from pathlib import Path
from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional
import httpx
from game_state import initialize_game, reset_game, get_state, update_player, update_poison, update_commander_damage, next_turn, Player
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(redoc_url=None)

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        message = json.dumps(jsonable_encoder(data))
        for ws in list(self.active):
            try:
                await ws.send_text(message)
            except Exception:
                self.active.remove(ws)

manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_game([{}, {}], 40)

SCRYFALL_NAMED = "https://api.scryfall.com/cards/named"
SCRYFALL_RATE_LIMIT = 0.5  # seconds between /cards/named calls

def extract_art_crop(card: dict) -> Optional[str]:
    """Handle both normal cards and double-faced cards."""
    if "image_uris" in card:
        return card["image_uris"].get("art_crop")
    faces = card.get("card_faces", [])
    if faces and "image_uris" in faces[0]:
        return faces[0]["image_uris"].get("art_crop")
    return None

SCRYFALL_HEADERS = {"User-Agent": "MTGTracker/1.0 (local commander life tracker; mitchellhayes95@outlook.com)"}

async def fetch_card_data(client: httpx.AsyncClient, name: str) -> dict:
    """Returns colors, exact name, and art_crop image URL for a card."""
    try:
        resp = await client.get(SCRYFALL_NAMED, params={"exact": name}, headers=SCRYFALL_HEADERS)
        resp.raise_for_status()
        card = resp.json()
        return {
            "colors": card.get("color_identity", []),
            "name": card.get("name", name),
            "image": extract_art_crop(card),
        }
    except Exception:
        return {"colors": [], "name": name, "image": None}

async def resolve_player_scryfall_data(players: list[dict]) -> list[dict]:
    """Fetch Scryfall data for each player's commander(s), respecting rate limits."""
    results = [{} for _ in players]
    async with httpx.AsyncClient() as client:
        first_call = True
        for i, player in enumerate(players):
            colors: set[str] = set()
            commander_name = player.get("commander")
            partner_name = player.get("partner")
            commander_image = None
            partner_image = None

            if commander_name:
                if not first_call:
                    await asyncio.sleep(SCRYFALL_RATE_LIMIT)
                first_call = False
                data = await fetch_card_data(client, commander_name)
                colors.update(data["colors"])
                commander_name = data["name"]
                commander_image = data["image"]

            if partner_name:
                if not first_call:
                    await asyncio.sleep(SCRYFALL_RATE_LIMIT)
                first_call = False
                data = await fetch_card_data(client, partner_name)
                colors.update(data["colors"])
                partner_name = data["name"]
                partner_image = data["image"]

            results[i] = {
                "colors": sorted(colors, key=lambda c: "WUBRG".index(c) if c in "WUBRG" else 5),
                "commander": commander_name,
                "commander_image": commander_image,
                "partner": partner_name,
                "partner_image": partner_image,
            }
    return results

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    await ws.send_text(json.dumps(jsonable_encoder(get_state())))
    try:
        while True:
            await ws.receive_text()  # keep alive; client doesn't send anything
    except WebSocketDisconnect:
        manager.disconnect(ws)

class GameState(BaseModel):
    players: dict[int, Player]
    current_turn_id: int = Field(description="Player ID whose turn it currently is")

class NextTurnResponse(BaseModel):
    current_turn_id: int = Field(description="Player ID whose turn it now is")

@app.post("/reset")
async def reset_game_endpoint():
    """End the current game, clearing all state. Broadcasts the empty state to all clients."""
    reset_game()
    await manager.broadcast(get_state())
    return {}

@app.get("/state", response_model=GameState)
def get_game_state():
    """Return the full current game state."""
    return get_state()

@app.post("/next_turn", response_model=NextTurnResponse)
async def advance_turn():
    """Advance the turn to the next living player (life > 0), cycling in player ID order."""
    result = {"current_turn_id": next_turn()}
    await manager.broadcast(get_state())
    return result

class PlayerConfig(BaseModel):
    name: Optional[str] = Field(default=None, description="Player display name (defaults to 'Player N')")
    commander: Optional[str] = Field(default=None, description="Commander card name — looked up on Scryfall for art and color identity")
    partner: Optional[str] = Field(default=None, description="Partner commander card name, if applicable")

class InitRequest(BaseModel):
    players: list[PlayerConfig] = Field(description="List of players (1–8)")
    starting_life: int = Field(description="Starting life total for all players (typically 40 for Commander)")

@app.post("/init", response_model=GameState)
async def init_game(request: InitRequest):
    """
    Start a new game. Resets all state and fetches commander art and color identity from
    Scryfall for each player. Broadcasts the new state to all connected WebSocket clients.
    """
    player_dicts = [p.model_dump() for p in request.players]
    scryfall_data = await resolve_player_scryfall_data(player_dicts)
    for i, data in enumerate(scryfall_data):
        player_dicts[i].update(data)
    initialize_game(player_dicts, request.starting_life)
    state = get_state()
    await manager.broadcast(state)
    return state

class UpdateRequest(BaseModel):
    player_id: int = Field(description="ID of the player to update")
    delta: int = Field(description="Amount to add to life total (negative to decrease)")

@app.post("/update", response_model=Player)
async def update_game_state(request: UpdateRequest):
    """Update a player's life total by a delta. Returns the updated player."""
    try:
        update_player(request.player_id, request.delta)
        state = get_state()
        await manager.broadcast(state)
        return state["players"][request.player_id]
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

class PoisonRequest(BaseModel):
    player_id: int = Field(description="ID of the player to update")
    delta: int = Field(description="Amount to add to poison counters (negative to decrease, floored at 0)")

@app.post("/poison", response_model=Player)
async def update_poison_endpoint(request: PoisonRequest):
    """Update a player's poison counter by a delta. Returns the updated player."""
    try:
        update_poison(request.player_id, request.delta)
        state = get_state()
        await manager.broadcast(state)
        return state["players"][request.player_id]
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

class CommanderDamageRequest(BaseModel):
    target_id: int = Field(description="ID of the player receiving commander damage")
    source_id: int = Field(description="ID of the player dealing commander damage")
    delta: int = Field(description="Amount of commander damage to add (negative to decrease, floored at 0)")
    is_partner: bool = Field(default=False, description="If true, damage is tracked under the partner commander")

@app.post("/commander_damage", response_model=Player)
async def update_commander_damage_endpoint(request: CommanderDamageRequest):
    """
    Record commander damage dealt from one player to another. Damage is tracked separately
    per source (and per partner). Life total adjustment and elimination logic are handled
    by the frontend. Returns the updated target player.
    """
    try:
        update_commander_damage(request.target_id, request.source_id, request.delta, request.is_partner)
        state = get_state()
        await manager.broadcast(state)
        return state["players"][request.target_id]
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

# Serve built frontend — must come after all API routes
DIST = Path(__file__).parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file = DIST / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
