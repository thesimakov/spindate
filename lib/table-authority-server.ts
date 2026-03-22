import type { GameAction, Player, TableAuthorityPayload } from "@/lib/game-types"
import { generateBots } from "@/lib/bots"
import { composeTablePlayers } from "@/lib/table-composition"
import { getTableInfo } from "@/lib/live-tables-server"
import { buildInitialAuthoritySnapshot } from "@/lib/table-authority-init"
import { mergeLivePlayersIntoAuthority } from "@/lib/table-authority-merge"
import { applyTableAuthorityAction } from "@/lib/table-authority-apply"

declare global {
  var __spindateTableAuthorityStore: Map<number, TableAuthorityPayload> | undefined
}

function getStore(): Map<number, TableAuthorityPayload> {
  if (!globalThis.__spindateTableAuthorityStore) {
    globalThis.__spindateTableAuthorityStore = new Map<number, TableAuthorityPayload>()
  }
  return globalThis.__spindateTableAuthorityStore
}

function playerIdsKey(players: Player[]): string {
  return players.map((p) => p.id).join(",")
}

function targetsForTable(maxTableSize: number): { males: number; females: number } {
  return maxTableSize <= 6 ? { males: 3, females: 3 } : { males: 5, females: 5 }
}

/**
 * Инициализация/обновление авторитетного состояния при изменении живых игроков.
 */
export function ensureTableAuthority(tableId: number): TableAuthorityPayload | null {
  const tid = Math.floor(tableId)
  if (!Number.isInteger(tid) || tid <= 0) return null
  const info = getTableInfo(tid)
  if (!info || info.livePlayers.length === 0) return null

  const anchor: Player = { ...info.livePlayers[0], isBot: false }
  const { males, females } = targetsForTable(info.maxTableSize)
  const bots = generateBots(220, anchor.gender)
  const store = getStore()
  const prev = store.get(tid)

  const composed = composeTablePlayers({
    currentUser: anchor,
    livePlayers: info.livePlayers.map((p) => ({ ...p, isBot: false })),
    existingPlayers: prev?.players ?? [],
    maxTableSize: info.maxTableSize,
    targetMales: males,
    targetFemales: females,
    botPool: bots,
  })

  if (!prev) {
    const shuffled = [...composed].sort(() => Math.random() - 0.5)
    const init = buildInitialAuthoritySnapshot(shuffled, tid)
    const next: TableAuthorityPayload = { ...init, revision: 1 }
    store.set(tid, next)
    return next
  }

  const mergedCore = mergeLivePlayersIntoAuthority(prev, composed, anchor)
  const idsChanged = playerIdsKey(mergedCore.players) !== playerIdsKey(prev.players)
  const next: TableAuthorityPayload = {
    ...mergedCore,
    revision: idsChanged ? prev.revision + 1 : prev.revision,
  }
  store.set(tid, next)
  return next
}

export function getTableAuthoritySnapshot(tableId: number): TableAuthorityPayload | null {
  const store = getStore()
  return store.get(Math.floor(tableId)) ?? null
}

/**
 * Применить игровое событие (после записи в ленту событий) и увеличить revision.
 */
export function applyAuthorityEvent(tableId: number, action: GameAction): TableAuthorityPayload | null {
  const tid = Math.floor(tableId)
  let snap = getTableAuthoritySnapshot(tid)
  if (!snap) {
    ensureTableAuthority(tid)
    snap = getTableAuthoritySnapshot(tid)
  }
  if (!snap) return null
  const applied = applyTableAuthorityAction(snap, action)
  if (!applied) return null
  const next: TableAuthorityPayload = { ...applied, revision: snap.revision + 1 }
  getStore().set(tid, next)
  return next
}
