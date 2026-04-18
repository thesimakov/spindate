import "server-only"

import type { AuthMeErrorPayload, AuthMeSuccessPayload } from "@/lib/auth-me-payload"
import { getRedis } from "@/lib/redis"

const PREFIX = "spindate:v1:profile_bundle"
export const PROFILE_CACHE_TTL_SEC = 300

function cacheKey(userId: string): string {
  return `${PREFIX}:${userId}`
}

export async function getCachedAuthMeSuccess(
  userId: string,
  compute: () => AuthMeSuccessPayload | AuthMeErrorPayload,
): Promise<AuthMeSuccessPayload | AuthMeErrorPayload> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(cacheKey(userId))
      if (raw) {
        const parsed = JSON.parse(raw) as AuthMeSuccessPayload
        if (parsed?.ok === true) return parsed
      }
    } catch {
      // miss
    }
  }

  const fresh = compute()
  if (!fresh.ok) return fresh
  if (redis) {
    try {
      await redis.set(cacheKey(userId), JSON.stringify(fresh), "EX", PROFILE_CACHE_TTL_SEC)
    } catch {
      // ignore
    }
  }
  return fresh
}

export async function invalidateProfileCache(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(cacheKey(userId))
  } catch {
    // ignore
  }
}
