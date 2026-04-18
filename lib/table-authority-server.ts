import type { GameAction, Player, TableAuthorityPayload } from "@/lib/game-types"
import { generateBots } from "@/lib/bots"
import { composeTablePlayers } from "@/lib/table-composition"
import { getTableInfo } from "@/lib/live-tables-server"
import { buildInitialAuthoritySnapshot } from "@/lib/table-authority-init"
import { mergeLivePlayersIntoAuthority } from "@/lib/table-authority-merge"
import { applyTableAuthorityAction } from "@/lib/table-authority-apply"
import { getRedis } from "@/lib/redis"
import { readModifyWriteKey } from "@/lib/redis-rmw"
import { loadRoomRegistry } from "@/lib/rooms/room-registry"
import { normalizeRoomBottleSkin } from "@/lib/rooms/room-appearance"
import { resolveEffectiveTableStyle } from "@/lib/table-style-global-server"
import { authoritySnapshotExpiredBottleLease } from "@/lib/bottle-lease-expiry"
import { SERVER_BOT_TURN_STUCK_MS, SERVER_SPIN_STUCK_MS } from "@/lib/spin-timing"

declare global {
  var __spindateTableAuthorityMemory: Map<number, TableAuthorityPayload> | undefined
}

function getMemoryStore(): Map<number, TableAuthorityPayload> {
  if (!globalThis.__spindateTableAuthorityMemory) {
    globalThis.__spindateTableAuthorityMemory = new Map<number, TableAuthorityPayload>()
  }
  return globalThis.__spindateTableAuthorityMemory
}

/** Без Redis параллельные apply/ensure читают один и тот же snap — последний writer теряет поля (напр. donor/cooldown). */
const memoryAuthorityOpTail = new Map<number, Promise<unknown>>()

function runMemoryAuthorityOp<T>(tid: number, op: () => Promise<T>): Promise<T> {
  const prev = memoryAuthorityOpTail.get(tid) ?? Promise.resolve()
  const result = prev.then(() => op())
  memoryAuthorityOpTail.set(
    tid,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
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

/**
 * Server-side watchdog: если спин завис, аккуратно переводим стол на следующий ход.
 * Это защищает комнату от вечного состояния «Крутится...».
 */
function stabilizeAuthoritySnapshot(
  snapshot: TableAuthorityPayload,
  tableId: number,
  nowMs = Date.now(),
): { snapshot: TableAuthorityPayload; changed: boolean } {
  let next = snapshot
  let changed = false
  const turnStartedAtMs =
    typeof next.turnStartedAtMs === "number" && Number.isFinite(next.turnStartedAtMs)
      ? next.turnStartedAtMs
      : 0
  if (turnStartedAtMs <= 0) {
    next = { ...next, turnStartedAtMs: nowMs }
    changed = true
  }

  if (next.isSpinning) {
    const started =
      typeof next.spinStartedAtMs === "number" && Number.isFinite(next.spinStartedAtMs)
        ? next.spinStartedAtMs
        : 0

    if (started <= 0) {
      next = { ...next, spinStartedAtMs: nowMs }
      changed = true
    } else if (nowMs - started >= SERVER_SPIN_STUCK_MS) {
      const spinner = next.targetPlayer2
      const target = next.targetPlayer
      const canOpenPairKiss = spinner != null && target != null
      const recoveredBase: TableAuthorityPayload = canOpenPairKiss
        ? {
            ...next,
            isSpinning: false,
            spinStartedAtMs: null,
            countdown: null,
            showResult: true,
            resultAction: next.resultAction ?? "skip",
            pairKissPhase: {
              roundKey: `${tableId}:${next.roundNumber}:${next.currentTurnIndex}:${spinner.id}:${target.id}:srv-watchdog`,
              deadlineMs: nowMs + 10_000,
              idA: spinner.id,
              idB: target.id,
              choiceA: null,
              choiceB: null,
              resolved: false,
              outcome: null,
            },
            currentTurnDidSpin: true,
          }
        : {
            ...next,
            isSpinning: false,
            spinStartedAtMs: null,
            countdown: null,
            showResult: false,
            targetPlayer: null,
            targetPlayer2: null,
            resultAction: null,
            pairKissPhase: null,
            // Считаем, что игрок крутил: watchdog не должен штрафовать skip-ом.
            currentTurnDidSpin: true,
          }
      if (!canOpenPairKiss) {
        next = applyTableAuthorityAction(recoveredBase, { type: "NEXT_TURN" }) ?? recoveredBase
      } else {
        next = recoveredBase
      }
      changed = true
    }
  } else if (next.spinStartedAtMs != null) {
    next = { ...next, spinStartedAtMs: null }
    changed = true
  }

  const turnPlayer = next.players[next.currentTurnIndex]
  const phaseActive = next.showResult || next.isSpinning || next.pairKissPhase != null
  const turnAgeMs = nowMs - (next.turnStartedAtMs ?? nowMs)
  if (
    turnPlayer?.isBot &&
    !phaseActive &&
    turnAgeMs >= SERVER_BOT_TURN_STUCK_MS
  ) {
    const recovered = applyTableAuthorityAction(next, { type: "NEXT_TURN" })
    if (recovered) {
      next = recovered
      changed = true
    }
  }

  const bottleLease = authoritySnapshotExpiredBottleLease(next, nowMs)
  if (bottleLease.changed) {
    next = bottleLease.snapshot
    changed = true
  }

  return { snapshot: next, changed }
}

/** Опции только для ensureTableAuthority (не хранятся в снимке). */
export type TableAuthorityEnsureOptions = {
  /** Пересобрать набор ботов с нуля (лобби «Играть»). Не применяется во время спина/результата/отсчёта. */
  forceReshuffleBots?: boolean
}

function computeEnsureAuthority(
  prev: TableAuthorityPayload | null,
  info: { livePlayers: Player[]; maxTableSize: number },
  tid: number,
  roomDefaults: { bottleSkin: TableAuthorityPayload["bottleSkin"]; tableStyle: TableAuthorityPayload["tableStyle"] },
  options?: TableAuthorityEnsureOptions,
): TableAuthorityPayload | null {
  const anchor: Player = { ...info.livePlayers[0], isBot: false }
  const { males, females } = targetsForTable(info.maxTableSize)
  const bots = generateBots(220, anchor.gender)

  const inActiveGameplay =
    prev != null &&
    (prev.isSpinning ||
      prev.showResult ||
      (prev.countdown != null && prev.countdown > 0) ||
      (prev.pairKissPhase != null && !prev.pairKissPhase.resolved))
  const useFreshBots =
    options?.forceReshuffleBots === true && prev != null && !inActiveGameplay
  const existingPlayers = useFreshBots ? [] : (prev?.players ?? [])

  const composed = composeTablePlayers({
    currentUser: anchor,
    livePlayers: info.livePlayers.map((p) => ({ ...p, isBot: false })),
    existingPlayers,
    maxTableSize: info.maxTableSize,
    targetMales: males,
    targetFemales: females,
    botPool: bots,
  })

  if (!prev) {
    const shuffled = [...composed].sort(() => Math.random() - 0.5)
    const init = buildInitialAuthoritySnapshot(shuffled, tid, {
      bottleSkin: roomDefaults.bottleSkin,
      tableStyle: roomDefaults.tableStyle,
    })
    return { ...init, revision: 1 }
  }

  const mergedCore = mergeLivePlayersIntoAuthority(prev, composed, anchor)
  const idsChanged = playerIdsKey(mergedCore.players) !== playerIdsKey(prev.players)
  return {
    ...mergedCore,
    bottleSkin: mergedCore.bottleSkin ?? roomDefaults.bottleSkin ?? "classic",
    tableStyle: roomDefaults.tableStyle ?? prev.tableStyle ?? "classic_night",
    predictions: mergedCore.predictions ?? prev.predictions ?? [],
    bets: mergedCore.bets ?? prev.bets ?? [],
    pot: mergedCore.pot ?? prev.pot ?? 0,
    revision: idsChanged ? prev.revision + 1 : prev.revision,
  }
}

/**
 * Инициализация/обновление авторитетного состояния при изменении живых игроков.
 */
export async function ensureTableAuthority(
  tableId: number,
  ensureOptions?: TableAuthorityEnsureOptions,
): Promise<TableAuthorityPayload | null> {
  const tid = Math.floor(tableId)
  if (!Number.isInteger(tid) || tid <= 0) return null
  const info = await getTableInfo(tid)
  if (!info || info.livePlayers.length === 0) return null
  const reg = await loadRoomRegistry()
  const meta = reg.rooms.find((r) => r.roomId === tid)
  const roomDefaults = {
    bottleSkin: normalizeRoomBottleSkin(meta?.bottleSkin),
    tableStyle: resolveEffectiveTableStyle(meta),
  } satisfies { bottleSkin: TableAuthorityPayload["bottleSkin"]; tableStyle: TableAuthorityPayload["tableStyle"] }

  const redis = getRedis()
  const key = authorityRedisKey(tid)

  if (redis) {
    let out: TableAuthorityPayload | null = null
    await readModifyWriteKey(redis, key, (raw) => {
      const prev = raw ? (JSON.parse(raw) as TableAuthorityPayload) : null
      const next = computeEnsureAuthority(prev, info, tid, roomDefaults, ensureOptions)
      if (!next) {
        out = null
        return null
      }
      const stabilized = stabilizeAuthoritySnapshot(next, tid)
      out = stabilized.changed ? { ...stabilized.snapshot, revision: next.revision + 1 } : stabilized.snapshot
      return JSON.stringify(out)
    })
    return out
  }

  return runMemoryAuthorityOp(tid, async () => {
    const store = getMemoryStore()
    const prev = store.get(tid) ?? null
    const next = computeEnsureAuthority(prev, info, tid, roomDefaults, ensureOptions)
    if (!next) return null
    const stabilized = stabilizeAuthoritySnapshot(next, tid)
    const out = stabilized.changed ? { ...stabilized.snapshot, revision: next.revision + 1 } : stabilized.snapshot
    store.set(tid, out)
    return out
  })
}

export async function getTableAuthoritySnapshot(tableId: number): Promise<TableAuthorityPayload | null> {
  const tid = Math.floor(tableId)
  const redis = getRedis()
  if (redis) {
    const key = authorityRedisKey(tid)
    const raw = await redis.get(key)
    if (!raw) return null
    try {
      const snap = JSON.parse(raw) as TableAuthorityPayload
      const stabilized = stabilizeAuthoritySnapshot(snap, tid)
      const out = stabilized.changed ? { ...stabilized.snapshot, revision: snap.revision + 1 } : stabilized.snapshot
      if (stabilized.changed) {
        void redis.set(key, JSON.stringify(out))
      }
      return out
    } catch {
      return null
    }
  }
  return runMemoryAuthorityOp(tid, async () => {
    const snap = getMemoryStore().get(tid) ?? null
    if (!snap) return null
    const stabilized = stabilizeAuthoritySnapshot(snap, tid)
    const out = stabilized.changed ? { ...stabilized.snapshot, revision: snap.revision + 1 } : stabilized.snapshot
    if (stabilized.changed) getMemoryStore().set(tid, out)
    return out
  })
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
      let next: TableAuthorityPayload = { ...applied, revision: snap.revision + 1 }
      const stabilized = stabilizeAuthoritySnapshot(next, tid)
      if (stabilized.changed) {
        next = { ...stabilized.snapshot, revision: next.revision + 1 }
      }
      out = next
      return JSON.stringify(out)
    })
    return out
  }

  return runMemoryAuthorityOp(tid, async () => {
    const store = getMemoryStore()
    const snap = store.get(tid)
    if (!snap) return null
    const applied = applyTableAuthorityAction(snap, action)
    if (!applied) return null
    let next: TableAuthorityPayload = { ...applied, revision: snap.revision + 1 }
    const stabilized = stabilizeAuthoritySnapshot(next, tid)
    if (stabilized.changed) {
      next = { ...stabilized.snapshot, revision: next.revision + 1 }
    }
    store.set(tid, next)
    return next
  })
}

/** Админ: полностью убрать снимок авторитета стола (Redis + память процесса). */
export async function purgeTableAuthoritySnapshot(tableId: number): Promise<void> {
  const tid = Math.floor(tableId)
  if (!Number.isInteger(tid) || tid <= 0) return
  const redis = getRedis()
  if (redis) {
    await redis.del(authorityRedisKey(tid))
  }
  await runMemoryAuthorityOp(tid, async () => {
    getMemoryStore().delete(tid)
  })
}
