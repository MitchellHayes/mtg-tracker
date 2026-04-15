import { API_URL } from '../config'

export default function nextTurn() {
  return fetch(`${API_URL}/next_turn`, { method: 'POST' })
    .then((res) => res.json())
    .catch((err) => console.error('Next turn failed:', err))
}
