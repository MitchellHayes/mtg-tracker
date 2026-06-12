import updatePlayer from '../api/updatePlayer'
import updateCommanderDamage from '../api/updateCommanderDamage'
import updatePoison from '../api/updatePoison'

export default function useGameActions(gameState) {
  const handleLife = (playerId, delta) => {
    if (!gameState[playerId]) return
    return updatePlayer(playerId, delta)
  }

  const handleCommanderDamage = (targetId, sourceId, delta, isPartner = false) => {
    if (!gameState[targetId]) return
    updateCommanderDamage(targetId, sourceId, delta, isPartner)
  }

  const handlePoison = (playerId, delta) => {
    if (!gameState[playerId]) return
    updatePoison(playerId, delta)
  }

  return { handleLife, handleCommanderDamage, handlePoison }
}
