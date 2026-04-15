import { useParams } from 'react-router-dom'
import useGameState from './hooks/useGameState'
import useGameActions from './hooks/useGameActions'
import GameMenu from './GameMenu'
import './PlayerController.css'

function PlayerController() {
  const { id } = useParams()
  const playerId = parseInt(id)
  const { gameState, setGameState } = useGameState()
  const { handleLife, handleCommanderDamage } = useGameActions(gameState, setGameState)

  const player = gameState[playerId]
  const opponents = Object.values(gameState).filter((p) => p.id !== playerId && p.commander)

  if (!player) return null

const isEliminated = player.life <= 0

  return (
    <div className={`pc-root ${isEliminated ? 'eliminated' : ''}`}>
      {isEliminated && <div className='pc-eliminated-banner'>ELIMINATED</div>}

      <div className='pc-name'>{player.name}</div>
      {player.commander && (
        <div className='pc-commander'>{[player.commander, player.partner].filter(Boolean).join(' / ')}</div>
      )}

      <div className='pc-life-total'>{player.life}</div>

      <div className='pc-life-buttons'>
        <button className='pc-btn pc-btn-minus' onClick={() => handleLife(playerId, -1)}>−1</button>
        <button className='pc-btn pc-btn-plus' onClick={() => handleLife(playerId, 1)}>+1</button>
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

      <GameMenu gameState={gameState} onNewGame={setGameState} />
    </div>
  )
}

export default PlayerController
