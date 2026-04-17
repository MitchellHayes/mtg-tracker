import sqlite3
import json
import os
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
threat_vote: Optional[dict] = None  # { active: bool, votes: {str(voter_id): target_id}, result_id: int|None }
watchlist: Optional[dict] = None   # { card_name: str, card_image: str|None, nominated_by_id: int }

# ── SQLite helpers ────────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            state_json TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn

def _save():
    conn = _get_conn()
    state_json = json.dumps({
        "players": {k: v.model_dump() for k, v in player_health.items()},
        "current_turn_id": current_turn_id,
        "monarch_id": monarch_id,
        "initiative_id": initiative_id,
        "day_night": day_night,
        "threat_vote": threat_vote,
        "watchlist": watchlist,
    })
    conn.execute(
        "INSERT OR REPLACE INTO game_state (id, state_json) VALUES (1, ?)",
        (state_json,),
    )
    conn.commit()
    conn.close()

def _load():
    global current_turn_id, monarch_id, initiative_id, day_night

    # Migrate from JSON file if DB doesn't exist yet
    if not os.path.exists(DB_FILE) and os.path.exists(_JSON_FILE):
        try:
            with open(_JSON_FILE) as f:
                data = json.load(f)
            for k, v in data.get("players", {}).items():
                player_health[int(k)] = Player(**v)
            current_turn_id = data.get("current_turn_id", 1)
            _save()
            return
        except Exception:
            pass

    try:
        conn = _get_conn()
        row = conn.execute("SELECT state_json FROM game_state WHERE id = 1").fetchone()
        conn.close()
        if not row:
            return
        data = json.loads(row[0])
        for k, v in data.get("players", {}).items():
            player_health[int(k)] = Player(**v)
        current_turn_id = data.get("current_turn_id", 1)
        monarch_id = data.get("monarch_id")
        initiative_id = data.get("initiative_id")
        day_night = data.get("day_night")
        threat_vote = data.get("threat_vote")
        watchlist = data.get("watchlist")
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
        "threat_vote": threat_vote,
        "watchlist": watchlist,
    }

def initialize_game(player_configs: list[dict], starting_life: int):
    global current_turn_id, monarch_id, initiative_id, day_night, threat_vote, watchlist
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
    threat_vote = None
    watchlist = None
    _save()

def reset_game():
    global current_turn_id, monarch_id, initiative_id, day_night, threat_vote, watchlist
    player_health.clear()
    current_turn_id = 1
    monarch_id = None
    initiative_id = None
    day_night = None
    threat_vote = None
    watchlist = None
    _save()

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
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def update_commander_damage(target_id: int, source_id: int, delta: int, is_partner: bool = False) -> Player:
    try:
        player = player_health[target_id]
        key = f"{source_id}_p" if is_partner else str(source_id)
        player.commander_damage[key] = max(0, player.commander_damage.get(key, 0) + delta)
        _save()
        return player
    except KeyError:
        raise KeyError(f"Player {target_id} does not exist")

VALID_COUNTERS = {"energy", "rad", "speed"}

MAX_SPEED = 4

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

def start_threat_vote():
    global threat_vote
    threat_vote = {"active": True, "votes": {}, "result_id": None}
    _save()

def cast_threat_vote(voter_id: int, target_id: int):
    global threat_vote
    if not threat_vote or not threat_vote["active"]:
        raise ValueError("No active vote")
    if voter_id not in player_health:
        raise KeyError(f"Player {voter_id} not found")
    if target_id not in player_health:
        raise KeyError(f"Target player {target_id} not found")
    threat_vote["votes"][str(voter_id)] = target_id
    alive_ids = [pid for pid, p in player_health.items() if p.life > 0]
    if all(str(pid) in threat_vote["votes"] for pid in alive_ids):
        tally: dict[int, int] = {}
        for tid in threat_vote["votes"].values():
            tally[tid] = tally.get(tid, 0) + 1
        result_id = max(tally, key=lambda k: (tally[k], -k))
        threat_vote["active"] = False
        threat_vote["result_id"] = result_id
    _save()

def clear_threat_vote():
    global threat_vote
    threat_vote = None
    _save()

def set_watchlist(card_name: str, card_image: Optional[str], nominated_by_id: int):
    global watchlist
    watchlist = {"card_name": card_name, "card_image": card_image, "nominated_by_id": nominated_by_id}
    _save()

def clear_watchlist():
    global watchlist
    watchlist = None
    _save()

_load()
