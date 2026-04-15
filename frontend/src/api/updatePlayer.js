import { API_URL } from '../config'

function updatePlayer(playerId, delta) {
  return fetch(`${API_URL}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, delta: delta }),
  }).catch((err) => console.error('Error updating player:', err))
}

export default updatePlayer
