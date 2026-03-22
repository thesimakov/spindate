import type { GameAction, Player, TableAuthorityPayload } from "@/lib/game-types"
import { generateBots } from "@/lib/bots"
import { composeTablePlayers } from "@/lib/table-composition"
import { getTableInfo } from "@/lib/live-tables-server"
import { buildInitialAuthoritySnapshot } from "@/lib/table-authority-init"
import { mergeLivePlayersIntoAuthority } from "@/lib/table-authority-merge"
import { applyTableAuthorityAction } from "@/lib/table-authority-apply"
import { getRedis } from "@/lib/redis"
import { readModifyWriteKey } from "@/lib/redis-rmw"

declare global {
  var __spindateTableAuthorityMemory: Map<number, TableAuthorityPayload> | undefined
}

function getMemoryStore(): Map<number, TableAuthorityPayload> {
  if (!globalThis.__spindateTableAuthorityMemory) {
    globalThis.__spindateTableAuthorityMemory = new Map<number, TableAuthorityPayload>()
  }
  return globalThis.__spindateTableAuthorityMemory
}

function authorityRedisKey(tableId: number): string {
  return `spindate:v1:authority:${tableId}`
}

function playerIdsKey(players: Player[]): string {
  return players.map((p) => p.id).join(",")
}

function targetsForTable(maxTableSize: number): { males: number; females: number } {
  return maxTableSize <= 6 ? { males: 3, females: 3 } : { males: 5, females: 5 }
}

function computeEnsureAuthority(
  prev: TableAuthorityPayload | null,
  info: { livePlayers: Player[]; maxTableSize: number },
  tid: number,
): TableAuthorityPayload | null {
  const anchor: Player = { ...info.livePlayers[0], isBot: false }
  const { males, females } = targetsForTable(info.maxTableSize)
  const bots = generateBots(220, anchor.gender)

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
    return { ...init, revision: 1 }
  }

  const mergedCore = mergeLivePlayersIntoAuthority(prev, composed, anchor)
  const idsChanged = playerIdsKey(mergedCore.players) !== playerIdsKey(prev.players)
  return {
    ...mergedCore,
    revision: idsChanged ? prev.revision + 1 : prev.revision,
  }
}

/**
 * Инициализация/обновление авторитетного состояния при изменении живых игроков.
 */
export async function ensureTableAuthority(tableId: number): Promise<TableAuthorityPayload | null> {
  const tid = Math.floor(tableId)
  if (!Number.isInteger(tid) || tid <= 0) return null
  const info = await getTableInfo(tid)
  if (!info || info.livePlayers.length === 0) return null

  const redis = getRedis()
  const key = authorityRedisKey(tid)

  if (redis) {
    let out: TableAuthorityPayload | null = null
    await readModifyWriteKey(redis, key, (raw) => {
      const prev = raw ? (JSON.parse(raw) as TableAuthorityPayload) : null
      const next = computeEnsureAuthority(prev, info, tid)
      out = next
      return next ? JSON.stringify(next) : null
    })
    return out
  }

  const store = getMemoryStore()
  const prev = store.get(tid) ?? null
  const next = computeEnsureAuthority(prev, info, tid)
  if (next) store.set(tid, next)
  return next
}

export async function getTableAuthoritySnapshot(tableId: number): Promise<TableAuthorityPayload | null> {
  const tid = Math.floor(tableId)
  const redis = getRedis()
  if (redis) {
    const raw = await redis.get(authorityRedisKey(tid))
    if (!raw) return null
    try {
      return JSON.parse(raw) as TableAuthorityPayload
    } catch {
      return null
    }
  }
  return getMemoryStore().get(tid) ?? null
}

/**
 * Применить игровое событие (после записи в ленту событий) и увеличить revision.
 */
export async function applyAuthorityEvent(tableId: number, action: GameAction): Promise<TableAuthorityPayload | null> {
  const tid = Math.floor(tableId)
  await ensureTableAuthority(tid)

  const redis = getRedis()
  const key = authorityRedisKey(tid)

  if (redis) {
    let out: TableAuthorityPayload | null = null
    await readModifyWriteKey(redis, key, (raw) => {
      if (!raw) return raw
      const snap = JSON.parse(raw) as TableAuthorityPayload
      const applied = applyTableAuthorityAction(snap, action)
      if (!applied) return raw
      out = { ...applied, revision: snap.revision + 1 }
      return JSON.stringify(out)
    })
    return out
  }

  const store = getMemoryStore()
  const snap = store.get(tid)
  if (!snap) return null
  const applied = applyTableAuthorityAction(snap, action)
  if (!applied) return null
  const next: TableAuthorityPayload = { ...applied, revision: snap.revision + 1 }
  store.set(tid, next)
  return next
}
