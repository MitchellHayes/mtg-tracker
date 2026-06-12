import sqlite3
import json
import os
import time
from pydantic import BaseModel, Field
from typing import Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "game_state.db")
# Keep JSON fallback path for one-time migration
_JSON_FILE = os.path.join(os.path.dirname(__file__), "game_state.json")

class Player(BaseModel):
    id: int = Field(description="1-based player index assigned at game init")
    life: int = Field(description="Current life total")
    name: str = Field(description="Display name")
    colors: list[str] = Field(default=[], description="WUBRG color identity from Scryfall")
    commander: Optional[str] = Field(default=None)
    commander_image: Optional[str] = Field(default=None)
    partner: Optional[str] = Field(default=None)
    partner_image: Optional[str] = Field(default=None)
    commander_damage: dict[str, int] = Field(default={})
    poison: int = Field(default=0, description="Poison counters (lethal at 10)")
    energy: int = Field(default=0, description="Energy counters (⚡)")
    rad: int = Field(default=0, description="Rad counters — mill at start of main phase")
    speed: int = Field(default=0, description="Speed counters (Aetherdrift racing mechanic)")

player_health: dict[int, Player] = {}
current_turn_id: int = 1
monarch_id: Optional[int] = None    # player who currently holds the Monarch token
initiative_id: Optional[int] = None # player who currently holds the Initiative
day_night: Optional[str] = None     # "day" | "night" | None (neither)
turn_started_at: Optional[float] = None  # epoch seconds when the current turn started

# ── SQLite helpers ────────────────────────────────────────────────────────────

_conn = sqlite3.connect(DB_FILE, check_same_thread=False)
_conn.execute("""CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state_json TEXT NOT NULL
)""")
_conn.commit()

def _save():
    state_json = json.dumps({
        "players": {k: v.model_dump() for k, v in player_health.items()},
        "current_turn_id": current_turn_id,
        "monarch_id": monarch_id,
        "initiative_id": initiative_id,
        "day_night": day_night,
        "turn_started_at": turn_started_at,
    })
    _conn.execute(
        "INSERT OR REPLACE INTO game_state (id, state_json) VALUES (1, ?)",
        (state_json,),
    )
    _conn.commit()

def _load():
    global current_turn_id, monarch_id, initiative_id, day_night, turn_started_at

    # Migrate from JSON file if there's no DB row yet
    _existing = _conn.execute("SELECT 1 FROM game_state WHERE id = 1").fetchone()
    if _existing is None and os.path.exists(_JSON_FILE):
        try:
            with open(_JSON_FILE) as f:
                data = json.load(f)
            for k, v in data.get("players", {}).items():
                player_health[int(k)] = Player(**v)
            current_turn_id = data.get("current_turn_id", 1)
            turn_started_at = data.get("turn_started_at")
            _save()
            return
        except Exception:
            pass

    try:
        row = _conn.execute("SELECT state_json FROM game_state WHERE id = 1").fetchone()
        if not row:
            return
        data = json.loads(row[0])
        for k, v in data.get("players", {}).items():
            player_health[int(k)] = Player(**v)
        current_turn_id = data.get("current_turn_id", 1)
        monarch_id = data.get("monarch_id")
        initiative_id = data.get("initiative_id")
        day_night = data.get("day_night")
        turn_started_at = data.get("turn_started_at")
    except Exception:
        pass  # corrupt state, start fresh

# ── Public API ────────────────────────────────────────────────────────────────

def get_state() -> dict:
    return {
        "players": player_health,
        "current_turn_id": current_turn_id,
        "monarch_id": monarch_id,
        "initiative_id": initiative_id,
        "day_night": day_night,
        "turn_started_at": turn_started_at,
    }

def initialize_game(player_configs: list[dict], starting_life: int):
    global current_turn_id, monarch_id, initiative_id, day_night, turn_started_at
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
    monarch_id = None
    initiative_id = None
    day_night = None
    turn_started_at = time.time()
    _save()

def reset_game():
    global current_turn_id, monarch_id, initiative_id, day_night, turn_started_at
    player_health.clear()
    current_turn_id = 1
    monarch_id = None
    initiative_id = None
    day_night = None
    turn_started_at = None
    _save()

def next_turn():
    global current_turn_id, turn_started_at
    ids = sorted(player_health.keys())
    if not ids:
        return current_turn_id
    active_ids = [i for i in ids if player_health[i].life > 0]
    if not active_ids:
        return current_turn_id
    idx = active_ids.index(current_turn_id) if current_turn_id in active_ids else -1
    current_turn_id = active_ids[(idx + 1) % len(active_ids)]
    turn_started_at = time.time()
    _save()
    return current_turn_id

def update_player(player_id: int, delta: int) -> Player:
    try:
        player_health[player_id].life += delta
        _save()
        return player_health[player_id]
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def update_poison(player_id: int, delta: int) -> Player:
    try:
        player = player_health[player_id]
        player.poison = max(0, player.poison + delta)
        if player.poison >= POISON_LETHAL and player.life > 0:
            player.life = 0
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def update_commander_damage(target_id: int, source_id: int, delta: int, is_partner: bool = False) -> Player:
    try:
        player = player_health[target_id]
        key = f"{source_id}_p" if is_partner else str(source_id)
        old = player.commander_damage.get(key, 0)
        new = max(0, old + delta)
        player.commander_damage[key] = new
        actual = new - old
        if new >= COMMANDER_DAMAGE_LETHAL and player.life > 0:
            player.life = 0
        else:
            player.life -= actual
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {target_id} does not exist")

VALID_COUNTERS = {"energy", "rad", "speed"}

MAX_SPEED = 4
COMMANDER_DAMAGE_LETHAL = 21
POISON_LETHAL = 10

def update_counter(player_id: int, counter: str, delta: int) -> Player:
    if counter not in VALID_COUNTERS:
        raise ValueError(f"Unknown counter type: {counter}")
    try:
        player = player_health[player_id]
        current = getattr(player, counter)
        new_value = max(0, current + delta)
        if counter == "speed":
            new_value = min(new_value, MAX_SPEED)
        setattr(player, counter, new_value)
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def set_monarch(player_id: Optional[int]):
    global monarch_id
    monarch_id = player_id
    _save()

def set_initiative(player_id: Optional[int]):
    global initiative_id
    initiative_id = player_id
    _save()

def set_day_night(state: Optional[str]):
    global day_night
    if state not in ("day", "night", None):
        raise ValueError(f"Invalid day_night value: {state!r}")
    day_night = state
    _save()

_load()
