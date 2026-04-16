import { API_URL } from '../config'

export default function setDayNight(state) {
  fetch(`${API_URL}/day_night`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  }).catch((err) => console.error('Set day/night failed:', err))
}
