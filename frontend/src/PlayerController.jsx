import { useState, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSkull, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import useGameState from './hooks/useGameState'
import useGameActions from './hooks/useGameActions'
import nextTurnApi from './api/nextTurn'
import GameMenu from './GameMenu'
import './PlayerController.css'

function useLongPress(onTap, onHoldTick, onHoldStart, onHoldEnd, holdInterval = 600, holdDelay = 500) {
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)
  const holdingRef = useRef(false)

  const cancel = useCallback(() => {
    clearTimeout(timeoutRef.current)
    clearInterval(intervalRef.current)
    if (holdingRef.current) onHoldEnd?.()
    holdingRef.current = false
  }, [onHoldEnd])

  const start = useCallback(() => {
    holdingRef.current = false
    timeoutRef.current = setTimeout(() => {
      holdingRef.current = true
      onHoldStart?.()
      onHoldTick()
      intervalRef.current = setInterval(onHoldTick, holdInterval)
    }, holdDelay)
  }, [onHoldTick, onHoldStart, holdInterval, holdDelay])

  const stop = useCallback(() => {
    clearTimeout(timeoutRef.current)
    clearInterval(intervalRef.current)
    if (!holdingRef.current) onTap()
    else onHoldEnd?.()
    holdingRef.current = false
  }, [onTap, onHoldEnd])

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: cancel,
  }
}

function FloatingDelta({ deltas }) {
  return (
    <div className='pc-float-layer' aria-hidden>
      {deltas.map(({ id, value, x }) => (
        <span key={id} className={`pc-float-delta ${value > 0 ? 'positive' : 'negative'}`} style={{ left: `${x}%` }}>
          {value > 0 ? `+${value}` : value}
        </span>
      ))}
    </div>
  )
}

let deltaId = 0

function PlayerController() {
  const { id } = useParams()
  const playerId = parseInt(id)
  const { gameState, setGameState, currentTurnId, setCurrentTurnId } = useGameState()
  const { handleLife, handleCommanderDamage, handlePoison } = useGameActions(gameState, setGameState)
  const [showExtras, setShowExtras] = useState(false)
  const [floatDeltas, setFloatDeltas] = useState([])
  const [holdAccum, setHoldAccum] = useState(null)
  const [holdAccumFading, setHoldAccumFading] = useState(false)
  const holdAccumRef = useRef(0)
  const holdFadeTimerRef = useRef(null)

  const player = gameState[playerId]
  const opponents = Object.values(gameState).filter((p) => p.id !== playerId && p.commander)

  const isEliminated = player ? player.life <= 0 : false
  const isMyTurn = currentTurnId === playerId

  const vibrate = (ms = 30) => navigator.vibrate?.(ms)

  const spawnDelta = (value, side) => {
    const id = ++deltaId
    const x = side === 'plus' ? 70 : 30
    setFloatDeltas((prev) => [...prev, { id, value, x }])
    setTimeout(() => setFloatDeltas((prev) => prev.filter((d) => d.id !== id)), 700)
  }

  const doLife = (delta) => {
    if (isEliminated) return
    handleLife(playerId, delta)
    vibrate(delta < 0 ? 50 : 25)
    spawnDelta(delta, delta > 0 ? 'plus' : 'minus')
  }

  const doHoldTick = (delta) => {
    if (isEliminated) return
    vibrate(30)
    holdAccumRef.current += delta
    setHoldAccum(holdAccumRef.current)
  }

  const onHoldStart = () => {
    clearTimeout(holdFadeTimerRef.current)
    holdAccumRef.current = 0
    setHoldAccum(0)
    setHoldAccumFading(false)
  }

  const onHoldEnd = () => {
    const total = holdAccumRef.current
    holdAccumRef.current = 0
    if (total !== 0) {
      handleLife(playerId, total)
      spawnDelta(total, total > 0 ? 'plus' : 'minus')
    }
    clearTimeout(holdFadeTimerRef.current)
    setHoldAccumFading(false)
    holdFadeTimerRef.current = setTimeout(() => {
      setHoldAccumFading(true)
      holdFadeTimerRef.current = setTimeout(() => {
        setHoldAccum(null)
        setHoldAccumFading(false)
      }, 400)
    }, 1200)
  }

  const minusHandlers = useLongPress(
    () => doLife(-1),
    () => doHoldTick(-5),
    onHoldStart,
    onHoldEnd,
  )
  const plusHandlers = useLongPress(
    () => doLife(1),
    () => doHoldTick(5),
    onHoldStart,
    onHoldEnd,
  )

  if (!player) return null

  const handlePassTurn = () => {
    vibrate(60)
    nextTurnApi().then((data) => {
      if (data?.current_turn_id) setCurrentTurnId(data.current_turn_id)
    })
  }

  return (
    <div className={`pc-root ${isEliminated ? 'eliminated' : ''}`}>
      {isEliminated && <div className='pc-eliminated-banner'>ELIMINATED</div>}

      <div className='pc-header'>
        {isMyTurn && !isEliminated && <div className='pc-your-turn'>YOUR TURN</div>}
        <div className='pc-name'>{player.name}</div>
        {player.commander && (
          <div className='pc-commander'>{[player.commander, player.partner].filter(Boolean).join(' / ')}</div>
        )}
      </div>

      <div className='pc-life-area'>
        <FloatingDelta deltas={floatDeltas} />
        {holdAccum !== null && holdAccum !== 0 && (
          <div className={`pc-hold-accum ${holdAccum > 0 ? 'positive' : 'negative'} ${holdAccumFading ? 'fading' : ''}`}>
            {holdAccum > 0 ? `+${holdAccum}` : holdAccum}
          </div>
        )}
        <div className='pc-life-total'>{player.life}</div>
        <div className='pc-life-buttons'>
          <button
            className='pc-btn pc-btn-minus'
            {...minusHandlers}
            disabled={isEliminated}
          >−1</button>
          <button
            className='pc-btn pc-btn-plus'
            {...plusHandlers}
            disabled={isEliminated}
          >+1</button>
        </div>
      </div>

      {(opponents.length > 0 || true) && (
        <div className='pc-extras-section'>
          <button className='pc-extras-header' onClick={() => setShowExtras((v) => !v)}>
            <span>Counters & Damage</span>
            <FontAwesomeIcon icon={showExtras ? faChevronUp : faChevronDown} />
          </button>

          {showExtras && (
            <div className='pc-extras'>
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={faSkull} className='pc-poison-icon' />
                  <span className='pc-module-label'>Poison</span>
                </div>
                <div className='pc-cmdr-controls'>
                  <button onClick={() => { handlePoison(playerId, -1); vibrate() }}>−</button>
                  <span className={`pc-cmdr-count ${(player.poison ?? 0) >= 5 ? 'warning' : ''} ${(player.poison ?? 0) >= 10 ? 'lethal-poison' : ''}`}>
                    {player.poison ?? 0}
                  </span>
                  <button onClick={() => { handlePoison(playerId, 1); vibrate() }}>+</button>
                </div>
              </div>

              {opponents.length > 0 && (
                <>
                  <div className='pc-cmdr-title'>Commander Damage</div>
                  {opponents.flatMap((source) => {
                    const rows = []
                    const commanders = [
                      { name: source.commander, isPartner: false, key: String(source.id) },
                      ...(source.partner ? [{ name: source.partner, isPartner: true, key: `${source.id}_p` }] : []),
                    ]
                    commanders.forEach(({ name, isPartner, key }) => {
                      const taken = player.commander_damage?.[key] ?? 0
                      const lethal = taken >= 21
                      rows.push(
                        <div key={key} className={`pc-module ${lethal ? 'lethal' : ''}`}>
                          <div className='pc-module-left'>
                            <div className='pc-cmdr-info'>
                              <span className='pc-cmdr-player'>{source.name}</span>
                              <span className='pc-cmdr-name'>{name}</span>
                            </div>
                          </div>
                          <div className='pc-cmdr-controls'>
                            <button onClick={() => { handleCommanderDamage(playerId, source.id, -1, isPartner); vibrate() }}>−</button>
                            <span className={`pc-cmdr-count ${taken >= 15 ? 'warning' : ''} ${lethal ? 'lethal' : ''}`}>
                              {taken}
                            </span>
                            <button onClick={() => { handleCommanderDamage(playerId, source.id, 1, isPartner); vibrate() }}>+</button>
                          </div>
                        </div>
                      )
                    })
                    return rows
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isMyTurn && !isEliminated && (
        <div className='pc-action-bar'>
          <button className='pc-pass-turn-btn' onClick={handlePassTurn}>Pass Turn</button>
        </div>
      )}

      <GameMenu
        gameState={gameState}
        currentTurnId={currentTurnId}
        onNewGame={setGameState}
        onNextTurn={setCurrentTurnId}
      />
    </div>
  )
}

export default PlayerController
