import "server-only"

import Redis from "ioredis"

let singleton: Redis | null = null

/**
 * Одно соединение ioredis для BullMQ (обязательно `maxRetriesPerRequest: null`).
 */
export function getBullmqConnection(): Redis {
  if (singleton) return singleton
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    throw new Error("REDIS_URL is required for BullMQ")
  }
  singleton = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  })
  return singleton
}

export const BACKGROUND_QUEUE_NAME = "spindate-background"
