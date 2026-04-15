import { API_URL } from '../config'

export default function updateCommanderDamage(targetId, sourceId, delta) {
  fetch(`${API_URL}/commander_damage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: targetId, source_id: sourceId, delta }),
  }).catch((err) => console.error('Commander damage update failed:', err))
}
