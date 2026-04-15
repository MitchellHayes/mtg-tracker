import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSkull } from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import useGameState from './hooks/useGameState'
import useGameActions from './hooks/useGameActions'
import nextTurnApi from './api/nextTurn'
import GameMenu from './GameMenu'
import './PlayerController.css'

function PlayerController() {
  const { id } = useParams()
  const playerId = parseInt(id)
  const { gameState, setGameState, currentTurnId, setCurrentTurnId } = useGameState()
  const { handleLife, handleCommanderDamage, handlePoison } = useGameActions(gameState, setGameState)
  const [showExtras, setShowExtras] = useState(false)

  const player = gameState[playerId]
  const opponents = Object.values(gameState).filter((p) => p.id !== playerId && p.commander)

  if (!player) return null

  const isEliminated = player.life <= 0
  const isMyTurn = currentTurnId === playerId
  const hasExtras = opponents.length > 0 || true // always show for poison

  const handlePassTurn = () => {
    nextTurnApi().then((data) => {
      if (data?.current_turn_id) setCurrentTurnId(data.current_turn_id)
    })
  }

  return (
    <div className={`pc-root ${isEliminated ? 'eliminated' : ''}`}>
      {isEliminated && <div className='pc-eliminated-banner'>ELIMINATED</div>}

      {isMyTurn && !isEliminated && <div className='pc-your-turn'>YOUR TURN</div>}

      <div className='pc-name'>{player.name}</div>
      {player.commander && (
        <div className='pc-commander'>{[player.commander, player.partner].filter(Boolean).join(' / ')}</div>
      )}

      <div className='pc-life-total'>{player.life}</div>

      <div className='pc-life-buttons'>
        <button className='pc-btn pc-btn-minus' onClick={() => handleLife(playerId, -1)} disabled={isEliminated}>−1</button>
        <button className='pc-btn pc-btn-plus' onClick={() => handleLife(playerId, 1)} disabled={isEliminated}>+1</button>
      </div>

      {isMyTurn && !isEliminated && (
        <button className='pc-pass-turn-btn' onClick={handlePassTurn}>Pass Turn</button>
      )}

      {hasExtras && (
        <button className='pc-extras-toggle' onClick={() => setShowExtras((v) => !v)}>
          {showExtras ? 'Hide' : 'Counters & Damage'} {showExtras ? '▲' : '▼'}
        </button>
      )}

      {showExtras && (
        <div className='pc-extras'>
          <div className='pc-poison-row'>
            <span className='pc-poison-label'><FontAwesomeIcon icon={faSkull} /> Poison</span>
            <div className='pc-cmdr-controls'>
              <button onClick={() => handlePoison(playerId, -1)}>−</button>
              <span className={`pc-cmdr-count ${(player.poison ?? 0) >= 5 ? 'warning' : ''} ${(player.poison ?? 0) >= 10 ? 'lethal' : ''}`}>
                {player.poison ?? 0}
              </span>
              <button onClick={() => handlePoison(playerId, 1)}>+</button>
            </div>
          </div>

          {opponents.length > 0 && (
            <div className='pc-cmdr-section'>
              <div className='pc-cmdr-title'>Commander Damage</div>
              {opponents.map((source) => {
                const taken = player.commander_damage?.[source.id] ?? 0
                const lethal = taken >= 21
                return (
                  <div key={source.id} className={`pc-cmdr-row ${lethal ? 'lethal' : ''}`}>
                    <div className='pc-cmdr-info'>
                      <span className='pc-cmdr-player'>{source.name}</span>
                      <span className='pc-cmdr-name'>{source.commander}</span>
                    </div>
                    <div className='pc-cmdr-controls'>
                      <button onClick={() => handleCommanderDamage(playerId, source.id, -1)}>−</button>
                      <span className={`pc-cmdr-count ${taken >= 15 ? 'warning' : ''} ${lethal ? 'lethal' : ''}`}>
                        {taken}
                      </span>
                      <button onClick={() => handleCommanderDamage(playerId, source.id, 1)}>+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
