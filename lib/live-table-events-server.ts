import type { GameAction } from "@/lib/game-types"

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
  var __spindateTableEventsState: Map<number, TableEventsBucket> | undefined
}

function getStore() {
  if (!globalThis.__spindateTableEventsState) {
    globalThis.__spindateTableEventsState = new Map<number, TableEventsBucket>()
  }
  return globalThis.__spindateTableEventsState
}

function cleanup(store: Map<number, TableEventsBucket>, now: number) {
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
    case "ADD_LOG":
    case "SEND_GENERAL_CHAT":
      return true
    default:
      return false
  }
}

export function pushTableEvent(args: { tableId: number; senderId: number; action: GameAction }) {
  const now = Date.now()
  const store = getStore()
  cleanup(store, now)

  const tableId = Math.floor(args.tableId)
  if (!Number.isInteger(tableId) || tableId <= 0) return { ok: false as const }
  if (!Number.isInteger(args.senderId) || args.senderId <= 0) return { ok: false as const }
  if (!isActionAllowed(args.action)) return { ok: false as const }

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
  return { ok: true as const, seq: bucket.seq }
}

export function pullTableEvents(args: { tableId: number; sinceSeq: number }) {
  const now = Date.now()
  const store = getStore()
  cleanup(store, now)

  const tableId = Math.floor(args.tableId)
  const sinceSeq = Number.isFinite(args.sinceSeq) ? Math.max(0, Math.floor(args.sinceSeq)) : 0
  if (!Number.isInteger(tableId) || tableId <= 0) {
    return { ok: true as const, currentSeq: 0, events: [] as TableEvent[] }
  }

  const bucket = store.get(tableId)
  if (!bucket) return { ok: true as const, currentSeq: 0, events: [] as TableEvent[] }

  const events = bucket.events.filter((e) => e.seq > sinceSeq)
  return {
    ok: true as const,
    currentSeq: bucket.seq,
    events,
  }
}
