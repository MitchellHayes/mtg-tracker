import useGameState from './hooks/useGameState'
import useGameActions from './hooks/useGameActions'
import GameMenu from './GameMenu'
import './Controller.css'

function CommanderDamageTracker({ player, allPlayers, onDamage }) {
  const opponents = allPlayers.filter((p) => p.id !== player.id && p.commander)
  if (opponents.length === 0) return null

  return (
    <div className='cmdr-damage-section'>
      <div className='cmdr-damage-title'>Commander Damage</div>
      {opponents.map((source) => {
        const taken = player.commander_damage?.[source.id] ?? 0
        const lethal = taken >= 21
        return (
          <div key={source.id} className={`cmdr-damage-row ${lethal ? 'lethal' : ''}`}>
            <span className='cmdr-damage-name'>{source.name}</span>
            <div className='cmdr-damage-controls'>
              <button onClick={() => onDamage(player.id, source.id, -1)}>−</button>
              <span className={`cmdr-damage-count ${taken >= 15 ? 'warning' : ''} ${lethal ? 'lethal' : ''}`}>
                {taken}
              </span>
              <button onClick={() => onDamage(player.id, source.id, 1)}>+</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Controller() {
  const { gameState, setGameState, currentTurnId, setCurrentTurnId } = useGameState()
  const { handleLife, handleCommanderDamage } = useGameActions(gameState, setGameState)

  const players = Object.values(gameState)

  return (
    <div className='controller'>
      <div className='controller-header'>
        <h1>MTG Command Center</h1>
      </div>

      <div
        className='grid-container'
        style={{ gridTemplateColumns: `repeat(${players.length === 1 ? 1 : 2}, 1fr)` }}
      >
        {players.map((player) => (
          <div key={player.id} className='player-card'>
            <h2>{player.name}</h2>
            <p className='life-total'>{player.life}</p>
            <div className='buttons'>
              <button onClick={() => handleLife(player.id, 1)}>+1</button>
              <button onClick={() => handleLife(player.id, -1)}>-1</button>
            </div>
            <CommanderDamageTracker
              player={player}
              allPlayers={players}
              onDamage={handleCommanderDamage}
            />
          </div>
        ))}
      </div>

      <GameMenu
        gameState={gameState}
        currentTurnId={currentTurnId}
        onNewGame={setGameState}
        onNextTurn={setCurrentTurnId}
      />
    </div>
  )
}

export default Controller
