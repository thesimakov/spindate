import type { Redis } from "ioredis"
import { MATCH_QUEUE_PREFIX } from "../redis/client.js"

/** FIFO-очередь игроков, ищущих стол (упрощённый matchmaking). */
export async function enqueueMatch(redis: Redis, userId: string): Promise<void> {
  await redis.rpush(`${MATCH_QUEUE_PREFIX}global`, userId)
}

export async function dequeueMatch(redis: Redis): Promise<string | null> {
  return redis.lpop(`${MATCH_QUEUE_PREFIX}global`)
}
