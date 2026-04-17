import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

type PendingPlayerRequestRow = {
  id: number
  kind: string
  payload_json: string
}

export async function POST(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  const userId = auth?.userId ?? null
  const vkUserId = auth?.vkUserId ?? null
  if (!userId && vkUserId == null) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401, headers: NO_CACHE })
  }

  const db = getDb()

  const row = db.prepare(
    `SELECT id, kind, payload_json
     FROM admin_player_requests
     WHERE consumed_at IS NULL
       AND (
         (? IS NOT NULL AND target_user_id = ?)
         OR (? IS NOT NULL AND target_vk_user_id = ?)
       )
     ORDER BY id ASC
     LIMIT 1`,
  ).get(userId, userId, vkUserId, vkUserId) as PendingPlayerRequestRow | undefined

  if (!row) {
    return NextResponse.json({ ok: true, request: null }, { headers: NO_CACHE })
  }

  const now = Date.now()
  db.prepare(
    `UPDATE admin_player_requests
     SET consumed_at = ?, consumed_by_user_id = ?, consumed_by_vk_user_id = ?
     WHERE id = ?`,
  ).run(now, userId, vkUserId, row.id)

  let payload: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(row.payload_json) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>
  } catch {
    payload = {}
  }

  return NextResponse.json(
    { ok: true, request: { id: row.id, kind: row.kind, payload } },
    { headers: NO_CACHE },
  )
}

