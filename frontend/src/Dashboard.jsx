import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSkull } from '@fortawesome/free-solid-svg-icons'
import useGameState from './hooks/useGameState'
import './Dashboard.css'

const COLOR_MAP = {
  W: '#f5f0e8',
  U: '#4a90d9',
  B: '#9966cc',
  R: '#e05c3a',
  G: '#3a9e5f',
}

function CommanderDamagePips({ player, allPlayers }) {
  const entries = Object.entries(player.commander_damage ?? {})
    .map(([sourceId, dmg]) => ({ source: allPlayers[parseInt(sourceId)], dmg }))
    .filter(({ source, dmg }) => source && dmg > 0)
  if (entries.length === 0) return null

  return (
    <div className='cmdr-dmg-pips'>
      {entries.map(({ source, dmg }) => (
        <span key={source.id} className={`cmdr-dmg-pip ${dmg >= 21 ? 'lethal' : dmg >= 15 ? 'warning' : ''}`}>
          {source.name} {dmg}
        </span>
      ))}
    </div>
  )
}

function PlayerCard({ player, allPlayers, isActiveTurn }) {
  const isEliminated = player.life <= 0
  const artImage = player.commander_image || player.partner_image

  const cardStyle = {}
  if (artImage) {
    const overlay = isEliminated
      ? 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7))'
      : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.85) 100%)'
    cardStyle.backgroundImage = `${overlay}, url(${artImage})`
    cardStyle.backgroundSize = 'cover'
    cardStyle.backgroundPosition = 'center top'
  }
  if (player.colors?.length > 0) {
    const stops = player.colors.map((c) => COLOR_MAP[c]).filter(Boolean)
    if (stops.length) cardStyle.borderColor = stops[0]
  }

  const commanderNames = [player.commander, player.partner].filter(Boolean)

  return (
    <div className={`player-card ${isEliminated ? 'eliminated' : ''} ${isActiveTurn ? 'active-turn' : ''}`} style={cardStyle}>
      {isActiveTurn && !isEliminated && <div className='active-turn-banner'>ACTIVE TURN</div>}
      {isEliminated && <div className='eliminated-banner'>ELIMINATED</div>}
      <div className='card-content'>
        <h2>{player.name}</h2>
        {commanderNames.length > 0 && (
          <p className='commander-name'>{commanderNames.join(' / ')}</p>
        )}
        <p className='life-total'>{player.life}</p>
        {(player.poison ?? 0) > 0 && (
          <span className={`poison-pip ${player.poison >= 10 ? 'lethal' : player.poison >= 5 ? 'warning' : ''}`}>
            <FontAwesomeIcon icon={faSkull} /> {player.poison}
          </span>
        )}
        <CommanderDamagePips player={player} allPlayers={allPlayers} />
      </div>
    </div>
  )
}

function Dashboard() {
  const { gameState, currentTurnId } = useGameState()

  const players = Object.values(gameState)
  const n = players.length
  const cols = n <= 2 ? n : n <= 6 ? Math.ceil(n / 2) : 4

  return (
    <div className='dashboard'>
      <h1>MTG Life Tracker</h1>
      <div className='grid-container' style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} allPlayers={gameState} isActiveTurn={player.id === currentTurnId} />
        ))}
      </div>
    </div>
  )
}

export default Dashboard
