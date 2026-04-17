import { API_URL } from '../config'

export function nominateWatchlist(card_name, nominated_by_id) {
  return fetch(`${API_URL}/watchlist/nominate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_name, nominated_by_id }),
  }).then((r) => r.json())
}

export function clearWatchlist() {
  return fetch(`${API_URL}/watchlist/clear`, { method: 'POST' }).then((r) => r.json())
}
