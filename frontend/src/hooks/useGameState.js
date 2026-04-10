import { useState, useEffect } from 'react'
import { API_URL } from '../config'

function useGameState() {
  const [gameState, setGameState] = useState({})

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_URL}/state`)
        .then((res) => res.json())
        .then((data) => setGameState(data))
        .catch((err) => console.error('Error fetching game state:', err))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return { gameState, setGameState }
}

export default useGameState