import "server-only"

import Redis from "ioredis"

let client: Redis | null | undefined

/**
 * Redis для общего состояния между инстансами Next.js.
 * Если `REDIS_URL` не задан — возвращает `null` (используется in-memory fallback).
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    client = null
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
  }
  return client
}

export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL?.trim()
}
