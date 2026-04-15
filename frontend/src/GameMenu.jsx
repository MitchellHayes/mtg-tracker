import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GameSetup from './GameSetup'
import './GameMenu.css'

function GameMenu({ gameState, onNewGame }) {
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const navigate = useNavigate()

  const players = Object.values(gameState)

  const handleNewGameConfirm = () => {
    setShowConfirm(false)
    setShowSetup(true)
  }

  const handleStart = (newState) => {
    setShowSetup(false)
    setOpen(false)
    onNewGame(newState)
    navigate('/')
  }

  return (
    <>
      <button className='game-menu-fab' onClick={() => setOpen(true)} aria-label='Menu'>
        ☰
      </button>

      {open && (
        <div className='game-menu-overlay' onClick={() => setOpen(false)}>
          <div className='game-menu-sheet' onClick={(e) => e.stopPropagation()}>
            <div className='game-menu-handle' />

            {players.length > 0 && (
              <>
                <div className='game-menu-section-title'>Switch to Player</div>
                <div className='game-menu-players'>
                  {players.map((p) => (
                    <button
                      key={p.id}
                      className='game-menu-player-btn'
                      onClick={() => { navigate(`/player/${p.id}`); setOpen(false) }}
                    >
                      <span className='game-menu-player-name'>{p.name}</span>
                      {p.commander && (
                        <span className='game-menu-player-commander'>
                          {[p.commander, p.partner].filter(Boolean).join(' / ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className='game-menu-divider' />
              </>
            )}

            <button className='game-menu-new-game' onClick={() => { setOpen(false); setShowConfirm(true) }}>
              New Game
            </button>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className='confirm-overlay'>
          <div className='confirm-modal'>
            <p>Start a new game? This will reset all life totals and damage.</p>
            <div className='confirm-buttons'>
              <button className='confirm-cancel' onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className='confirm-ok' onClick={handleNewGameConfirm}>New Game</button>
            </div>
          </div>
        </div>
      )}

      {showSetup && <GameSetup onStart={handleStart} />}
    </>
  )
}

export default GameMenu
