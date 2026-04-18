import type { GameAction, TableAuthorityPayload } from "@/lib/game-types"
import { tryInsertGlobalRatingFromAddLog } from "@/lib/global-rating-store"
import { getRoundDriverPlayerId } from "@/lib/round-driver-id"
import { applyAuthorityEvent, getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { getRedis } from "@/lib/redis"
import { readModifyWriteKey } from "@/lib/redis-rmw"
import { scheduleVkNotificationForTableAction } from "@/lib/vk-app-notifications-server"
import { isTableSyncedAction } from "@/lib/sync-invariants"
import { rateLimitTableAction, rateLimitTableChat } from "@/lib/rate-limit-redis"

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

const memoryEventsOpTail = new Map<number, Promise<unknown>>()

function getMemoryStore(): Map<number, TableEventsBucket> {
  if (!globalThis.__spindateTableEventsMemory) {
    globalThis.__spindateTableEventsMemory = new Map<number, TableEventsBucket>()
  }
  return globalThis.__spindateTableEventsMemory
}

function runMemoryEventsOp<T>(tableId: number, op: () => Promise<T> | T): Promise<T> {
  const prev = memoryEventsOpTail.get(tableId) ?? Promise.resolve()
  const result = prev.then(() => op())
  memoryEventsOpTail.set(
    tableId,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
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

function emitDebugLog(message: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return
  console.debug("[table-events]", message, data)
}

function isTurnLifecycleAction(action: GameAction): boolean {
  return (
    action.type === "START_PREDICTION_PHASE" ||
    action.type === "END_PREDICTION_PHASE" ||
    action.type === "START_COUNTDOWN" ||
    action.type === "TICK_COUNTDOWN" ||
    action.type === "START_SPIN" ||
    action.type === "STOP_SPIN" ||
    action.type === "NEXT_TURN"
  )
}

function buildTurnDebugContext(tableId: number, snap: TableAuthorityPayload | null): Record<string, unknown> {
  const turnIndex = snap?.currentTurnIndex ?? null
  const turnPlayer = turnIndex != null ? snap?.players?.[turnIndex] : null
  const roundNumber = snap?.roundNumber ?? null
  const turnPlayerId = turnPlayer?.id ?? null
  const turnPlayerIsBot = turnPlayer?.isBot ?? null
  const turnKey =
    roundNumber != null && turnIndex != null && turnPlayerId != null
      ? `${tableId}:${roundNumber}:${turnIndex}:${turnPlayerId}`
      : null
  return {
    roundNumber,
    currentTurnIndex: turnIndex,
    turnPlayerId,
    turnPlayerIsBot,
    roundDriverId: snap ? getRoundDriverPlayerId(snap.players) : null,
    turnKey,
  }
}

function emitTurnSyncLog(
  reason: "accepted" | "rejected_sender" | "rejected_apply_no_change",
  args: { tableId: number; senderId: number; actionType: string; snap: TableAuthorityPayload | null; extra?: Record<string, unknown> },
) {
  if (process.env.NODE_ENV !== "development") return
  const ctx = buildTurnDebugContext(args.tableId, args.snap)
  console.debug("[turn-sync]", {
    reason,
    tableId: args.tableId,
    senderId: args.senderId,
    actionType: args.actionType,
    ...ctx,
    ...(args.extra ?? {}),
  })
}

function isActionAllowed(action: GameAction): boolean {
  return isTableSyncedAction(action)
}

function senderMatchesActionSync(senderId: number, action: GameAction): boolean {
  if (action.type === "SET_PAIR_KISS_CHOICE") {
    return senderId === action.playerId
  }
  if (action.type === "SET_CLIENT_TAB_AWAY") {
    return senderId === action.playerId
  }
  if (action.type === "REQUEST_EXTRA_TURN") {
    return senderId === action.playerId
  }
  if (action.type === "SET_AVATAR_FRAME") {
    return senderId === action.playerId
  }
  if (action.type === "ADD_PREDICTION") {
    return senderId === action.prediction.playerId
  }
  if (action.type === "PLACE_BET") {
    return senderId === action.bet.playerId
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

/**
 * Рамку можно менять себе и дарить другому живому игроку.
 * Рамки ботов выставляет ведущий раунда — так снимок стола в authority совпадает у всех, кто зашёл позже.
 */
async function senderCanSetAvatarFrameFromSnapshot(
  tableId: number,
  senderId: number,
  action: Extract<GameAction, { type: "SET_AVATAR_FRAME" }>,
): Promise<boolean> {
  if (senderId === action.playerId) return true
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  const senderInTable = snap.players.some((p) => p.id === senderId)
  if (!senderInTable) return false
  const targetPlayer = snap.players.find((p) => p.id === action.playerId)
  if (!targetPlayer) return false
  if (!targetPlayer.isBot) {
    return true
  }
  const roundDriverId = getRoundDriverPlayerId(snap.players)
  return roundDriverId != null && senderId === roundDriverId
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

/** Turn-actions (countdown/spin lifecycle): активный игрок или round driver (AFK/бот-ходы). */
async function senderCanDriveTurnLifecycleFromSnapshot(
  tableId: number,
  senderId: number,
): Promise<boolean> {
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  const turnPlayer = snap.players[snap.currentTurnIndex]
  if (!turnPlayer) return false
  const roundDriverId = getRoundDriverPlayerId(snap.players)
  if (senderId === turnPlayer.id) return true
  return roundDriverId != null && senderId === roundDriverId
}

async function senderInCurrentTable(tableId: number, senderId: number): Promise<boolean> {
  const snap = await getTableAuthoritySnapshot(tableId)
  if (!snap) return false
  return snap.players.some((p) => p.id === senderId)
}

export async function pushTableEvent(args: { tableId: number; senderId: number; action: GameAction }) {
  const now = Date.now()
  const tableId = Math.floor(args.tableId)
  if (!Number.isInteger(tableId) || tableId <= 0) return { ok: false as const }
  if (!Number.isInteger(args.senderId) || args.senderId <= 0) return { ok: false as const }
  if (!isActionAllowed(args.action)) return { ok: false as const }
  if (!(await senderInCurrentTable(tableId, args.senderId))) {
    emitDebugLog("Rejected event: sender is not seated at table", {
      tableId,
      senderId: args.senderId,
      actionType: args.action.type,
    })
    return { ok: false as const, reason: "sender_not_in_table" as const }
  }

  if (args.action.type === "SEND_GENERAL_CHAT") {
    const rl = await rateLimitTableChat(args.senderId)
    if (!rl.ok) return { ok: false as const, reason: "rate_limited" as const }
  } else if (isTableSyncedAction(args.action)) {
    const rl = await rateLimitTableAction(args.senderId, args.action.type)
    if (!rl.ok) return { ok: false as const, reason: "rate_limited" as const }
  }

  const turnAction = isTurnLifecycleAction(args.action)
  const turnSnapBefore = turnAction ? await getTableAuthoritySnapshot(tableId) : null
  if (args.action.type === "ADD_LOG" && args.action.entry?.fromPlayer?.isBot) {
    if (!(await senderMatchesAddLogBotFromSnapshot(tableId, args.senderId, args.action))) {
      emitDebugLog("Rejected ADD_LOG from bot sender mismatch", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
      })
      if (turnAction) {
        emitTurnSyncLog("rejected_sender", {
          tableId,
          senderId: args.senderId,
          actionType: args.action.type,
          snap: turnSnapBefore,
        })
      }
      return { ok: false as const }
    }
  } else if (args.action.type === "SET_PAIR_KISS_CHOICE") {
    if (!(await senderMatchesPairKissChoiceFromSnapshot(tableId, args.senderId, args.action))) {
      emitDebugLog("Rejected SET_PAIR_KISS_CHOICE by snapshot rules", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
        playerId: args.action.playerId,
      })
      if (turnAction) {
        emitTurnSyncLog("rejected_sender", {
          tableId,
          senderId: args.senderId,
          actionType: args.action.type,
          snap: turnSnapBefore,
        })
      }
      return { ok: false as const }
    }
  } else if (args.action.type === "BEGIN_PAIR_KISS_PHASE") {
    if (!(await senderCanDriveTurnLifecycleFromSnapshot(tableId, args.senderId))) {
      const snap = await getTableAuthoritySnapshot(tableId)
      emitDebugLog("Rejected BEGIN_PAIR_KISS_PHASE by turn lifecycle rules", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
        currentTurnIndex: snap?.currentTurnIndex ?? null,
        turnPlayerId: snap?.players[snap.currentTurnIndex]?.id ?? null,
        turnPlayerIsBot: snap?.players[snap.currentTurnIndex]?.isBot ?? null,
        roundDriverId: snap ? getRoundDriverPlayerId(snap.players) : null,
      })
      if (turnAction) {
        emitTurnSyncLog("rejected_sender", {
          tableId,
          senderId: args.senderId,
          actionType: args.action.type,
          snap: snap ?? turnSnapBefore,
        })
      }
      return { ok: false as const }
    }
  } else if (args.action.type === "SET_AVATAR_FRAME") {
    const frameAction = args.action
    if (!(await senderCanSetAvatarFrameFromSnapshot(tableId, args.senderId, frameAction))) {
      const snap = await getTableAuthoritySnapshot(tableId)
      emitDebugLog("Rejected SET_AVATAR_FRAME by snapshot rules", {
        tableId,
        senderId: args.senderId,
        actionType: frameAction.type,
        playerId: frameAction.playerId,
        senderInTable: snap?.players.some((p) => p.id === args.senderId) ?? null,
        targetInTable: snap?.players.some((p) => p.id === frameAction.playerId) ?? null,
      })
      if (turnAction) {
        emitTurnSyncLog("rejected_sender", {
          tableId,
          senderId: args.senderId,
          actionType: frameAction.type,
          snap: snap ?? turnSnapBefore,
        })
      }
      return { ok: false as const }
    }
  } else if (
    turnAction
  ) {
    if (!(await senderCanDriveTurnLifecycleFromSnapshot(tableId, args.senderId))) {
      const snap = await getTableAuthoritySnapshot(tableId)
      emitDebugLog("Rejected turn lifecycle action by snapshot rules", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
        currentTurnIndex: snap?.currentTurnIndex ?? null,
        turnPlayerId: snap?.players[snap.currentTurnIndex]?.id ?? null,
        turnPlayerIsBot: snap?.players[snap.currentTurnIndex]?.isBot ?? null,
        roundDriverId: snap ? getRoundDriverPlayerId(snap.players) : null,
        playersCount: snap?.players.length ?? null,
      })
      emitTurnSyncLog("rejected_sender", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
        snap: snap ?? turnSnapBefore,
      })
      return { ok: false as const }
    }
  } else if (args.action.type === "FINALIZE_PAIR_KISS") {
    if (!(await senderCanFinalizePairKissFromSnapshot(tableId, args.senderId))) {
      const snap = await getTableAuthoritySnapshot(tableId)
      emitDebugLog("Rejected FINALIZE_PAIR_KISS by snapshot rules", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
        pairRoundKey: snap?.pairKissPhase?.roundKey ?? null,
        pairResolved: snap?.pairKissPhase?.resolved ?? null,
        pairDeadlineMs: snap?.pairKissPhase?.deadlineMs ?? null,
        roundDriverId: snap ? getRoundDriverPlayerId(snap.players) : null,
      })
      return { ok: false as const }
    }
  } else if (!senderMatchesActionSync(args.senderId, args.action)) {
    emitDebugLog("Rejected generic action sender mismatch", {
      tableId,
      senderId: args.senderId,
      actionType: args.action.type,
    })
    return { ok: false as const }
  }

  const applied = await applyAuthorityEvent(tableId, args.action)
  if (!applied) {
    emitDebugLog("applyAuthorityEvent rejected (no snapshot change)", {
      tableId,
      senderId: args.senderId,
      actionType: args.action.type,
    })
    if (turnAction) {
      emitTurnSyncLog("rejected_apply_no_change", {
        tableId,
        senderId: args.senderId,
        actionType: args.action.type,
        snap: turnSnapBefore,
      })
    }
    return { ok: false as const }
  }
  const turnCtx = buildTurnDebugContext(tableId, applied)
  if (turnAction) {
    emitTurnSyncLog("accepted", {
      tableId,
      senderId: args.senderId,
      actionType: args.action.type,
      snap: applied,
    })
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
    scheduleVkNotificationForTableAction(args.action)
    tryInsertGlobalRatingFromAddLog({ tableId, action: args.action, createdAtMs: now })
    return { ok: true as const, seq, turnKey: turnCtx.turnKey as string | null }
  }

  return runMemoryEventsOp(tableId, async () => {
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
    scheduleVkNotificationForTableAction(args.action)
    tryInsertGlobalRatingFromAddLog({ tableId, action: args.action, createdAtMs: now })
    return { ok: true as const, seq: bucket.seq, turnKey: turnCtx.turnKey as string | null }
  })
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
