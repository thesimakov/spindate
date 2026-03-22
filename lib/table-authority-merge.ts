import type { Player, TableAuthorityPayload } from "@/lib/game-types"

/** Логика как SET_PLAYERS в gameReducer — сохраняем порядок во время спина/результата */
export function mergeLivePlayersIntoAuthority(
  snapshot: TableAuthorityPayload,
  incoming: Player[],
  anchorUser: Player,
): TableAuthorityPayload {
  const incomingIds = new Set(incoming.map((p) => p.id))

  let nextPlayers: Player[]
  if (snapshot.isSpinning || snapshot.showResult) {
    const byId = new Map<number, Player>()
    for (const p of incoming) byId.set(p.id, p)

    nextPlayers = snapshot.players
      .filter((p) => byId.has(p.id))
      .map((p) => byId.get(p.id)!)

    const existingIds = new Set(nextPlayers.map((p) => p.id))
    for (const p of incoming) {
      if (!existingIds.has(p.id)) nextPlayers.push(p)
    }
  } else {
    nextPlayers = incoming
  }

  if (!incomingIds.has(anchorUser.id) && !nextPlayers.some((p) => p.id === anchorUser.id)) {
    nextPlayers = [anchorUser, ...nextPlayers]
  }

  const current = snapshot.players[snapshot.currentTurnIndex]
  let nextIndex = 0
  if (current) {
    const idx = nextPlayers.findIndex((p) => p.id === current.id)
    nextIndex = idx !== -1 ? idx : 0
  }

  const nextTarget = snapshot.targetPlayer
    ? nextPlayers.find((p) => p.id === snapshot.targetPlayer!.id) ?? null
    : null
  const nextTarget2 = snapshot.targetPlayer2
    ? nextPlayers.find((p) => p.id === snapshot.targetPlayer2!.id) ?? null
    : null

  return {
    ...snapshot,
    players: nextPlayers,
    currentTurnIndex: nextPlayers.length === 0 ? 0 : Math.min(nextIndex, nextPlayers.length - 1),
    targetPlayer: nextTarget,
    targetPlayer2: nextTarget2,
  }
}
