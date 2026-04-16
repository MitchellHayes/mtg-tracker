import { useState, useRef, useEffect } from 'react'
import { SCRYFALL_HEADERS } from './api/scryfall'
import './CardLookup.css'

const COLOR_TINTS = {
  W: '245, 240, 232',
  U: '74, 144, 217',
  B: '153, 102, 204',
  R: '224, 92, 58',
  G: '58, 158, 95',
}

function getCardTint(card) {
  if (!card) return null
  const identity = card.color_identity ?? []
  if (identity.length === 0) return '160, 160, 160' // colorless — grey
  if (identity.length > 1) return '212, 175, 55'    // multicolor — gold
  return COLOR_TINTS[identity[0]] ?? null
}

function useAutocomplete(query) {
  const [suggestions, setSuggestions] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => {
      fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}&include_extras=false`, { headers: SCRYFALL_HEADERS })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => setSuggestions(data?.data?.slice(0, 4) ?? []))
        .catch(() => {})
    }, 100)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  return suggestions
}

function CardDisplay({ card }) {
  if (!card) return null

  const faces = card.card_faces?.filter((f) => f.image_uris) ?? []
  const singleImage = card.image_uris?.normal

  return (
    <div className='cl-card-display'>
      {singleImage ? (
        <img className='cl-card-img' src={singleImage} alt={card.name} />
      ) : (
        <div className='cl-card-faces'>
          {faces.map((face) => (
            <img key={face.name} className='cl-card-img' src={face.image_uris.normal} alt={face.name} />
          ))}
        </div>
      )}
      <div className='cl-card-meta'>
        <span className='cl-set'>{card.set_name}</span>
        <span className={`cl-rarity cl-rarity--${card.rarity}`}>{card.rarity}</span>
      </div>
    </div>
  )
}

export default function CardLookup({ onClose }) {
  const [query, setQuery] = useState('')
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const sheetRef = useRef(null)
  const suggestions = useAutocomplete(query)

  useEffect(() => { inputRef.current?.focus() }, [])


  const fetchCard = (name) => {
    setQuery(name)
    setOpen(false)
    setLoading(true)
    setError(null)
    setCard(null)
    fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`, { headers: SCRYFALL_HEADERS })
      .then((r) => { if (!r.ok) throw new Error('Card not found'); return r.json() })
      .then((data) => setCard(data))
      .catch(() => setError('Card not found'))
      .finally(() => setLoading(false))
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && query.trim()) fetchCard(query.trim())
    if (e.key === 'Escape') onClose()
  }

  const tint = getCardTint(card)
  const sheetStyle = tint ? { '--card-tint': tint } : {}
  const hasResults = open && suggestions.length > 0

  return (
    <div className='cl-overlay' onClick={onClose}>
      <div
        ref={sheetRef}
        className={`cl-sheet ${card ? 'has-card' : ''} ${hasResults ? 'is-searching' : ''}`}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='cl-search-row'>
          <div className='cl-input-wrap'>
            <input
              ref={inputRef}
              className='cl-input'
              type='text'
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onKeyDown={handleKey}
              placeholder='Search any card…'
              autoComplete='off'
            />
            {query && (
              <button className='cl-clear' onClick={() => { setQuery(''); setCard(null); setError(null); inputRef.current?.focus() }}>✕</button>
            )}
          </div>
        </div>

        <div className='cl-body'>
          {hasResults ? (
            <ul className='cl-suggestions'>
              {suggestions.map((name) => (
                <li key={name} onMouseDown={() => fetchCard(name)}>{name}</li>
              ))}
            </ul>
          ) : (
            <>
              {loading && <div className='cl-status'>Looking up card…</div>}
              {error && <div className='cl-status cl-error'>{error}</div>}
              {!loading && !error && !card && (
                <div className='cl-status cl-hint'>Search for any Magic card</div>
              )}
              <CardDisplay card={card} />
            </>
          )}
        </div>

        <div className='cl-footer'>
          <button className='cl-close' onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
