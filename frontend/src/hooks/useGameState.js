import { useState, useEffect } from 'react'
import { API_URL } from '../config'

function useGameState() {
  const [gameState, setGameState] = useState({})
  const [currentTurnId, setCurrentTurnId] = useState(null)

  const applyState = (data) => {
    setGameState(data.players ?? data)
    if (data.current_turn_id !== undefined) setCurrentTurnId(data.current_turn_id)
  }

  useEffect(() => {
    const fetchState = () => {
      fetch(`${API_URL}/state`)
        .then((res) => res.json())
        .then(applyState)
        .catch((err) => console.error('Error fetching game state:', err))
    }

    fetchState()
    const interval = setInterval(fetchState, 1000)
    return () => clearInterval(interval)
  }, [])

  return { gameState, setGameState, currentTurnId, setCurrentTurnId }
}

export default useGameState
