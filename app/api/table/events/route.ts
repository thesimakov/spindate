import { NextResponse } from "next/server"
import type { GameAction } from "@/lib/game-types"
import { pullTableEvents, pushTableEvent } from "@/lib/live-table-events-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

function parseIntSafe(raw: unknown, fallback = 0): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.floor(n)
}

function parseAction(raw: unknown): GameAction | null {
  if (!raw || typeof raw !== "object") return null
  const t = (raw as { type?: unknown }).type
  if (typeof t !== "string") return null
  return raw as GameAction
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const mode = body?.mode === "push" ? "push" : "pull"

  const tableId = parseIntSafe(body?.tableId, 0)
  if (!Number.isInteger(tableId) || tableId <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректный tableId" }, { status: 400 })
  }

  if (mode === "push") {
    const senderId = parseIntSafe(body?.senderId, 0)
    const action = parseAction(body?.action)
    if (!Number.isInteger(senderId) || senderId <= 0 || !action) {
      return NextResponse.json({ ok: false, error: "Некорректные данные события" }, { status: 400 })
    }
    const result = await pushTableEvent({ tableId, senderId, action })
    if (!result.ok) {
      const reason =
        "reason" in result && typeof result.reason === "string" && result.reason.trim()
          ? result.reason
          : "event_rejected"
      return NextResponse.json({ ok: false, error: "Событие отклонено", reason }, { status: 400, headers: NO_CACHE })
    }
    const debug =
      process.env.NODE_ENV === "development" && typeof result.turnKey === "string" && result.turnKey
        ? { turnKey: result.turnKey }
        : undefined
    return NextResponse.json({ ok: true, seq: result.seq, ...(debug ? { debug } : {}) }, { headers: NO_CACHE })
  }

  const sinceSeq = parseIntSafe(body?.sinceSeq, 0)
  const result = await pullTableEvents({ tableId, sinceSeq })
  return NextResponse.json(result, { headers: NO_CACHE })
}
