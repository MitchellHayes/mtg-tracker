import { API_URL } from '../config'

export default function setMonarch(playerId) {
  fetch(`${API_URL}/monarch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).catch((err) => console.error('Set monarch failed:', err))
}
