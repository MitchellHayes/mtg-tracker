import { API_URL } from '../config'

export default function updatePoison(playerId, delta) {
  fetch(`${API_URL}/poison`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, delta }),
  }).catch((err) => console.error('Poison update failed:', err))
}
