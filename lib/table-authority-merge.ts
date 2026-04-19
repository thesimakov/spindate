import type { Player, TableAuthorityPayload, GameLogEntry } from "@/lib/game-types"
import { GAME_TABLE_LOG_MAX_ENTRIES } from "@/lib/game-types"

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
    if (idx !== -1) {
      nextIndex = idx
    } else if (current.isBot) {
      // Полная пересборка ботов (лобби / forceReshuffle): старый id пропал из состава.
      // Не ставим ход на индекс 0 — там почти всегда первый живой; имитация «идущей игры» ломается.
      const botIdx = nextPlayers.findIndex((p) => p.isBot)
      nextIndex = botIdx !== -1 ? botIdx : 0
    } else {
      nextIndex = 0
    }
  }
  const prevTurnPlayerId = snapshot.players[snapshot.currentTurnIndex]?.id ?? null
  const nextTurnPlayerId = nextPlayers[nextIndex]?.id ?? null
  const turnChanged = prevTurnPlayerId !== nextTurnPlayerId

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
    turnStartedAtMs: turnChanged ? Date.now() : snapshot.turnStartedAtMs ?? Date.now(),
    targetPlayer: nextTarget,
    targetPlayer2: nextTarget2,
  }
}

/**
 * Объединяет локальный лог с снимком authority: сохраняет записи, ещё не попавшие на сервер,
 * и не теряет серверные. При совпадении id побеждает remote.
 */
export function mergeGameLogsForSync(local: GameLogEntry[], remote: GameLogEntry[]): GameLogEntry[] {
  const byId = new Map<string, GameLogEntry>()
  for (const e of local) {
    byId.set(e.id, e)
  }
  for (const e of remote) {
    byId.set(e.id, e)
  }
  const merged = [...byId.values()]
  merged.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.id.localeCompare(b.id)
  })
  return merged.slice(-GAME_TABLE_LOG_MAX_ENTRIES)
}
