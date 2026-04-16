import { useState, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSkull, faChevronDown, faChevronUp, faMagnifyingGlass, faBars, faCrown, faDungeon, faBolt, faRadiation, faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import useGameState from './hooks/useGameState'
import useGameActions from './hooks/useGameActions'
import nextTurnApi from './api/nextTurn'
import setMonarchApi from './api/setMonarch'
import setInitiativeApi from './api/setInitiative'
import setDayNightApi from './api/setDayNight'
import updateCounter from './api/updateCounter'
import GameMenu from './GameMenu'
import CardLookup from './CardLookup'
import { formatCommander } from './utils/formatCommander'
import { COMMANDER_DAMAGE_WARNING, COMMANDER_DAMAGE_LETHAL, POISON_WARNING, POISON_LETHAL } from './constants'
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
  const { gameState, setGameState, currentTurnId, setCurrentTurnId, monarchId, initiativeId, dayNight, connected } = useGameState()
  const { handleLife, handleCommanderDamage, handlePoison } = useGameActions(gameState)
  const [showCounters, setShowCounters] = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [showCmdrDmg, setShowCmdrDmg] = useState(false)
  const [showLookup, setShowLookup] = useState(false)
  const gameMenuRef = useRef(null)
  const [floatDeltas, setFloatDeltas] = useState([])
  const [holdAccum, setHoldAccum] = useState(null)
  const [holdAccumFading, setHoldAccumFading] = useState(false)
  const holdAccumRef = useRef(0)
  const holdFadeTimerRef = useRef(null)

  const player = gameState[playerId]
  const opponents = Object.values(gameState).filter((p) => p.id !== playerId && p.commander)
  const currentTurnPlayer = gameState[currentTurnId]

  const isEliminated = player ? player.life <= 0 : false
  const isMyTurn = currentTurnId === playerId
  const isMonarch = monarchId === playerId
  const hasInitiative = initiativeId === playerId

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
        {!connected && <div className='pc-offline-badge'>Reconnecting…</div>}
        {isMyTurn && !isEliminated && <div className='pc-your-turn'>YOUR TURN</div>}
        <div className='pc-name'>{player.name}</div>
        {player.commander && (
          <div className='pc-commander'>{formatCommander(player.commander, player.partner)}</div>
        )}
        {(isMonarch || hasInitiative) && (
          <div className='pc-token-badges'>
            {isMonarch && <span className='pc-token-badge monarch'><FontAwesomeIcon icon={faCrown} /> Monarch</span>}
            {hasInitiative && <span className='pc-token-badge initiative'><FontAwesomeIcon icon={faDungeon} /> Initiative</span>}
          </div>
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

      <div className='pc-accordions'>

        {/* ── Counters ── */}
        <div className={`pc-accordion ${showCounters ? 'open' : ''}`}>
          <button className='pc-extras-header' onClick={() => setShowCounters((v) => !v)}>
            <span>Counters</span>
            <div className='pc-extras-header-right'>
              {!showCounters && (() => {
                const pips = []
                if ((player.poison ?? 0) > 0) pips.push({ label: '☠', value: player.poison })
                if ((player.energy ?? 0) > 0) pips.push({ label: '⚡', value: player.energy })
                if ((player.rad ?? 0) > 0) pips.push({ label: '☢', value: player.rad })
                if ((player.speed ?? 0) > 0) pips.push({ label: '⚡︎', value: `${player.speed}/4` })
                return pips.map(({ label, value }) => (
                  <span key={label} className='pc-extras-summary-pip'>{label} {value}</span>
                ))
              })()}
              <FontAwesomeIcon icon={showCounters ? faChevronUp : faChevronDown} />
            </div>
          </button>
          {showCounters && (
            <div className='pc-extras'>
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={faSkull} className='pc-poison-icon' />
                  <span className='pc-module-label'>Poison</span>
                </div>
                <div className='pc-cmdr-controls'>
                  <button onClick={() => { handlePoison(playerId, -1); vibrate() }}>−</button>
                  <span className={`pc-cmdr-count ${(player.poison ?? 0) >= POISON_WARNING ? 'warning' : ''} ${(player.poison ?? 0) >= POISON_LETHAL ? 'lethal-poison' : ''}`}>
                    {player.poison ?? 0}
                  </span>
                  <button onClick={() => { handlePoison(playerId, 1); vibrate() }}>+</button>
                </div>
              </div>
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={faBolt} className='pc-energy-icon' />
                  <span className='pc-module-label'>Energy</span>
                </div>
                <div className='pc-cmdr-controls'>
                  <button onClick={() => { updateCounter(playerId, 'energy', -1); vibrate() }}>−</button>
                  <span className='pc-cmdr-count'>{player.energy ?? 0}</span>
                  <button onClick={() => { updateCounter(playerId, 'energy', 1); vibrate() }}>+</button>
                </div>
              </div>
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={faRadiation} className='pc-rad-icon' />
                  <div className='pc-cmdr-info'>
                    <span className='pc-module-label'>Rad</span>
                    <span className='pc-cmdr-name'>Mill X, lose 1 life per nonland milled</span>
                  </div>
                </div>
                <div className='pc-cmdr-controls'>
                  <button onClick={() => { updateCounter(playerId, 'rad', -1); vibrate() }}>−</button>
                  <span className='pc-cmdr-count'>{player.rad ?? 0}</span>
                  <button onClick={() => { updateCounter(playerId, 'rad', 1); vibrate() }}>+</button>
                </div>
              </div>
              {(() => {
                const speed = player.speed ?? 0
                const maxSpeed = speed >= 4
                return (
                  <div className={`pc-module ${maxSpeed ? 'max-speed' : ''}`}>
                    <div className='pc-module-left'>
                      <span className='pc-speed-icon'>⚡︎</span>
                      <div className='pc-cmdr-info'>
                        <span className='pc-module-label'>Speed</span>
                        {maxSpeed && <span className='pc-cmdr-name pc-max-speed-label'>Max Speed!</span>}
                      </div>
                    </div>
                    <div className='pc-cmdr-controls'>
                      <button onClick={() => { updateCounter(playerId, 'speed', -1); vibrate() }}>−</button>
                      <span className={`pc-cmdr-count ${maxSpeed ? 'max-speed-count' : ''}`}>{speed}</span>
                      <button disabled={maxSpeed} onClick={() => { updateCounter(playerId, 'speed', 1); vibrate() }}>+</button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* ── Tokens ── */}
        <div className={`pc-accordion ${showTokens ? 'open' : ''}`}>
          <button className='pc-extras-header' onClick={() => setShowTokens((v) => !v)}>
            <span>Tokens</span>
            <div className='pc-extras-header-right'>
              {!showTokens && (
                <>
                  {dayNight === 'day' && <span className='pc-extras-summary-pip'>☀ Day</span>}
                  {dayNight === 'night' && <span className='pc-extras-summary-pip'>🌙 Night</span>}
                  {isMonarch && <span className='pc-extras-summary-pip monarch-pip'>👑 Monarch</span>}
                  {hasInitiative && <span className='pc-extras-summary-pip initiative-pip'>⚔ Initiative</span>}
                </>
              )}
              <FontAwesomeIcon icon={showTokens ? faChevronUp : faChevronDown} />
            </div>
          </button>
          {showTokens && (
            <div className='pc-extras'>
              {/* Day / Night */}
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={dayNight === 'night' ? faMoon : faSun} className={`pc-token-icon ${dayNight ? 'active' : ''}`} style={dayNight === 'night' ? { color: '#9b8ec4' } : dayNight === 'day' ? { color: '#f5c842' } : {}} />
                  <span className='pc-module-label'>{dayNight === 'day' ? 'Day' : dayNight === 'night' ? 'Night' : 'Day / Night'}</span>
                </div>
                <div className='pc-dn-toggle'>
                  <button className={`pc-dn-btn ${dayNight === 'day' ? 'active-day' : ''}`} onClick={() => setDayNightApi(dayNight === 'day' ? null : 'day')}>
                    <FontAwesomeIcon icon={faSun} />
                  </button>
                  <button className={`pc-dn-btn ${dayNight === 'night' ? 'active-night' : ''}`} onClick={() => setDayNightApi(dayNight === 'night' ? null : 'night')}>
                    <FontAwesomeIcon icon={faMoon} />
                  </button>
                </div>
              </div>

              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={faCrown} className={`pc-token-icon ${isMonarch ? 'active' : ''}`} />
                  <div className='pc-cmdr-info'>
                    <span className='pc-module-label'>Monarch</span>
                    <span className='pc-cmdr-name'>Draw a card at end of your turn</span>
                  </div>
                </div>
                <button
                  className={`pc-claim-btn ${isMonarch ? 'held' : ''}`}
                  onClick={() => { setMonarchApi(isMonarch ? null : playerId); vibrate(40) }}
                >
                  {isMonarch ? 'Release' : 'Claim'}
                </button>
              </div>
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <FontAwesomeIcon icon={faDungeon} className={`pc-token-icon ${hasInitiative ? 'active' : ''}`} />
                  <div className='pc-cmdr-info'>
                    <span className='pc-module-label'>Initiative</span>
                    <span className='pc-cmdr-name'>Venture into Undercity each upkeep</span>
                  </div>
                </div>
                <button
                  className={`pc-claim-btn ${hasInitiative ? 'held' : ''}`}
                  onClick={() => { setInitiativeApi(hasInitiative ? null : playerId); vibrate(40) }}
                >
                  {hasInitiative ? 'Release' : 'Claim'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Commander Damage ── */}
        {opponents.length > 0 && (
          <div className={`pc-accordion ${showCmdrDmg ? 'open' : ''}`}>
            <button className='pc-extras-header' onClick={() => setShowCmdrDmg((v) => !v)}>
              <span>Commander Damage</span>
              <div className='pc-extras-header-right'>
                {!showCmdrDmg && (() => {
                  const total = Object.values(player.commander_damage ?? {}).reduce((a, b) => a + b, 0)
                  return total > 0 ? <span className='pc-extras-summary-pip'>⚔ {total}</span> : null
                })()}
                <FontAwesomeIcon icon={showCmdrDmg ? faChevronUp : faChevronDown} />
              </div>
            </button>
            {showCmdrDmg && (
              <div className='pc-extras'>
                {opponents.flatMap((source) => {
                  const rows = []
                  const commanders = [
                    { name: source.commander, isPartner: false, key: String(source.id) },
                    ...(source.partner ? [{ name: source.partner, isPartner: true, key: `${source.id}_p` }] : []),
                  ]
                  commanders.forEach(({ name, isPartner, key }) => {
                    const taken = player.commander_damage?.[key] ?? 0
                    const lethal = taken >= COMMANDER_DAMAGE_LETHAL
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
                          <span className={`pc-cmdr-count ${taken >= COMMANDER_DAMAGE_WARNING ? 'warning' : ''} ${lethal ? 'lethal' : ''}`}>
                            {taken}
                          </span>
                          <button onClick={() => { handleCommanderDamage(playerId, source.id, 1, isPartner); vibrate() }}>+</button>
                        </div>
                      </div>
                    )
                  })
                  return rows
                })}
              </div>
            )}
          </div>
        )}

      </div>

      <div className='pc-toolbar'>
        <button className='pc-toolbar-icon' onClick={() => setShowLookup(true)} aria-label='Card lookup'>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
        <div className='pc-toolbar-center'>
          {isMyTurn && !isEliminated ? (
            <button className='pc-pass-turn-btn' onClick={handlePassTurn}>Pass Turn</button>
          ) : (
            currentTurnPlayer && !isMyTurn && (
              <span className='pc-whos-turn'>{currentTurnPlayer.name}'s turn</span>
            )
          )}
        </div>
        <button className='pc-toolbar-icon' onClick={() => gameMenuRef.current?.open()} aria-label='Menu'>
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <GameMenu
        ref={gameMenuRef}
        gameState={gameState}
        currentTurnId={currentTurnId}
        onNewGame={setGameState}
        onNextTurn={setCurrentTurnId}
      />

      {showLookup && <CardLookup onClose={() => setShowLookup(false)} />}
    </div>
  )
}

export default PlayerController
