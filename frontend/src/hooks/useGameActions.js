import updatePlayer from '../api/updatePlayer'
import updateCommanderDamage from '../api/updateCommanderDamage'
import updatePoison from '../api/updatePoison'

export default function useGameActions(gameState) {
  const handleLife = (playerId, delta) => {
    if (!gameState[playerId]) return
    updatePlayer(playerId, delta)
  }

  const handleCommanderDamage = (targetId, sourceId, delta, isPartner = false) => {
    const target = gameState[targetId]
    if (!target) return
    const key = isPartner ? `${sourceId}_p` : String(sourceId)
    const currentDamage = target.commander_damage ?? {}
    const current = currentDamage[key] ?? 0
    const next = Math.max(0, current + delta)
    const actualDelta = next - current
    const newLife = next >= 21 && target.life > 0 ? 0 : target.life - actualDelta
    const lifeApiDelta = newLife - target.life
    updateCommanderDamage(targetId, sourceId, delta, isPartner)
    if (lifeApiDelta !== 0) updatePlayer(targetId, lifeApiDelta)
  }

  const handlePoison = (playerId, delta) => {
    const player = gameState[playerId]
    if (!player) return
    const current = player.poison ?? 0
    const next = Math.max(0, current + delta)
    const newLife = next >= 10 && player.life > 0 ? 0 : player.life
    const lifeApiDelta = newLife - player.life
    updatePoison(playerId, delta)
    if (lifeApiDelta !== 0) updatePlayer(playerId, lifeApiDelta)
  }

  return { handleLife, handleCommanderDamage, handlePoison }
}
