import useGameState from './hooks/useGameState'
import useUpdatePlayer from './hooks/useUpdatePlayer'
import './Controller.css'

function Controller() {
  const { gameState, setGameState } = useGameState()
  const updatePlayer = useUpdatePlayer()

  const handleUpdate = (player, delta) => {
    setGameState({
      ...gameState,
      [player.id]: { ...player, life: player.life + delta }
    })
    updatePlayer(player.id, delta)
  }

  return (
    <div className='controller'>
      <h1>MTG Command Center</h1>
      <div className='grid-container'>
        {Object.values(gameState).map((player) => (
          <div key={player.id} className='player-card'>
            <h2>Player {player.id}</h2>
            <p className='life-total'>{player.life}</p>
            <div className='buttons'>
              <button onClick={() => handleUpdate(player, 1)}>+1</button>
              <button onClick={() => handleUpdate(player, -1)}>-1</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Controller