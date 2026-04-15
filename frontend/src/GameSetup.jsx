import { useState, useEffect, useRef } from 'react'
import { API_URL } from './config'
import './GameSetup.css'

const DEFAULT_LIFE = 40
const LIFE_PRESETS = [20, 30, 40]

function makePlayer(index) {
  return {
    name: `Player ${index + 1}`,
    commander: '',
    partner: '',
    hasPartner: false,
  }
}

function CommanderInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [committed, setCommitted] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setCommitted(false)
    onChange(val)

    clearTimeout(debounceRef.current)
    if (val.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(val)}&include_extras=false`, {
        headers: { 'User-Agent': 'MTGTracker/1.0 (local commander life tracker; mitchellhayes95@outlook.com)' }
      })
        .then((res) => {
          if (res.status === 429) return null
          return res.json()
        })
        .then((data) => {
          if (!data) return
          setSuggestions(data.data || [])
          setOpen(true)
        })
        .catch(() => {})
    }, 100)
  }

  const handleSelect = (name) => {
    onChange(name)
    setCommitted(true)
    setSuggestions([])
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setCommitted(false)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className='commander-input-wrapper' ref={wrapperRef}>
      {committed && value ? (
        <div className='commander-chip'>
          <span className='commander-chip-name'>{value}</span>
          <button type='button' className='commander-chip-clear' onClick={handleClear}>✕</button>
        </div>
      ) : (
        <input
          type='text'
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete='off'
        />
      )}
      {open && suggestions.length > 0 && (
        <ul className='autocomplete-list'>
          {suggestions.slice(0, 8).map((name) => (
            <li key={name} onMouseDown={() => handleSelect(name)}>
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlayerSetupCard({ index, player, onChange, onRemove, canRemove }) {
  return (
    <div className='player-setup-card'>
      <div className='player-setup-header'>
        <input
          className='player-name-input'
          type='text'
          value={player.name}
          onChange={(e) => onChange({ ...player, name: e.target.value })}
          placeholder={`Player ${index + 1}`}
        />
        {canRemove && (
          <button type='button' className='remove-player-btn' onClick={onRemove}>✕</button>
        )}
      </div>

      <div className='setup-divider' />

      <div className='setup-section'>
        <label>Choose Commander</label>
        <CommanderInput
          value={player.commander}
          onChange={(val) => onChange({ ...player, commander: val })}
          placeholder='e.g. Atraxa, Muldrotha…'
        />
      </div>

      <div className='setup-section'>
        <label className='partner-toggle'>
          <input
            type='checkbox'
            checked={player.hasPartner}
            onChange={(e) => onChange({ ...player, hasPartner: e.target.checked, partner: '' })}
          />
          Partner Commander
        </label>
        {player.hasPartner && (
          <CommanderInput
            value={player.partner}
            onChange={(val) => onChange({ ...player, partner: val })}
            placeholder='e.g. Kraum, Tymna…'
          />
        )}
      </div>
    </div>
  )
}

function GameSetup({ onStart }) {
  const [startingLife, setStartingLife] = useState(DEFAULT_LIFE)
  const [customLife, setCustomLife] = useState('')
  const [players, setPlayers] = useState(() => [makePlayer(0), makePlayer(1)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const addPlayer = () => {
    if (players.length >= 8) return
    setPlayers((prev) => [...prev, makePlayer(prev.length)])
  }

  const removePlayer = (index) => {
    setPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  const updatePlayer = (index, updated) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? updated : p)))
  }

  const playersWithCommander = players.filter((p) => p.commander.trim())
  const canStart = players.length >= 2 && playersWithCommander.length >= 2

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canStart) return
    const payload = {
      starting_life: startingLife,
      players: players.map((p, i) => ({
        name: p.name || `Player ${i + 1}`,
        commander: p.commander || null,
        partner: p.hasPartner ? p.partner || null : null,
      })),
    }
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        return res.json()
      })
      .then((data) => onStart(data))
      .catch((err) => {
        console.error('Error initializing game:', err)
        setError('Failed to start game. Is the backend running?')
      })
      .finally(() => setLoading(false))
  }

  const handleLifePreset = (val) => {
    setStartingLife(val)
    setCustomLife('')
  }

  const handleCustomLife = (e) => {
    const val = e.target.value
    setCustomLife(val)
    const n = parseInt(val)
    if (!isNaN(n) && n > 0) setStartingLife(n)
  }

  const isCustomLife = !LIFE_PRESETS.includes(startingLife)

  return (
    <div className='game-setup-overlay'>
      <form className='game-setup' onSubmit={handleSubmit}>
        <div className='setup-top-bar'>
          <h1>New Game</h1>
          <div className='global-settings'>
            <div className='life-control'>
              <span className='life-control-label'>Starting Life</span>
              <div className='life-presets'>
                {LIFE_PRESETS.map((v) => (
                  <button
                    key={v}
                    type='button'
                    className={`life-preset-btn ${startingLife === v && !isCustomLife ? 'active' : ''}`}
                    onClick={() => handleLifePreset(v)}
                  >
                    {v}
                  </button>
                ))}
                <input
                  className={`life-custom-input ${isCustomLife ? 'active' : ''}`}
                  type='number'
                  min={1}
                  placeholder='Custom'
                  value={customLife}
                  onChange={handleCustomLife}
                  onFocus={() => setCustomLife(isCustomLife ? String(startingLife) : '')}
                />
              </div>
            </div>
            {error && <span className='setup-error'>{error}</span>}
            <div className='start-btn-wrap'>
              <button type='submit' className='start-btn' disabled={loading || !canStart}>
                {loading ? 'Starting…' : 'Start Game'}
              </button>
              {!canStart && (
                <span className='start-hint'>Add at least 2 players and choose commanders</span>
              )}
            </div>
          </div>
        </div>

        <div className='players-grid'>
          {players.map((player, i) => (
            <PlayerSetupCard
              key={i}
              index={i}
              player={player}
              onChange={(updated) => updatePlayer(i, updated)}
              onRemove={() => removePlayer(i)}
              canRemove={players.length > 1}
            />
          ))}
          {players.length < 8 && (
            <button type='button' className='add-player-card' onClick={addPlayer}>
              <span className='add-player-icon'>＋</span>
              <span>Add Player</span>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default GameSetup
