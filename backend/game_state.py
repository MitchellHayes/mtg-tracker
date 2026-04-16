import json
import os
from pydantic import BaseModel, Field
from typing import Optional

STATE_FILE = os.path.join(os.path.dirname(__file__), "game_state.json")

class Player(BaseModel):
    id: int = Field(description="1-based player index assigned at game init")
    life: int = Field(description="Current life total")
    name: str = Field(description="Display name")
    colors: list[str] = Field(default=[], description="WUBRG color identity from Scryfall")
    commander: Optional[str] = Field(default=None, description="Commander card name (exact, from Scryfall)")
    commander_image: Optional[str] = Field(default=None, description="Scryfall art_crop URL for the commander")
    partner: Optional[str] = Field(default=None, description="Partner commander card name, if any")
    partner_image: Optional[str] = Field(default=None, description="Scryfall art_crop URL for the partner")
    commander_damage: dict[str, int] = Field(
        default={},
        description="Commander damage received, keyed by source player ID. Normal damage: '{source_id}', partner damage: '{source_id}_p'",
    )
    poison: int = Field(default=0, description="Poison counter total (lethal at 10)")

player_health: dict[int, Player] = {}
current_turn_id: int = 1

def _save():
    with open(STATE_FILE, "w") as f:
        json.dump({
            "players": {k: v.model_dump() for k, v in player_health.items()},
            "current_turn_id": current_turn_id,
        }, f)

def _load():
    global current_turn_id
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE) as f:
            data = json.load(f)
        for k, v in data.get("players", {}).items():
            player_health[int(k)] = Player(**v)
        current_turn_id = data.get("current_turn_id", 1)
    except Exception:
        pass  # corrupt file, start fresh

def initialize_game(player_configs: list[dict], starting_life: int):
    global current_turn_id
    player_health.clear()
    for i, config in enumerate(player_configs):
        player_id = i + 1
        player_health[player_id] = Player(
            id=player_id,
            life=starting_life,
            name=config.get("name", f"Player {player_id}"),
            colors=config.get("colors", []),
            commander=config.get("commander") or None,
            commander_image=config.get("commander_image") or None,
            partner=config.get("partner") or None,
            partner_image=config.get("partner_image") or None,
        )
    current_turn_id = 1
    _save()

def reset_game():
    global current_turn_id
    player_health.clear()
    current_turn_id = 1
    _save()

def get_state():
    return {"players": player_health, "current_turn_id": current_turn_id}

def next_turn():
    global current_turn_id
    ids = sorted(player_health.keys())
    if not ids:
        return current_turn_id
    active_ids = [i for i in ids if player_health[i].life > 0]
    if not active_ids:
        return current_turn_id
    idx = active_ids.index(current_turn_id) if current_turn_id in active_ids else -1
    current_turn_id = active_ids[(idx + 1) % len(active_ids)]
    _save()
    return current_turn_id

def update_player(player_id, delta):
    try:
        player_health[player_id].life += delta
        _save()
        return player_health[player_id]
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def update_poison(player_id: int, delta: int):
    try:
        player = player_health[player_id]
        player.poison = max(0, player.poison + delta)
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def update_commander_damage(target_id: int, source_id: int, delta: int, is_partner: bool = False):
    try:
        player = player_health[target_id]
        key = f"{source_id}_p" if is_partner else str(source_id)
        current = player.commander_damage.get(key, 0)
        player.commander_damage[key] = max(0, current + delta)
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {target_id} does not exist")

_load()
