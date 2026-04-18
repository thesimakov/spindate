import "server-only"

import { getRedis } from "@/lib/redis"
import type { ServerToClientMessage } from "@/lib/rooms/types"

const CH_PREFIX = "spindate:v1:ws_room"

let subscriberStarted = false

/**
 * Fan-out сообщений комнаты между несколькими процессами `custom-server` (WebSocket).
 * Без Redis каждый процесс изолирован — используйте один инстанс или задайте REDIS_URL.
 */
export function ensureWsRoomSubscriber(
  deliverLocal: (roomId: number, msg: ServerToClientMessage) => void,
): void {
  if (subscriberStarted) return
  const redis = getRedis()
  if (!redis) return
  subscriberStarted = true

  const sub = redis.duplicate()
  void (async () => {
    try {
      await sub.connect()
      sub.on("pmessage", (_pattern, channel, payload) => {
        const last = channel.split(":").pop()
        const roomId = last != null ? Number(last) : NaN
        if (!Number.isFinite(roomId)) return
        try {
          const msg = JSON.parse(payload) as ServerToClientMessage
          deliverLocal(roomId, msg)
        } catch {
          // ignore bad payload
        }
      })
      await sub.psubscribe(`${CH_PREFIX}:*`)
    } catch (e) {
      console.warn("[ws-room/redis] psubscribe failed", e)
      subscriberStarted = false
    }
  })()
}

export async function publishWsRoomMessage(roomId: number, msg: ServerToClientMessage): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.publish(`${CH_PREFIX}:${roomId}`, JSON.stringify(msg))
  } catch {
    // ignore
  }
}
