import { useState, useEffect, useRef } from 'react'
import { API_URL } from './config'
import './GameSetup.css'

const DEFAULT_LIFE = 40

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
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className='commander-input-wrapper' ref={wrapperRef}>
      <input
        type='text'
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete='off'
      />
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

function PlayerSetupCard({ index, player, onChange }) {
  return (
    <div className='player-setup-card'>
      <div className='player-setup-header'>
        <span className='player-number'>Player {index + 1}</span>
        <input
          className='player-name-input'
          type='text'
          value={player.name}
          onChange={(e) => onChange({ ...player, name: e.target.value })}
          placeholder={`Player ${index + 1}`}
        />
      </div>

      <div className='setup-section'>
        <label>Commander</label>
        <CommanderInput
          value={player.commander}
          onChange={(val) => onChange({ ...player, commander: val })}
          placeholder='Search for a card...'
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
            placeholder='Search for a partner...'
          />
        )}
      </div>
    </div>
  )
}

function GameSetup({ onStart }) {
  const [startingLife, setStartingLife] = useState(DEFAULT_LIFE)
  const [players, setPlayers] = useState(() => [makePlayer(0), makePlayer(1)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const setPlayerCount = (n) => {
    const count = Math.min(8, Math.max(1, n))
    setPlayers((prev) => {
      if (count > prev.length) {
        const added = Array.from({ length: count - prev.length }, (_, i) => makePlayer(prev.length + i))
        return [...prev, ...added]
      }
      return prev.slice(0, count)
    })
  }

  const updatePlayer = (index, updated) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? updated : p)))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
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

  return (
    <div className='game-setup-overlay'>
      <form className='game-setup' onSubmit={handleSubmit}>
        <div className='setup-top-bar'>
          <h1>New Game</h1>
          <div className='global-settings'>
            <label>
              Players
              <input
                type='number'
                min={1}
                max={8}
                value={players.length}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
              />
            </label>
            <label>
              Starting Life
              <input
                type='number'
                min={1}
                value={startingLife}
                onChange={(e) => setStartingLife(Number(e.target.value))}
              />
            </label>
            {error && <span className='setup-error'>{error}</span>}
            <button type='submit' className='start-btn' disabled={loading}>
              {loading ? 'Starting…' : 'Start Game'}
            </button>
          </div>
        </div>

        <div className='players-grid'>
          {players.map((player, i) => (
            <PlayerSetupCard
              key={i}
              index={i}
              player={player}
              onChange={(updated) => updatePlayer(i, updated)}
            />
          ))}
        </div>
      </form>
    </div>
  )
}

export default GameSetup
