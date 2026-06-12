import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [monarchId, setMonarchId] = useState(null)
  const [initiativeId, setInitiativeId] = useState(null)
  const [dayNight, setDayNight] = useState(null)
  const [connected, setConnected] = useState(false)
  const [turnStartedAt, setTurnStartedAt] = useState(null)
  const prevTurnIdRef = useRef(null)

  const applyState = useCallback((data) => {
    if (data.players !== undefined) setGameState(data.players)
    if (data.current_turn_id !== undefined) {
      setCurrentTurnId((prev) => {
        if (data.current_turn_id !== prevTurnIdRef.current) {
          prevTurnIdRef.current = data.current_turn_id
          setTurnStartedAt(Date.now())
        }
        return data.current_turn_id
      })
    }
    if (data.monarch_id !== undefined) setMonarchId(data.monarch_id)
    if (data.initiative_id !== undefined) setInitiativeId(data.initiative_id)
    if (data.day_night !== undefined) setDayNight(data.day_night)
  }, [])

  useEffect(() => {
    let destroyed = false
    let ws
    let reconnectTimer

    function fetchAndApply() {
      fetch(`${API_URL}/state`)
        .then((r) => r.json())
        .then(applyState)
        .catch(() => {})
    }

    function connect() {
      if (destroyed) return
      ws = new WebSocket(getWsUrl())

      ws.onopen = () => {
        setConnected(true)
        // Belt-and-suspenders: fetch REST state on reconnect to catch any
        // mutations that occurred while disconnected (WS also sends on connect).
        fetchAndApply()
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
  }, [applyState])

  return {
    gameState, setGameState,
    currentTurnId, setCurrentTurnId,
    monarchId,
    initiativeId,
    dayNight,
    connected,
    turnStartedAt,
  }
}

export default useGameState
