import type { GeneralChatMessage } from "@/lib/game-types"
import { getRedis } from "@/lib/redis"
import { randomUUID } from "crypto"
import { roomChatKey, ROOMS_PREFIX } from "@/lib/rooms/keys"

const MAX_MESSAGES = 500

declare global {
  var __spindateRoomChatMemory: Map<number, GeneralChatMessage[]> | undefined
}

function mem(): Map<number, GeneralChatMessage[]> {
  if (!globalThis.__spindateRoomChatMemory) {
    globalThis.__spindateRoomChatMemory = new Map()
  }
  return globalThis.__spindateRoomChatMemory
}

export class ChatService {
  async appendMessage(roomId: number, msg: Omit<GeneralChatMessage, "id"> & { id?: string }): Promise<GeneralChatMessage> {
    const full: GeneralChatMessage = {
      id: msg.id ?? randomUUID(),
      senderId: msg.senderId,
      senderName: msg.senderName,
      text: msg.text,
      timestamp: msg.timestamp,
    }
    const r = getRedis()
    if (r) {
      const key = roomChatKey(roomId)
      const raw = JSON.stringify(full)
      const pipeline = r.pipeline()
      pipeline.lpush(key, raw)
      pipeline.ltrim(key, 0, MAX_MESSAGES - 1)
      await pipeline.exec()
      return full
    }
    const m = mem()
    const list = m.get(roomId) ?? []
    list.unshift(full)
    m.set(roomId, list.slice(0, MAX_MESSAGES))
    return full
  }

  async getHistory(roomId: number): Promise<GeneralChatMessage[]> {
    const r = getRedis()
    if (r) {
      const key = roomChatKey(roomId)
      const rows = await r.lrange(key, 0, MAX_MESSAGES - 1)
      const out: GeneralChatMessage[] = []
      for (let i = rows.length - 1; i >= 0; i--) {
        try {
          out.push(JSON.parse(rows[i]!) as GeneralChatMessage)
        } catch {
          // skip
        }
      }
      return out
    }
    return [...(mem().get(roomId) ?? [])].reverse()
  }
}

/** Вся история чатов комнат: Redis (все ключи `…:chat:*`) + in-memory fallback. */
export async function purgeAllRoomChatHistory(): Promise<void> {
  mem().clear()
  const r = getRedis()
  if (!r) return
  const pattern = `${ROOMS_PREFIX}:chat:*`
  let cursor = "0"
  try {
    do {
      const [next, keys] = await r.scan(cursor, "MATCH", pattern, "COUNT", 200)
      cursor = next
      if (keys.length > 0) {
        await r.del(...keys)
      }
    } while (cursor !== "0")
  } catch (e) {
    console.warn("[room-chat] purge redis failed", e)
  }
}
