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

const PM_TTL_SEC = 24 * 60 * 60
const MAX_MESSAGES = 200

declare global {
  var __spindatePmMemory: Map<string, ChatBucket> | undefined
}

function getMemoryStore(): Map<string, ChatBucket> {
  if (!globalThis.__spindatePmMemory) {
    globalThis.__spindatePmMemory = new Map()
  }
  return globalThis.__spindatePmMemory
}

function pmKey(a: number, b: number): string {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return `spindate:v1:pm:${lo}:${hi}`
}

function parseBucket(raw: string | null): ChatBucket {
  if (!raw) return { messages: [], updatedAt: Date.now() }
  try {
    return JSON.parse(raw) as ChatBucket
  } catch {
    return { messages: [], updatedAt: Date.now() }
  }
}

/** POST — отправить сообщение */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false }, { status: 400 })

  const senderId = Number(body.senderId)
  const toId = Number(body.toId)
  const msg: StoredMessage = {
    id: String(body.id ?? `${senderId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    senderId,
    text: String(body.text ?? ""),
    timestamp: Number(body.timestamp ?? Date.now()),
    ...(body.gift ? { gift: String(body.gift) } : {}),
  }

  if (!Number.isInteger(senderId) || !Number.isInteger(toId) || senderId === toId) {
    return NextResponse.json({ ok: false, error: "bad ids" }, { status: 400 })
  }
  if (!msg.text && !msg.gift) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 })
  }

  const key = pmKey(senderId, toId)

  const redis = getRedis()
  if (redis) {
    const raw = await redis.get(key)
    const bucket = parseBucket(raw)
    bucket.messages.push(msg)
    if (bucket.messages.length > MAX_MESSAGES) {
      bucket.messages = bucket.messages.slice(-MAX_MESSAGES)
    }
    bucket.updatedAt = Date.now()
    await redis.set(key, JSON.stringify(bucket), "EX", PM_TTL_SEC)
  } else {
    const store = getMemoryStore()
    const bucket = store.get(key) ?? { messages: [], updatedAt: Date.now() }
    bucket.messages.push(msg)
    if (bucket.messages.length > MAX_MESSAGES) {
      bucket.messages = bucket.messages.slice(-MAX_MESSAGES)
    }
    bucket.updatedAt = Date.now()
    store.set(key, bucket)
  }

  return NextResponse.json({ ok: true })
}

/** GET — получить сообщения: ?a=ID1&b=ID2&since=TIMESTAMP */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const a = Number(url.searchParams.get("a"))
  const b = Number(url.searchParams.get("b"))
  const since = Number(url.searchParams.get("since") ?? 0)

  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
    return NextResponse.json({ ok: false, error: "bad ids" }, { status: 400 })
  }

  const key = pmKey(a, b)

  const redis = getRedis()
  let bucket: ChatBucket
  if (redis) {
    bucket = parseBucket(await redis.get(key))
  } else {
    bucket = getMemoryStore().get(key) ?? { messages: [], updatedAt: Date.now() }
  }

  const messages = since > 0 ? bucket.messages.filter((m) => m.timestamp > since) : bucket.messages

  return NextResponse.json({ ok: true, messages })
}
