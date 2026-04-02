import { useState, useEffect } from 'react'

function useGameState() {
  const [gameState, setGameState] = useState({})

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('https://studious-fishstick-wv7j5g65j4357v4-8000.app.github.dev/state')
        .then((res) => res.json())
        .then((data) => setGameState(data))
        .catch((err) => console.error('Error fetching game state:', err))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return gameState
}

export default useGameState