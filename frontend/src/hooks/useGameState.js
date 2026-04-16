import { useState, useEffect } from 'react'
import { API_URL } from '../config'

function getWsUrl() {
  if (API_URL) {
    return API_URL.replace(/^http/, 'ws') + '/ws'
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

function useGameState() {
  const [gameState, setGameState] = useState({})
  const [currentTurnId, setCurrentTurnId] = useState(null)
  const [connected, setConnected] = useState(false)

  const applyState = (data) => {
    setGameState(data.players ?? data)
    if (data.current_turn_id !== undefined) setCurrentTurnId(data.current_turn_id)
  }

  useEffect(() => {
    let destroyed = false
    let ws
    let reconnectTimer

    function connect() {
      if (destroyed) return
      ws = new WebSocket(getWsUrl())

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          applyState(JSON.parse(event.data))
        } catch (err) {
          console.error('WS parse error:', err)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!destroyed) reconnectTimer = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      destroyed = true
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  return { gameState, setGameState, currentTurnId, setCurrentTurnId, connected }
}

export default useGameState
