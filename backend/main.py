from fastapi import FastAPI
from pydantic import BaseModel
from game_state import initialize_game, get_state, update_player
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_game(2,40)

@app.get("/state")
def get_game_state():
    return get_state()

class UpdateRequest(BaseModel):
    player_id: int
    delta: int
    
@app.post("/update")
def update_game_state(request: UpdateRequest):
    return update_player(request.player_id, request.delta)