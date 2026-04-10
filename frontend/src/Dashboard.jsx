import useGameState from './hooks/useGameState'
import './Dashboard.css'

function Dashboard() {
  const { gameState } = useGameState()

  return (
    <div className='dashboard'>
      <h1>MTG Life Tracker</h1>
      <div className='grid-container'>
        {Object.values(gameState).map((player) => (
          <div key={player.id} className='player-card'>
            <h2>Player {player.id}</h2>
            <p>{player.life}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard