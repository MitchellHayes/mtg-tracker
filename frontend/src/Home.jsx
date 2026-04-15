import { useNavigate } from 'react-router-dom'
import useGameState from './hooks/useGameState'
import GameSetup from './GameSetup'
import { useState } from 'react'
import './Home.css'

function Home() {
  const { gameState, setGameState } = useGameState()
  const [showSetup, setShowSetup] = useState(false)
  const navigate = useNavigate()

  const players = Object.values(gameState)
  const gameInProgress = players.length > 0

  const handleStart = (newState) => {
    setGameState(newState)
    setShowSetup(false)
  }

  return (
    <div className='home'>
      <div className='home-header'>
        <h1>MTG Tracker</h1>
        <p className='home-subtitle'>Commander life tracking for your whole table</p>
      </div>

      {gameInProgress ? (
        <>
          <div className='home-section-title'>Your Controller</div>
          <div className='home-player-list'>
            {players.map((p) => (
              <button key={p.id} className='home-player-btn' onClick={() => navigate(`/player/${p.id}`)}>
                <div className='home-player-left'>
                  <span className='home-player-name'>{p.name}</span>
                  {p.commander && (
                    <span className='home-player-commander'>
                      {[p.commander, p.partner].filter(Boolean).join(' / ')}
                    </span>
                  )}
                </div>
                <span className={`home-player-life ${p.life <= 0 ? 'eliminated' : ''}`}>{p.life}</span>
              </button>
            ))}
          </div>

          <div className='home-section-title'>Shared Views</div>
          <div className='home-actions'>
            <button className='home-action-btn' onClick={() => navigate('/dashboard')}>
              <span className='home-action-icon'>📺</span>
              Dashboard
            </button>
            <button className='home-action-btn' onClick={() => navigate('/controller')}>
              <span className='home-action-icon'>🎮</span>
              Full Controller
            </button>
          </div>

          <button className='home-new-game-btn' onClick={() => setShowSetup(true)}>New Game</button>
        </>
      ) : (
        <div className='home-empty'>
          <p>No game in progress.</p>
          <button className='home-start-btn' onClick={() => setShowSetup(true)}>Start a Game</button>
        </div>
      )}

      {showSetup && <GameSetup onStart={handleStart} />}
    </div>
  )
}

export default Home
