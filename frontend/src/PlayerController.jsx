import { useState, useRef, useCallback, useEffect } from 'react'
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
import { startThreatVote, castThreatVote, clearThreatVote } from './api/threatVote'
import { nominateWatchlist, clearWatchlist } from './api/watchlist'
import { SCRYFALL_HEADERS } from './api/scryfall'
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

function WatchlistOverlay({ playerId, onClose }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [nominating, setNominating] = useState(false)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}&include_extras=false`, { headers: SCRYFALL_HEADERS })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => setSuggestions(data?.data?.slice(0, 6) ?? []))
        .catch(() => {})
    }, 100)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const nominate = (name) => {
    setNominating(true)
    setSuggestions([])
    nominateWatchlist(name, playerId).finally(onClose)
  }

  return (
    <div className='threat-vote-overlay'>
      <div className='threat-vote-sheet'>
        <div className='threat-vote-title'>📌 Nominate for Watchlist</div>
        <div className='threat-vote-subtitle'>Table will be reminded to deal with this card</div>
        <div className='wl-search'>
          <div className='wl-input-wrap'>
            <input
              ref={inputRef}
              className='wl-input'
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={nominating ? 'Nominating…' : 'Search card name…'}
              disabled={nominating}
              autoComplete='off'
            />
            {query && !nominating && (
              <button className='wl-clear' onClick={() => { setQuery(''); setSuggestions([]) }}>✕</button>
            )}
          </div>
          {suggestions.length > 0 && (
            <ul className='wl-suggestions'>
              {suggestions.map((name) => (
                <li key={name} onMouseDown={() => nominate(name)}>{name}</li>
              ))}
            </ul>
          )}
        </div>
        <button className='pc-politics-btn secondary' style={{ marginTop: 4 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
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

// ── Start-of-Turn checklist ───────────────────────────────────────────────────
function StartOfTurnModal({ player, hasInitiative, onDismiss, onApplyLife }) {
  const rad = player.rad ?? 0
  const speed = player.speed ?? 0

  const items = []
  if (rad > 0) items.push({
    key: 'rad', icon: faRadiation, color: '#7ec850',
    title: `Resolve ${rad} Rad Counter${rad !== 1 ? 's' : ''}`,
    body: `Mill ${rad} card${rad !== 1 ? 's' : ''} from the top of your library. Lose 1 life for each nonland card milled.`,
  })
  if (hasInitiative) items.push({
    key: 'initiative', icon: faDungeon, color: '#6495ed',
    title: 'Venture into the Undercity',
    body: 'You hold the Initiative — venture into the Undercity dungeon at the beginning of your upkeep.',
  })
  if (speed > 0) items.push({
    key: 'speed', icon: faBolt, color: '#e8c840',
    title: speed >= 4 ? 'Max Speed!' : `Speed ${speed} / 4`,
    body: speed >= 4
      ? 'You\'re at max speed — abilities that care about max speed are now active for you.'
      : `You have ${speed} speed counter${speed !== 1 ? 's' : ''}. Speed increases automatically when you deal damage to opponents.`,
  })

  const [checked, setChecked] = useState(new Set())
  const [skipped, setSkipped] = useState(new Set())
  const [nonlandMilled, setNonlandMilled] = useState(0)
  const [radBypassed, setRadBypassed] = useState(false)

  if (items.length === 0) return null

  // Rad item is only checkable once the player has either entered a nonland count or
  // explicitly confirmed no non-lands were milled.
  const radResolved = rad === 0 || nonlandMilled > 0 || radBypassed

  // Each item must be either checked or skipped to enable "Got it".
  const allResolved = items.every(({ key }) => checked.has(key) || skipped.has(key))

  const toggle = (key) => {
    if (key === 'rad' && !radResolved) return
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSkip = (key, e) => {
    e.stopPropagation()
    // Skipping the rad item also clears any life-loss calculation.
    if (key === 'rad') { setNonlandMilled(0); setRadBypassed(false) }
    setSkipped((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    // Un-check if skipping, so the two states don't coexist.
    setChecked((prev) => { const next = new Set(prev); next.delete(key); return next })
  }

  const handleDismiss = () => {
    if (nonlandMilled > 0 && !skipped.has('rad')) onApplyLife(-nonlandMilled)
    onDismiss()
  }

  return (
    <div className='turn-modal-overlay'>
      <div className='turn-modal'>
        <div className='turn-modal-header'>Start of Turn</div>
        <div className='turn-modal-items'>
          {items.map(({ key, icon, color, title, body }) => {
            const isChecked = checked.has(key)
            const isSkipped = skipped.has(key)
            const isLocked = key === 'rad' && !radResolved && !isSkipped
            return (
              <div
                key={key}
                className={`turn-modal-item ${isChecked ? 'checked' : ''} ${isSkipped ? 'skipped' : ''} ${isLocked ? 'locked' : ''}`}
                onClick={() => !isSkipped && toggle(key)}
                role='checkbox'
                aria-checked={isChecked}
                aria-disabled={isLocked || isSkipped}
              >
                <FontAwesomeIcon icon={icon} className='turn-modal-item-icon' style={{ color }} />
                <div className='turn-modal-item-text'>
                  <div className='turn-modal-item-title'>{title}</div>
                  <div className='turn-modal-item-body'>{body}</div>
                  {key === 'rad' && (
                    <div className='turn-modal-rad-helper' onClick={(e) => e.stopPropagation()}>
                      <span className='turn-modal-rad-label'>Nonland milled:</span>
                      <div className='turn-modal-rad-controls'>
                        <button
                          className='turn-modal-rad-btn'
                          onClick={() => { setNonlandMilled((n) => Math.max(0, n - 1)); setRadBypassed(false) }}
                          disabled={nonlandMilled === 0}
                        >−</button>
                        <span className='turn-modal-rad-count'>{nonlandMilled}</span>
                        <button
                          className='turn-modal-rad-btn'
                          onClick={() => { setNonlandMilled((n) => Math.min(rad, n + 1)); setRadBypassed(false) }}
                          disabled={nonlandMilled === rad}
                        >+</button>
                      </div>
                      {nonlandMilled > 0
                        ? <span className='turn-modal-rad-preview'>−{nonlandMilled} life on confirm</span>
                        : (
                          <button
                            className={`turn-modal-rad-bypass ${radBypassed ? 'confirmed' : ''}`}
                            onClick={() => setRadBypassed((v) => !v)}
                          >
                            {radBypassed ? '✓ All lands' : 'All lands milled'}
                          </button>
                        )
                      }
                    </div>
                  )}
                </div>
                <div className='turn-modal-item-actions' onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`turn-modal-skip-btn ${isSkipped ? 'active' : ''}`}
                    onClick={(e) => toggleSkip(key, e)}
                  >
                    {isSkipped ? 'Undo skip' : 'Skip'}
                  </button>
                  <div className={`turn-modal-checkbox ${isChecked ? 'checked' : ''} ${isLocked ? 'locked' : ''} ${isSkipped ? 'skipped' : ''}`}>
                    {isChecked ? '✓' : isLocked ? '🔒' : isSkipped ? '–' : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <button className='turn-modal-btn-primary' disabled={!allResolved} onClick={handleDismiss}>
          Got it
        </button>
      </div>
    </div>
  )
}

// ── End-of-Turn flow ──────────────────────────────────────────────────────────
function EndOfTurnModal({ dayNight, isMonarch, onConfirm, onCancel, loading }) {
  const [spellCount, setSpellCount] = useState(null) // null | 0 | 1 | 2
  const needsDayNight = dayNight === 'day' || dayNight === 'night'
  const canConfirm = !needsDayNight || spellCount !== null

  const getNewDayNight = () => {
    if (!needsDayNight || spellCount === null) return dayNight
    if (dayNight === 'day' && spellCount === 0) return 'night'
    if (dayNight === 'night' && spellCount >= 2) return 'day'
    return dayNight
  }

  const dnResult = () => {
    if (spellCount === null) return null
    const next = getNewDayNight()
    if (next !== dayNight) return next === 'night' ? '🌙 Becomes Night' : '☀ Becomes Day'
    return 'No change'
  }

  return (
    <div className='turn-modal-overlay'>
      <div className='turn-modal'>
        <div className='turn-modal-header'>End of Turn</div>

        {needsDayNight && (
          <div className='turn-modal-section'>
            <div className='turn-modal-section-label'>
              {dayNight === 'day' ? '☀ Day' : '🌙 Night'} is active — spells cast this turn?
            </div>
            <div className='turn-modal-spell-btns'>
              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  className={`turn-modal-spell-btn ${spellCount === n ? 'active' : ''}`}
                  onClick={() => setSpellCount(n)}
                >
                  {n === 2 ? '2+' : n}
                </button>
              ))}
            </div>
            {dnResult() && <div className='turn-modal-dn-result'>{dnResult()}</div>}
          </div>
        )}

        <div className='turn-modal-reminders'>
          {isMonarch && (
            <div className='turn-modal-reminder'>
              <FontAwesomeIcon icon={faCrown} style={{ color: 'var(--gold)' }} />
              <span>Draw a card — you are the Monarch.</span>
            </div>
          )}
          <div className='turn-modal-reminder'>
            <span className='turn-modal-reminder-dot' />
            <span>Check for any other end-step triggers.</span>
          </div>
        </div>

        <div className='turn-modal-footer'>
          <button className='turn-modal-btn-cancel' disabled={loading} onClick={onCancel}>Cancel</button>
          <button
            className='turn-modal-btn-primary'
            disabled={!canConfirm || loading}
            onClick={() => onConfirm(getNewDayNight())}
          >
            {loading ? 'Passing…' : 'Pass Turn'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayerController() {
  const { id } = useParams()
  const playerId = parseInt(id)
  const { gameState, setGameState, currentTurnId, setCurrentTurnId, monarchId, initiativeId, dayNight, connected, threatVote, watchlist } = useGameState()
  const { handleLife, handleCommanderDamage, handlePoison } = useGameActions(gameState)
  const [showCounters, setShowCounters] = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [showCmdrDmg, setShowCmdrDmg] = useState(false)
  const [showPolitics, setShowPolitics] = useState(false)
  const [showWatchlistOverlay, setShowWatchlistOverlay] = useState(false)
  const [showLookup, setShowLookup] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [endModalLoading, setEndModalLoading] = useState(false)
  const prevTurnIdRef = useRef(null)
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

  const audioCtxRef = useRef(null)
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }
  useEffect(() => {
    const unlock = () => getAudioCtx()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const prevTurnIdRef = useRef(currentTurnId)
  useEffect(() => {
    const prev = prevTurnIdRef.current
    prevTurnIdRef.current = currentTurnId
    if (prev !== null && prev !== currentTurnId && currentTurnId === playerId) {
      try {
        const ctx = getAudioCtx()
        const notes = [
          { freq: 493.88, start: 0,    duration: 0.25 }, // B4, short
          { freq: 698.46, start: 0.2, duration: 0.8  }, // F5, long
        ]
        notes.forEach(({ freq, start, duration }) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.value = freq
          const t = ctx.currentTime + start
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.4, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
          osc.start(t)
          osc.stop(t + duration)
        })
      } catch (_) {}
    }
  }, [currentTurnId, playerId])

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

  // Show start-of-turn checklist when this player becomes active
  useEffect(() => {
    if (prevTurnIdRef.current === null) {
      prevTurnIdRef.current = currentTurnId
      return
    }
    if (currentTurnId === playerId && prevTurnIdRef.current !== playerId && player) {
      const hasChecklist = (player.rad ?? 0) > 0 || hasInitiative || (player.speed ?? 0) > 0
      if (hasChecklist) setShowStartModal(true)
    }
    prevTurnIdRef.current = currentTurnId
  }, [currentTurnId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) return null

  const handlePassTurn = () => {
    setShowEndModal(true)
  }

  const handleEndTurnConfirm = async (newDayNight) => {
    vibrate(60)
    setEndModalLoading(true)
    try {
      if (newDayNight !== dayNight) {
        await setDayNightApi(newDayNight)
      }
      const data = await nextTurnApi()
      if (data?.current_turn_id) setCurrentTurnId(data.current_turn_id)
    } finally {
      setEndModalLoading(false)
      setShowEndModal(false)
    }
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
                  <button className={`pc-dn-btn ${dayNight === 'day' ? 'active-day' : ''}`} disabled={isEliminated} onClick={() => setDayNightApi(dayNight === 'day' ? null : 'day')}>
                    <FontAwesomeIcon icon={faSun} />
                  </button>
                  <button className={`pc-dn-btn ${dayNight === 'night' ? 'active-night' : ''}`} disabled={isEliminated} onClick={() => setDayNightApi(dayNight === 'night' ? null : 'night')}>
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
                  disabled={isEliminated}
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
                  disabled={isEliminated}
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

        {/* ── Politics ── */}
        <div className={`pc-accordion ${showPolitics ? 'open' : ''}`}>
          <button className='pc-extras-header' onClick={() => setShowPolitics((v) => !v)}>
            <span>Politics</span>
            <div className='pc-extras-header-right'>
              {!showPolitics && threatVote?.result_id && !threatVote?.active && (
                <span className='pc-extras-summary-pip'>🎯 Threat</span>
              )}
              {!showPolitics && threatVote?.active && (
                <span className='pc-extras-summary-pip'>👁 Voting…</span>
              )}
              {!showPolitics && watchlist && (
                <span className='pc-extras-summary-pip'>📌 {watchlist.card_name}</span>
              )}
              <FontAwesomeIcon icon={showPolitics ? faChevronUp : faChevronDown} />
            </div>
          </button>
          {showPolitics && (
            <div className='pc-extras'>

              {/* Threat Vote */}
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <span className='pc-module-label'>Threat Vote</span>
                  {threatVote?.result_id && !threatVote?.active && (
                    <span className='pc-cmdr-name'>
                      🎯 {gameState[threatVote.result_id]?.name ?? 'Unknown'}
                    </span>
                  )}
                </div>
                <div className='pc-politics-actions'>
                  {threatVote?.result_id && !threatVote?.active && (
                    <button className='pc-politics-btn secondary' onClick={() => clearThreatVote()}>Clear</button>
                  )}
                  <button className='pc-politics-btn' onClick={() => { startThreatVote(); vibrate(40) }}>
                    {threatVote?.active ? 'Restart' : 'Call Vote'}
                  </button>
                </div>
              </div>

              {/* Watchlist */}
              <div className='pc-module'>
                <div className='pc-module-left'>
                  <span className='pc-module-label'>Watchlist</span>
                  {watchlist && (
                    <span className='pc-cmdr-name'>📌 {watchlist.card_name}</span>
                  )}
                </div>
                <div className='pc-politics-actions'>
                  {watchlist && (
                    <button className='pc-politics-btn secondary' onClick={() => clearWatchlist()}>Clear</button>
                  )}
                  <button className='pc-politics-btn' onClick={() => setShowWatchlistOverlay(true)}>
                    {watchlist ? 'Replace' : 'Nominate'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

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

      {showStartModal && (
        <StartOfTurnModal
          player={player}
          hasInitiative={hasInitiative}
          onDismiss={() => setShowStartModal(false)}
          onApplyLife={(delta) => doLife(delta)}
        />
      )}

      {showEndModal && (
        <EndOfTurnModal
          dayNight={dayNight}
          isMonarch={isMonarch}
          onConfirm={handleEndTurnConfirm}
          onCancel={() => setShowEndModal(false)}
          loading={endModalLoading}
        />
      )}

      <GameMenu
        ref={gameMenuRef}
        gameState={gameState}
        currentTurnId={currentTurnId}
        onNextTurn={setCurrentTurnId}
      />

      {showLookup && <CardLookup onClose={() => setShowLookup(false)} />}
      {showWatchlistOverlay && <WatchlistOverlay playerId={playerId} onClose={() => setShowWatchlistOverlay(false)} />}

      {threatVote?.active && !threatVote.votes?.[String(playerId)] && (
        <div className='threat-vote-overlay'>
          <div className='threat-vote-sheet'>
            <div className='threat-vote-title'>👁 Who's the Biggest Threat?</div>
            <div className='threat-vote-subtitle'>Your vote is anonymous</div>
            <div className='threat-vote-options'>
              {Object.values(gameState)
                .filter((p) => p.id !== playerId && p.life > 0)
                .map((p) => (
                  <button
                    key={p.id}
                    className='threat-vote-btn'
                    onClick={() => { castThreatVote(playerId, p.id); vibrate(40) }}
                  >
                    {p.name}
                    {p.commander && <span className='threat-vote-commander'>{p.commander}</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {threatVote?.active && threatVote.votes?.[String(playerId)] && (
        <div className='threat-vote-waiting'>
          <span>⏳ Waiting for others to vote…</span>
        </div>
      )}
    </div>
  )
}

export default PlayerController
