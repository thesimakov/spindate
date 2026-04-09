import { getRedis } from "@/lib/redis"
import type { QueueEntry } from "@/lib/rooms/types"
import { roomQueueKey } from "@/lib/rooms/keys"

declare global {
  var __spindateRoomQueueMemory: QueueEntry[] | undefined
}

function memQueue(): QueueEntry[] {
  if (!globalThis.__spindateRoomQueueMemory) {
    globalThis.__spindateRoomQueueMemory = []
  }
  return globalThis.__spindateRoomQueueMemory
}

export class QueueManager {
  async enqueue(entry: QueueEntry): Promise<number> {
    const r = getRedis()
    if (r) {
      await r.rpush(roomQueueKey(), JSON.stringify(entry))
      return await r.llen(roomQueueKey())
    }
    const q = memQueue()
    q.push(entry)
    return q.length
  }

  async position(userId: number): Promise<number | null> {
    const r = getRedis()
    if (r) {
      const items = await r.lrange(roomQueueKey(), 0, -1)
      for (let i = 0; i < items.length; i++) {
        try {
          const e = JSON.parse(items[i]!) as QueueEntry
          if (e.userId === userId) return i + 1
        } catch {
          continue
        }
      }
      return null
    }
    const idx = memQueue().findIndex((e) => e.userId === userId)
    return idx >= 0 ? idx + 1 : null
  }

  async remove(userId: number): Promise<void> {
    const r = getRedis()
    if (r) {
      const items = await r.lrange(roomQueueKey(), 0, -1)
      const next = items.filter((raw) => {
        try {
          const e = JSON.parse(raw) as QueueEntry
          return e.userId !== userId
        } catch {
          return true
        }
      })
      const pipeline = r.pipeline()
      pipeline.del(roomQueueKey())
      if (next.length) pipeline.rpush(roomQueueKey(), ...next)
      await pipeline.exec()
      return
    }
    const q = memQueue()
    const f = q.filter((e) => e.userId !== userId)
    memQueue().length = 0
    memQueue().push(...f)
  }

  /** Убрать из очереди всех, кто ждал конкретную комнату (например после удаления стола). */
  async removeEntriesForRequestedRoom(roomId: number): Promise<void> {
    const tid = Math.floor(roomId)
    if (!Number.isInteger(tid) || tid <= 0) return
    const r = getRedis()
    if (r) {
      const items = await r.lrange(roomQueueKey(), 0, -1)
      const next = items.filter((raw) => {
        try {
          const e = JSON.parse(raw) as QueueEntry
          return e.requestedRoomId !== tid
        } catch {
          return true
        }
      })
      const pipeline = r.pipeline()
      pipeline.del(roomQueueKey())
      if (next.length) pipeline.rpush(roomQueueKey(), ...next)
      await pipeline.exec()
      return
    }
    const q = memQueue()
    const f = q.filter((e) => e.requestedRoomId !== tid)
    memQueue().length = 0
    memQueue().push(...f)
  }

  /** FIFO: забрать следующего ожидающего */
  async dequeue(): Promise<QueueEntry | null> {
    const r = getRedis()
    if (r) {
      const raw = await r.lpop(roomQueueKey())
      if (!raw) return null
      try {
        return JSON.parse(raw) as QueueEntry
      } catch {
        return null
      }
    }
    const q = memQueue()
    return q.shift() ?? null
  }
}
