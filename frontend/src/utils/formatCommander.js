export function formatCommander(commander, partner) {
  return [commander, partner].filter(Boolean).join(' / ')
}
