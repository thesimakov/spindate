import type { GameAction } from "@/lib/game-types"
import { tryInsertGlobalRatingFromAddLog } from "@/lib/global-rating-store"
import { getRoundDriverPlayerId } from "@/lib/round-driver-id"
import { applyAuthorityEvent, ensureTableAuthority, getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { getRedis } from "@/lib/redis"
import { readModifyWriteKey } from "@/lib/redis-rmw"
import { scheduleVkNotificationForTableAction } from "@/lib/vk-app-notifications-server"

type TableEvent = {
  seq: number
  senderId: number
  createdAt: number
  action: GameAction
}

type TableEventsBucket = {
  seq: number
  updatedAt: number
  events: TableEvent[]
}

const MAX_EVENTS_PER_TABLE = 600
const TABLE_EVENTS_TTL_MS = 60 * 60 * 1000

declare global {
  var __spindateTableEventsMemory: Map<number, TableEventsBucket> | undefined
}

function getMemoryStore(): Map<number, TableEventsBucket> {
  if (!globalThis.__spindateTableEventsMemory) {
    globalThis.__spindateTableEventsMemory = new Map<number, TableEventsBucket>()
  }
  return globalThis.__spindateTableEventsMemory
}

function eventsRedisKey(tableId: number): string {
  return `spindate:v1:events:${tableId}`
}

function parseBucket(raw: string | null): TableEventsBucket {
  if (!raw) return { seq: 0, updatedAt: Date.now(), events: [] }
  try {
    return JSON.parse(raw) as TableEventsBucket
  } catch {
    return { seq: 0, updatedAt: Date.now(), events: [] }
  }
}

function cleanupMemory(store: Map<number, TableEventsBucket>, now: number) {
  for (const [tableId, bucket] of store.entries()) {
    if (now - bucket.updatedAt > TABLE_EVENTS_TTL_MS) {
      store.delete(tableId)
    }
  }
}

function isActionAllowed(action: GameAction): boolean {
  switch (action.type) {
    case "START_COUNTDOWN":
    case "TICK_COUNTDOWN":
    case "START_SPIN":
    case "STOP_SPIN":
    case "BEGIN_PAIR_KISS_PHASE":
    case "SET_PAIR_KISS_CHOICE":
    case "FINALIZE_PAIR_KISS":
    case "NEXT_TURN":
    case "REQUEST_EXTRA_TURN":
    case "ADD_LOG":
    case "SEND_GENERAL_CHAT":
    case "SET_AVATAR_FRAME":
    case "ADD_DRUNK_TIME":
    case "SET_BOTTLE_SKIN":
    case "SET_BOTTLE_DONOR":
    case "SET_BOTTLE_TABLE_PURCHASE":
    case "RESET_ROUND":
    case "SET_BOTTLE_COOLDOWN_UNTIL":
    case "SET_CLIENT_TAB_AWAY":
      return true
    default:
      return false
  }
}

function senderMatchesActionSync(senderId: number, action: GameAction): boolean {
  if (action.type === "SET_PAIR_KISS_CHOICE") {
    return senderId === action.playerId
  }
  if (action.type === "SET_CLIENT_TAB_AWAY") {
    return senderId === action.playerId
  }
  if (action.type === "ADD_LOG") {
    const fp = action.entry?.fromPlayer
    if (!fp) return false
    if (fp.isBot) return false
    if (fp.id !== senderId) return false
  }
  return true
}

/** ADD_LOG с автором-ботом принимает только round driver; бот должен быть в снимке стола. */
async function senderMatchesAddLogBotFromSnapshot(
  tableId: number,
  senderId: number,
  action: Extract<GameAction, { type: "ADD_LOG" }>,
): Promise<boolean> {
  const fp = action.entry?.fromPlayer
  if (!fp?.isBot) return false
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  const roundDriverId = getRoundDriverPlayerId(snap.players)
  if (roundDriverId == null || senderId !== roundDriverId) return false
  const fromInTable = snap.players.find((p) => p.id === fp.id)
  return !!fromInTable?.isBot
}

/** Выбор за бота в фазе pair-kiss может отправлять только round driver. */
async function senderMatchesPairKissChoiceFromSnapshot(
  tableId: number,
  senderId: number,
  action: Extract<GameAction, { type: "SET_PAIR_KISS_CHOICE" }>,
): Promise<boolean> {
  if (senderId === action.playerId) return true
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  const roundDriverId = getRoundDriverPlayerId(snap.players)
  if (roundDriverId == null || senderId !== roundDriverId) return false
  const targetPlayer = snap.players.find((p) => p.id === action.playerId)
  return !!targetPlayer?.isBot
}

/** FINALIZE_PAIR_KISS: round-driver или любой игрок после дедлайна/двух ответов. */
async function senderCanFinalizePairKissFromSnapshot(
  tableId: number,
  senderId: number,
): Promise<boolean> {
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  const roundDriverId = getRoundDriverPlayerId(snap.players)
  if (roundDriverId != null && senderId === roundDriverId) return true
  const phase = snap.pairKissPhase
  if (!phase || phase.resolved) return false
  const senderInTable = snap.players.some((p) => p.id === senderId)
  if (!senderInTable) return false
  const timedOut = Date.now() >= phase.deadlineMs
  const bothAnswered = phase.choiceA !== null && phase.choiceB !== null
  return timedOut || bothAnswered
}

/** Turn-actions (countdown/spin lifecycle): только активный игрок; для хода бота — только round driver. */
async function senderCanDriveTurnLifecycleFromSnapshot(
  tableId: number,
  senderId: number,
): Promise<boolean> {
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  const turnPlayer = snap.players[snap.currentTurnIndex]
  if (!turnPlayer) return false
  const roundDriverId = getRoundDriverPlayerId(snap.players)
  if (turnPlayer.isBot) {
    return roundDriverId != null && senderId === roundDriverId
  }
  return senderId === turnPlayer.id
}

export async function pushTableEvent(args: { tableId: number; senderId: number; action: GameAction }) {
  const now = Date.now()
  const tableId = Math.floor(args.tableId)
  if (!Number.isInteger(tableId) || tableId <= 0) return { ok: false as const }
  if (!Number.isInteger(args.senderId) || args.senderId <= 0) return { ok: false as const }
  if (!isActionAllowed(args.action)) return { ok: false as const }
  if (args.action.type === "ADD_LOG" && args.action.entry?.fromPlayer?.isBot) {
    if (!(await senderMatchesAddLogBotFromSnapshot(tableId, args.senderId, args.action))) {
      return { ok: false as const }
    }
  } else if (args.action.type === "SET_PAIR_KISS_CHOICE") {
    if (!(await senderMatchesPairKissChoiceFromSnapshot(tableId, args.senderId, args.action))) {
      return { ok: false as const }
    }
  } else if (args.action.type === "BEGIN_PAIR_KISS_PHASE") {
    const snap = await getTableAuthoritySnapshot(tableId)
    const rd = snap ? getRoundDriverPlayerId(snap.players) : null
    if (rd == null || rd !== args.senderId) return { ok: false as const }
  } else if (
    args.action.type === "START_COUNTDOWN" ||
    args.action.type === "TICK_COUNTDOWN" ||
    args.action.type === "START_SPIN" ||
    args.action.type === "STOP_SPIN"
  ) {
    if (!(await senderCanDriveTurnLifecycleFromSnapshot(tableId, args.senderId))) {
      return { ok: false as const }
    }
  } else if (args.action.type === "FINALIZE_PAIR_KISS") {
    if (!(await senderCanFinalizePairKissFromSnapshot(tableId, args.senderId))) {
      return { ok: false as const }
    }
  } else if (!senderMatchesActionSync(args.senderId, args.action)) {
    return { ok: false as const }
  }

  const redis = getRedis()
  if (redis) {
    let seq = 0
    await readModifyWriteKey(redis, eventsRedisKey(tableId), (raw) => {
      let bucket = parseBucket(raw)
      if (now - bucket.updatedAt > TABLE_EVENTS_TTL_MS) {
        bucket = { seq: 0, updatedAt: now, events: [] }
      }
      bucket.seq += 1
      bucket.updatedAt = now
      bucket.events.push({
        seq: bucket.seq,
        senderId: args.senderId,
        createdAt: now,
        action: args.action,
      })
      if (bucket.events.length > MAX_EVENTS_PER_TABLE) {
        bucket.events = bucket.events.slice(-MAX_EVENTS_PER_TABLE)
      }
      seq = bucket.seq
      return JSON.stringify(bucket)
    })
    await ensureTableAuthority(tableId)
    await applyAuthorityEvent(tableId, args.action)
    scheduleVkNotificationForTableAction(args.action)
    tryInsertGlobalRatingFromAddLog({ tableId, action: args.action, createdAtMs: now })
    return { ok: true as const, seq }
  }

  const store = getMemoryStore()
  cleanupMemory(store, now)
  const bucket = store.get(tableId) ?? { seq: 0, updatedAt: now, events: [] }
  bucket.seq += 1
  bucket.updatedAt = now
  bucket.events.push({
    seq: bucket.seq,
    senderId: args.senderId,
    createdAt: now,
    action: args.action,
  })
  if (bucket.events.length > MAX_EVENTS_PER_TABLE) {
    bucket.events = bucket.events.slice(-MAX_EVENTS_PER_TABLE)
  }
  store.set(tableId, bucket)
  await ensureTableAuthority(tableId)
  await applyAuthorityEvent(tableId, args.action)
  scheduleVkNotificationForTableAction(args.action)
  tryInsertGlobalRatingFromAddLog({ tableId, action: args.action, createdAtMs: now })
  return { ok: true as const, seq: bucket.seq }
}

export async function pullTableEvents(args: { tableId: number; sinceSeq: number }) {
  const now = Date.now()
  const tableId = Math.floor(args.tableId)
  const sinceSeq = Number.isFinite(args.sinceSeq) ? Math.max(0, Math.floor(args.sinceSeq)) : 0
  if (!Number.isInteger(tableId) || tableId <= 0) {
    return { ok: true as const, currentSeq: 0, events: [] as TableEvent[] }
  }

  const redis = getRedis()
  if (redis) {
    const raw = await redis.get(eventsRedisKey(tableId))
    const bucket = parseBucket(raw)
    if (now - bucket.updatedAt > TABLE_EVENTS_TTL_MS) {
      await redis.del(eventsRedisKey(tableId))
      return { ok: true as const, currentSeq: 0, events: [] as TableEvent[] }
    }
    const events = bucket.events.filter((e) => e.seq > sinceSeq)
    return {
      ok: true as const,
      currentSeq: bucket.seq,
      events,
    }
  }

  const store = getMemoryStore()
  cleanupMemory(store, now)
  const bucket = store.get(tableId)
  if (!bucket) return { ok: true as const, currentSeq: 0, events: [] as TableEvent[] }

  const events = bucket.events.filter((e) => e.seq > sinceSeq)
  return {
    ok: true as const,
    currentSeq: bucket.seq,
    events,
  }
}

/** Админ: удалить ленту событий стола (Redis + память). */
export async function purgeTableEventsArchive(tableId: number): Promise<void> {
  const tid = Math.floor(tableId)
  if (!Number.isInteger(tid) || tid <= 0) return
  const redis = getRedis()
  if (redis) {
    await redis.del(eventsRedisKey(tid))
  }
  getMemoryStore().delete(tid)
}
