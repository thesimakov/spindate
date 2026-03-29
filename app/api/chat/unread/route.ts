import { NextResponse } from "next/server"
import { getRedis } from "@/lib/redis"

interface StoredMessage {
  id: string
  senderId: number
  text: string
  timestamp: number
  gift?: string
}

interface ChatBucket {
  messages: StoredMessage[]
  updatedAt: number
}

declare global {
  var __spindatePmMemory: Map<string, ChatBucket> | undefined
}

function getMemoryStore(): Map<string, ChatBucket> {
  if (!globalThis.__spindatePmMemory) {
    globalThis.__spindatePmMemory = new Map()
  }
  return globalThis.__spindatePmMemory
}

/**
 * GET /api/chat/unread?userId=ID&peers=1,2,3&since=TS
 * Возвращает { ok, unread: { [peerId]: { count, lastMessage } } }
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = Number(url.searchParams.get("userId"))
  const peersRaw = url.searchParams.get("peers") ?? ""
  const since = Number(url.searchParams.get("since") ?? 0)

  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ ok: false, error: "bad userId" }, { status: 400 })
  }

  const peerIds = peersRaw
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && n !== userId)

  if (peerIds.length === 0) {
    return NextResponse.json({ ok: true, unread: {} })
  }

  const redis = getRedis()
  const unread: Record<number, { count: number; lastMessage: StoredMessage | null; senderId: number }> = {}

  for (const peerId of peerIds) {
    const [lo, hi] = userId < peerId ? [userId, peerId] : [peerId, userId]
    const key = `spindate:v1:pm:${lo}:${hi}`

    let bucket: ChatBucket
    if (redis) {
      const raw = await redis.get(key)
      bucket = raw ? (JSON.parse(raw) as ChatBucket) : { messages: [], updatedAt: 0 }
    } else {
      bucket = getMemoryStore().get(key) ?? { messages: [], updatedAt: 0 }
    }

    const incoming = bucket.messages.filter((m) => m.senderId !== userId && m.timestamp > since)
    if (incoming.length > 0) {
      unread[peerId] = {
        count: incoming.length,
        lastMessage: incoming[incoming.length - 1],
        senderId: incoming[incoming.length - 1].senderId,
      }
    }
  }

  return NextResponse.json({ ok: true, unread })
}
