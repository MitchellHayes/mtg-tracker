from pydantic import BaseModel
from typing import Optional

class Player(BaseModel):
    id: int
    life: int
    name: str
    colors: list[str] = []
    commander: Optional[str] = None
    commander_image: Optional[str] = None
    partner: Optional[str] = None
    partner_image: Optional[str] = None
    commander_damage: dict[int, int] = {}  # attacker_player_id -> damage taken

player_health = {}

def initialize_game(player_configs: list[dict], starting_life: int):
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

def get_state():
    return player_health

def update_player(player_id, delta):
    try:
        player_health[player_id].life += delta
        return player_health[player_id]
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

def update_commander_damage(target_id: int, source_id: int, delta: int):
    try:
        player = player_health[target_id]
        current = player.commander_damage.get(source_id, 0)
        player.commander_damage[source_id] = max(0, current + delta)
        return player
    except KeyError:
        raise KeyError(f"Player {target_id} does not exist")
