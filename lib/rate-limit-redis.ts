import "server-only"

import { getRedis } from "@/lib/redis"

/** Чат: не более N сообщений за окно (ТЗ). */
export const CHAT_MAX = 3
export const CHAT_WINDOW_MS = 5000

/** Игровые действия (не чат): не более 1 за 2 с; исключения — высокочастотный sync. */
export const ACTION_MAX = 1
export const ACTION_WINDOW_MS = 2000

const PREFIX = "spindate:v1:rl"

/** Не ограничивать частотой «тиков» синка — иначе ломается ход. */
export const ACTION_RATE_LIMIT_EXCLUDED = new Set<string>(["TICK_COUNTDOWN", "SET_CLIENT_TAB_AWAY"])

/**
 * Скользящее окно на Redis ZSET. Без Redis — пропускаем (dev / single instance).
 */
export async function allowSlidingWindow(args: {
  scope: "chat" | "action"
  userKey: string
  max: number
  windowMs: number
}): Promise<{ ok: true } | { ok: false; reason: "rate_limited" }> {
  const redis = getRedis()
  if (!redis) return { ok: true }

  const key = `${PREFIX}:${args.scope}:${args.userKey}`
  const now = Date.now()
  const minScore = now - args.windowMs

  try {
    await redis.zremrangebyscore(key, 0, minScore)
    const cnt = await redis.zcard(key)
    if (cnt >= args.max) {
      return { ok: false, reason: "rate_limited" }
    }
    const member = `${now}:${Math.random().toString(36).slice(2)}`
    await redis.zadd(key, now, member)
    await redis.pexpire(key, args.windowMs + 1000)
    return { ok: true }
  } catch {
    return { ok: true }
  }
}

export async function rateLimitTableChat(senderId: number) {
  return allowSlidingWindow({
    scope: "chat",
    userKey: `table:${senderId}`,
    max: CHAT_MAX,
    windowMs: CHAT_WINDOW_MS,
  })
}

export async function rateLimitTableAction(senderId: number, actionType: string) {
  if (ACTION_RATE_LIMIT_EXCLUDED.has(actionType)) return { ok: true as const }
  return allowSlidingWindow({
    scope: "action",
    userKey: `table:${senderId}`,
    max: ACTION_MAX,
    windowMs: ACTION_WINDOW_MS,
  })
}

export async function rateLimitWsRoomChat(userId: number) {
  return allowSlidingWindow({
    scope: "chat",
    userKey: `wsroom:${userId}`,
    max: CHAT_MAX,
    windowMs: CHAT_WINDOW_MS,
  })
}
