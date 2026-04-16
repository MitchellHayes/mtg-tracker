import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSkull, faCrown, faDungeon, faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import useGameState from './hooks/useGameState'
import setDayNightApi from './api/setDayNight'
import { formatCommander } from './utils/formatCommander'
import { COMMANDER_DAMAGE_WARNING, COMMANDER_DAMAGE_LETHAL, POISON_WARNING, POISON_LETHAL } from './constants'
import QRWidget from './QRWidget'
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
    .map(([key, dmg]) => {
      const isPartner = key.endsWith('_p')
      const sourceId = parseInt(isPartner ? key.slice(0, -2) : key)
      const source = allPlayers[sourceId]
      const commanderName = isPartner ? source?.partner : source?.commander
      return { source, commanderName, dmg }
    })
    .filter(({ source, dmg }) => source && dmg > 0)
  if (entries.length === 0) return null

  return (
    <div className='cmdr-dmg-pips'>
      {entries.map(({ source, commanderName, dmg }) => (
        <span key={`${source.id}-${commanderName}`} className={`cmdr-dmg-pip ${dmg >= COMMANDER_DAMAGE_LETHAL ? 'lethal' : dmg >= COMMANDER_DAMAGE_WARNING ? 'warning' : ''}`}>
          {commanderName} {dmg}
        </span>
      ))}
    </div>
  )
}

function PlayerCard({ player, allPlayers, isActiveTurn, lastAlone, isWinner }) {
  const isEliminated = player.life <= 0
  const hasSplitArt = player.commander_image && player.partner_image
  const singleArt = !hasSplitArt && (player.commander_image || player.partner_image)

  const cardStyle = {}
  if (singleArt) {
    const overlay = isEliminated
      ? 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7))'
      : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.85) 100%)'
    cardStyle.backgroundImage = `${overlay}, url(${singleArt})`
    cardStyle.backgroundSize = 'cover'
    cardStyle.backgroundPosition = 'center top'
  }
  if (player.colors?.length > 0) {
    const stops = player.colors.map((c) => COLOR_MAP[c]).filter(Boolean)
    if (stops.length) cardStyle.borderColor = stops[0]
  }

  const commanderNames = formatCommander(player.commander, player.partner)
  const overlayStyle = isEliminated
    ? 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7))'
    : 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.88) 100%)'

  if (lastAlone) cardStyle.gridColumn = '1 / -1'

  return (
    <div className={`player-card ${isEliminated ? 'eliminated' : ''} ${isActiveTurn && !isWinner ? 'active-turn' : ''} ${lastAlone ? 'last-alone' : ''} ${isWinner ? 'winner' : ''}`} style={cardStyle}>
      {hasSplitArt && (
        <div className='card-art-split'>
          <div className='card-art-crossfade-a' style={{ backgroundImage: `url(${player.commander_image})` }} />
          <div className='card-art-crossfade-b' style={{ backgroundImage: `url(${player.partner_image})` }} />
          <div className='card-art-overlay' style={{ background: overlayStyle }} />
        </div>
      )}
      {isWinner && <div className='winner-banner'>WINNER</div>}
      {!isWinner && isActiveTurn && !isEliminated && <div className='active-turn-banner'>ACTIVE TURN</div>}
      {isEliminated && <div className='eliminated-banner'>ELIMINATED</div>}
      <div className='card-content'>
        <h2>{player.name}</h2>
        {commanderNames && (
          <p className='commander-name'>{commanderNames}</p>
        )}
        <p className='life-total'>{player.life}</p>
        {(player.poison ?? 0) > 0 && (
          <span className={`poison-pip ${player.poison >= POISON_LETHAL ? 'lethal' : player.poison >= POISON_WARNING ? 'warning' : ''}`}>
            <FontAwesomeIcon icon={faSkull} /> {player.poison}
          </span>
        )}
        {(player.speed ?? 0) >= 4 && (
          <span className='speed-max-pip'>⚡︎ Max Speed</span>
        )}
        <CommanderDamagePips player={player} allPlayers={allPlayers} />
      </div>
    </div>
  )
}

function GameStatusBar({ monarchId, initiativeId, dayNight, allPlayers }) {
  const monarch = allPlayers[monarchId]
  const initiative = allPlayers[initiativeId]

  const cycleDayNight = () => {
    const next = dayNight === null ? 'day' : dayNight === 'day' ? 'night' : null
    setDayNightApi(next)
  }

  if (!monarch && !initiative && !dayNight) return null

  return (
    <div className='dashboard-status-bar'>
      {monarch && (
        <span className='dash-status-chip monarch'>
          <FontAwesomeIcon icon={faCrown} /> {monarch.name}
        </span>
      )}
      {initiative && (
        <span className='dash-status-chip initiative'>
          <FontAwesomeIcon icon={faDungeon} /> {initiative.name}
        </span>
      )}
      {dayNight && (
        <button className={`dash-status-chip day-night ${dayNight}`} onClick={cycleDayNight} title='Click to cycle Day/Night'>
          <FontAwesomeIcon icon={dayNight === 'day' ? faSun : faMoon} />
          {dayNight === 'day' ? ' Day' : ' Night'}
        </button>
      )}
    </div>
  )
}

function Dashboard() {
  const { gameState, currentTurnId, monarchId, initiativeId, dayNight } = useGameState()

  const players = Object.values(gameState)
  const n = players.length
  const alivePlayers = players.filter((p) => p.life > 0)
  const winner = n > 1 && alivePlayers.length === 1 ? alivePlayers[0] : null
  const cols = winner ? 1 : n === 3 ? 3 : n <= 2 ? n : n <= 6 ? 2 : 4
  // When n is odd and > 3, the last card will be alone in its row — center it
  const lastAlone = n > 3 && n % 2 !== 0

  if (n === 0) {
    return (
      <div className='dashboard dashboard-empty'>
        <h1>MTG Life Tracker</h1>
        <div className='dashboard-empty-state'>
          <p className='dashboard-empty-title'>Awaiting Game</p>
          <p className='dashboard-empty-sub'>Start a game on your device to begin tracking.</p>
        </div>
        <div className='dashboard-qr-overlay'><QRWidget size={88} /></div>
      </div>
    )
  }

  return (
    <div className='dashboard'>
      <h1>MTG Life Tracker</h1>
      <GameStatusBar monarchId={monarchId} initiativeId={initiativeId} dayNight={dayNight} allPlayers={gameState} />
      <div className='grid-container' style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {(winner ? [winner] : players).map((player, i) => (
          <PlayerCard
            key={player.id}
            player={player}
            allPlayers={gameState}
            isActiveTurn={player.id === currentTurnId}
            lastAlone={!winner && lastAlone && i === players.length - 1}
            isWinner={winner?.id === player.id}
          />
        ))}
      </div>
    </div>
  )
}

export default Dashboard
