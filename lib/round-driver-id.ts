import type { Player } from "@/lib/game-types"

/**
 * Наименьший id среди живых игроков за столом — «ведущий раунда» (round driver).
 * Совпадает с логикой в game-room / SYNC_TABLE_AUTHORITY.
 */
export function getRoundDriverPlayerId(players: Player[]): number | null {
  const liveIds = players
    .filter((p) => !p.isBot)
    .map((p) => p.id)
    .sort((a, b) => a - b)
  return liveIds.length > 0 ? liveIds[0]! : null
}
