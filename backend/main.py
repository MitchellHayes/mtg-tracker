import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from game_state import initialize_game, get_state, update_player, update_poison, update_commander_damage, next_turn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

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

@app.get("/state")
def get_game_state():
    return get_state()

@app.post("/next_turn")
def advance_turn():
    return {"current_turn_id": next_turn()}

class PlayerConfig(BaseModel):
    name: Optional[str] = None
    commander: Optional[str] = None
    partner: Optional[str] = None

class InitRequest(BaseModel):
    players: list[PlayerConfig]
    starting_life: int

@app.post("/init")
async def init_game(request: InitRequest):
    player_dicts = [p.model_dump() for p in request.players]
    scryfall_data = await resolve_player_scryfall_data(player_dicts)
    for i, data in enumerate(scryfall_data):
        player_dicts[i].update(data)
    initialize_game(player_dicts, request.starting_life)
    return get_state()

class UpdateRequest(BaseModel):
    player_id: int
    delta: int

@app.post("/update")
def update_game_state(request: UpdateRequest):
    try:
        return update_player(request.player_id, request.delta)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

class PoisonRequest(BaseModel):
    player_id: int
    delta: int

@app.post("/poison")
def update_poison_endpoint(request: PoisonRequest):
    try:
        return update_poison(request.player_id, request.delta)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

class CommanderDamageRequest(BaseModel):
    target_id: int
    source_id: int
    delta: int
    is_partner: bool = False

@app.post("/commander_damage")
def update_commander_damage_endpoint(request: CommanderDamageRequest):
    try:
        return update_commander_damage(request.target_id, request.source_id, request.delta, request.is_partner)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
