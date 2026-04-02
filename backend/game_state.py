from pydantic import BaseModel

class Player(BaseModel):
    id: int
    life: int

player_health = {}

def initialize_game(num_players, health_total):
    for i in range(num_players):
        player_health[i+1] =  Player(id = i + 1, life = health_total)

def get_state():
    return player_health

def update_player(player_id, delta):
    try:
        player_health[player_id].life += delta
        return player_health[player_id]
    except KeyError:
        raise KeyError(f"Player {player_id} does not exist")

initialize_game(2,40)

print(get_state())