import { useState, forwardRef, useImperativeHandle } from 'react'
import { useNavigate } from 'react-router-dom'
import GameSetup from './GameSetup'
import nextTurnApi from './api/nextTurn'
import { formatCommander } from './utils/formatCommander'
import './GameMenu.css'

const GameMenu = forwardRef(function GameMenu({ gameState, currentTurnId, onNewGame, onNextTurn }, ref) {
  const [open, setOpen] = useState(false)

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }))
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const navigate = useNavigate()

  const players = Object.values(gameState)
  const currentPlayer = gameState[currentTurnId]

  const handleNextTurn = () => {
    nextTurnApi().then((data) => {
      if (data?.current_turn_id) onNextTurn(data.current_turn_id)
    })
    setOpen(false)
  }

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
      {open && (
        <div className='game-menu-overlay' onClick={() => setOpen(false)}>
          <div className='game-menu-sheet' onClick={(e) => e.stopPropagation()}>

            {currentPlayer && (
              <>
                <div className='game-menu-section-title'>Current Turn</div>
                <div className='game-menu-turn-row'>
                  <span className='game-menu-turn-name'>{currentPlayer.name}</span>
                  <button className='game-menu-pass-btn' onClick={handleNextTurn}>Pass Turn</button>
                </div>
                <div className='game-menu-divider' />
              </>
            )}

            {players.length > 0 && (
              <>
                <div className='game-menu-section-title'>Switch to Player</div>
                <div className='game-menu-players'>
                  {players.map((p) => (
                    <button
                      key={p.id}
                      className={`game-menu-player-btn ${p.id === currentTurnId ? 'active-turn' : ''}`}
                      onClick={() => { navigate(`/player/${p.id}`); setOpen(false) }}
                    >
                      <span className='game-menu-player-name'>{p.name}</span>
                      {p.commander && (
                        <span className='game-menu-player-commander'>
                          {formatCommander(p.commander, p.partner)}
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
            <button className='game-menu-close' onClick={() => setOpen(false)}>
              Close
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
})

export default GameMenu
