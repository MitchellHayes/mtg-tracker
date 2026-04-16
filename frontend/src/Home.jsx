import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTv } from '@fortawesome/free-solid-svg-icons'
import useGameState from './hooks/useGameState'
import GameSetup from './GameSetup'
import { formatCommander } from './utils/formatCommander'
import './Home.css'
import './GameMenu.css'

function Home() {
  const { gameState, connected } = useGameState()
  const [showSetup, setShowSetup] = useState(false)
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false)
  const navigate = useNavigate()

  const players = Object.values(gameState)
  const gameInProgress = players.length > 0

  const handleStart = () => {
    setShowSetup(false)
  }

  const handleNewGameClick = () => {
    if (gameInProgress) {
      setShowNewGameConfirm(true)
    } else {
      setShowSetup(true)
    }
  }

  return (
    <div className='home'>
      <div className='home-header'>
        <h1>MTG Tracker</h1>
        <p className='home-subtitle'>Commander life tracking for your whole table</p>
        {!connected && <p className='home-offline'>Reconnecting…</p>}
      </div>

      {gameInProgress ? (
        <>
          <div className='home-section-title'>Players</div>
          <div className='home-player-list'>
            {players.map((p) => (
              <button key={p.id} className='home-player-btn' onClick={() => navigate(`/player/${p.id}`)}>
                <div className='home-player-left'>
                  <span className='home-player-name'>{p.name}</span>
                  {p.commander && (
                    <span className='home-player-commander'>
                      {formatCommander(p.commander, p.partner)}
                    </span>
                  )}
                </div>
                <span className={`home-player-life ${p.life <= 0 ? 'eliminated' : ''}`}>{p.life}</span>
              </button>
            ))}
          </div>

          <div className='home-actions'>
            <button className='home-action-btn' onClick={() => navigate('/dashboard')}>
              <FontAwesomeIcon icon={faTv} className='home-action-icon' />
              Dashboard
            </button>
          </div>

          <button className='home-new-game-btn' onClick={handleNewGameClick}>New Game</button>
        </>
      ) : (
        <div className='home-empty'>
          <p>No game in progress.</p>
          <button className='home-start-btn' onClick={handleNewGameClick}>Start a Game</button>
        </div>
      )}

      {showSetup && <GameSetup onStart={handleStart} />}

      {showNewGameConfirm && (
        <div className='confirm-overlay'>
          <div className='confirm-modal'>
            <p>Start a new game? This will reset all life totals and damage.</p>
            <div className='confirm-buttons'>
              <button className='confirm-cancel' onClick={() => setShowNewGameConfirm(false)}>Cancel</button>
              <button className='confirm-ok' onClick={() => { setShowNewGameConfirm(false); setShowSetup(true) }}>New Game</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
