import { API_URL } from '../config'

export default function resetGame() {
  return fetch(`${API_URL}/reset`, { method: 'POST' })
    .catch((err) => console.error('Reset failed:', err))
}
