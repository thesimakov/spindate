import { Redis } from "ioredis"
import type { Env } from "../config/env.js"

let client: Redis | null = null

export function getRedis(env: Env): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })
  }
  return client
}

export const SESSION_PREFIX = "spin:session:"
export const MATCH_QUEUE_PREFIX = "spin:match:"
