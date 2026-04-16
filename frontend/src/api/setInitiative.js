import { API_URL } from '../config'

export default function setInitiative(playerId) {
  fetch(`${API_URL}/initiative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).catch((err) => console.error('Set initiative failed:', err))
}
