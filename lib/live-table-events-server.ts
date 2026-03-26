import type { GameAction } from "@/lib/game-types"
import { applyAuthorityEvent, ensureTableAuthority } from "@/lib/table-authority-server"
import { getRedis } from "@/lib/redis"
import { readModifyWriteKey } from "@/lib/redis-rmw"

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
    case "NEXT_TURN":
    case "REQUEST_EXTRA_TURN":
    case "ADD_LOG":
    case "SEND_GENERAL_CHAT":
    case "SET_AVATAR_FRAME":
    case "ADD_DRUNK_TIME":
      return true
    default:
      return false
  }
}

export async function pushTableEvent(args: { tableId: number; senderId: number; action: GameAction }) {
  const now = Date.now()
  const tableId = Math.floor(args.tableId)
  if (!Number.isInteger(tableId) || tableId <= 0) return { ok: false as const }
  if (!Number.isInteger(args.senderId) || args.senderId <= 0) return { ok: false as const }
  if (!isActionAllowed(args.action)) return { ok: false as const }

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
