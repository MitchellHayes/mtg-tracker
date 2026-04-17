import { API_URL } from '../config'

export function startThreatVote() {
  return fetch(`${API_URL}/threat_vote/start`, { method: 'POST' }).then((r) => r.json())
}

export function castThreatVote(voter_id, target_id) {
  return fetch(`${API_URL}/threat_vote/cast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter_id, target_id }),
  }).then((r) => r.json())
}

export function clearThreatVote() {
  return fetch(`${API_URL}/threat_vote/clear`, { method: 'POST' }).then((r) => r.json())
}
