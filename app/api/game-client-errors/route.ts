import { NextRequest, NextResponse } from "next/server"
import {
  insertGameClientError,
  type GameClientErrorSource,
} from "@/lib/game-client-errors-server"

const ALLOWED_SOURCES = new Set<GameClientErrorSource>([
  "manual_diagnostics",
  "window_error",
  "unhandledrejection",
])

const MAX_BODY_BYTES = 64 * 1024
const RATE_WINDOW_MS = 60_000
const RATE_MAX_PER_WINDOW = 30

const ipBuckets = new Map<string, number[]>()

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for")
  if (xf) {
    const first = xf.split(",")[0]?.trim()
    if (first) return first.slice(0, 128)
  }
  const real = req.headers.get("x-real-ip")
  if (real?.trim()) return real.trim().slice(0, 128)
  return "unknown"
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now()
  const arr = (ipBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  arr.push(now)
  ipBuckets.set(ip, arr)
  if (arr.length > 200) ipBuckets.delete(ip)
  return arr.length <= RATE_MAX_PER_WINDOW
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    if (!rateLimitOk(ip)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 })
    }

    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 400 })
    }

    let body: unknown
    try {
      body = JSON.parse(raw) as unknown
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
    }

    const o = body as Record<string, unknown>
    const source = o.source
    if (typeof source !== "string" || !ALLOWED_SOURCES.has(source as GameClientErrorSource)) {
      return NextResponse.json({ ok: false, error: "invalid_source" }, { status: 400 })
    }

    const message = typeof o.message === "string" ? o.message : ""
    const stack = o.stack == null ? null : String(o.stack)
    let payload: Record<string, unknown> = {}
    if (o.payload != null && typeof o.payload === "object" && !Array.isArray(o.payload)) {
      payload = o.payload as Record<string, unknown>
    }

    const r = insertGameClientError({
      source: source as GameClientErrorSource,
      message: message || "(без текста)",
      stack,
      payload,
    })
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: r.id })
  } catch (e) {
    console.error("[game-client-errors]", e)
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
