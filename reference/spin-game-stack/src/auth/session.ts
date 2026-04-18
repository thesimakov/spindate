import { randomBytes } from "node:crypto"
import type { Redis } from "ioredis"
import { SESSION_PREFIX } from "../redis/client.js"

const TTL_SEC = 60 * 60 * 24 * 14 // 14 дней

export function createSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export async function saveSession(redis: Redis, token: string, userId: string): Promise<void> {
  await redis.setex(`${SESSION_PREFIX}${token}`, TTL_SEC, userId)
}

export async function resolveUserId(redis: Redis, token: string | undefined): Promise<string | null> {
  if (!token) return null
  const id = await redis.get(`${SESSION_PREFIX}${token}`)
  return id
}

export async function revokeSession(redis: Redis, token: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${token}`)
}
