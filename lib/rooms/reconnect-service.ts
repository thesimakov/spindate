import { getRedis } from "@/lib/redis"
import type { ReconnectSession } from "@/lib/rooms/types"
import { reconnectSessionKey } from "@/lib/rooms/keys"

export const RECONNECT_GRACE_SEC = 60

declare global {
  var __spindateReconnectMemory: Map<number, ReconnectSession> | undefined
}

function mem(): Map<number, ReconnectSession> {
  if (!globalThis.__spindateReconnectMemory) {
    globalThis.__spindateReconnectMemory = new Map()
  }
  return globalThis.__spindateReconnectMemory
}

export class ReconnectService {
  async saveSession(userId: number, roomId: number): Promise<void> {
    const payload: ReconnectSession = { roomId, disconnectedAt: Date.now() }
    const r = getRedis()
    if (r) {
      await r.set(
        reconnectSessionKey(userId),
        JSON.stringify(payload),
        "EX",
        RECONNECT_GRACE_SEC,
      )
      return
    }
    mem().set(userId, payload)
  }

  async getSession(userId: number): Promise<ReconnectSession | null> {
    const r = getRedis()
    if (r) {
      const raw = await r.get(reconnectSessionKey(userId))
      if (!raw) return null
      try {
        return JSON.parse(raw) as ReconnectSession
      } catch {
        return null
      }
    }
    return mem().get(userId) ?? null
  }

  async clearSession(userId: number): Promise<void> {
    const r = getRedis()
    if (r) {
      await r.del(reconnectSessionKey(userId))
      return
    }
    mem().delete(userId)
  }
}
