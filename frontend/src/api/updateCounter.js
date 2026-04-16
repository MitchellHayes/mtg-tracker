import { API_URL } from '../config'

export default function updateCounter(playerId, counter, delta) {
  fetch(`${API_URL}/counter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, counter, delta }),
  }).catch((err) => console.error('Counter update failed:', err))
}
