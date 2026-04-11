import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { listGameClientErrors } from "@/lib/game-client-errors-server"

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req)
  if (deny) return deny

  const url = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "80", 10) || 80))
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0)

  const items = listGameClientErrors({ limit, offset }).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    message: row.message,
    stack: row.stack,
    payload: (() => {
      try {
        return JSON.parse(row.payload_json) as unknown
      } catch {
        return null
      }
    })(),
  }))

  return NextResponse.json({ ok: true, items })
}
