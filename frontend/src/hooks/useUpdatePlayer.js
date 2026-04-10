import { API_URL } from '../config'

function useUpdatePlayer() {
  const updatePlayer = (playerId, delta) => {
    fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, delta: delta }),
    }).catch((err) => console.error('Error updating player:', err))
  }

  return updatePlayer
}

export default useUpdatePlayer
