import "server-only"

import Redis from "ioredis"

let client: Redis | null | undefined
let redisWarningLogged = false

function logRedisFallbackOnce(reason: "missing_url" | "client_init_failed") {
  if (redisWarningLogged) return
  if (process.env.NODE_ENV !== "production") return
  redisWarningLogged = true
  console.warn(
    "[sync/redis] Redis is unavailable, runtime falls back to in-memory state. Multi-instance sync can diverge.",
    JSON.stringify({ reason }),
  )
}

/**
 * Redis для общего состояния между инстансами Next.js.
 * Если `REDIS_URL` не задан — возвращает `null` (используется in-memory fallback).
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    client = null
    logRedisFallbackOnce("missing_url")
    return client
  }
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    })
  } catch {
    client = null
    logRedisFallbackOnce("client_init_failed")
  }
  return client
}

export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL?.trim()
}
