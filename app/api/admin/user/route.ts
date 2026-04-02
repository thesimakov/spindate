import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getDb } from "@/lib/db"
import { upsertAdminFlags } from "@/lib/admin-flags"
import { leaveLiveTable } from "@/lib/live-tables-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

type Action =
  | "block_1w"
  | "ban_2h"
  | "delete_forever"
  | "clear_block"
  | "clear_ban"

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const body = await req.json().catch(() => null)
  const rawUserId = typeof body?.userId === "string" ? body.userId : ""
  const vkUserId = Number.isInteger(Number(body?.vkUserId)) ? Math.floor(Number(body?.vkUserId)) : null
  const action = body?.action as Action | undefined
  const playerId = Number.isInteger(Number(body?.playerId)) ? Math.floor(Number(body?.playerId)) : null

  if (!action) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
  }

  const db = getDb()
  let userId = rawUserId
  const looksSynthetic = userId.startsWith("live:")
  if (!userId || looksSynthetic) {
    if (vkUserId != null && vkUserId > 0) {
      const row = db
        .prepare(`SELECT id FROM users WHERE vk_user_id = ? LIMIT 1`)
        .get(vkUserId) as { id: string } | undefined
      if (row?.id) userId = row.id
    }
  }
  if (!userId || userId.startsWith("live:")) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404, headers: NO_CACHE })
  }

  const now = Date.now()

  if (action === "block_1w") {
    upsertAdminFlags({ userId, blockedUntil: now + 7 * 24 * 60 * 60 * 1000 })
  } else if (action === "ban_2h") {
    upsertAdminFlags({ userId, bannedUntil: now + 2 * 60 * 60 * 1000 })
  } else if (action === "clear_block") {
    upsertAdminFlags({ userId, blockedUntil: null })
  } else if (action === "clear_ban") {
    upsertAdminFlags({ userId, bannedUntil: null })
  } else if (action === "delete_forever") {
    upsertAdminFlags({ userId, deleted: true, blockedUntil: null, bannedUntil: null })
    // Сразу выкинуть из live-стола, если присутствует
    if (playerId != null && playerId > 0) {
      await leaveLiveTable(playerId)
    }
    // Удалить активные сессии (чтобы сразу «вылетело» при следующих запросах)
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId)
    // На всякий случай — если это VK, почистить сохранённое состояние «вк-таблицы»
    if (vkUserId != null && vkUserId > 0) {
      db.prepare(`DELETE FROM vk_user_game_state WHERE vk_user_id = ?`).run(vkUserId)
    }
  }

  return NextResponse.json({ ok: true }, { headers: NO_CACHE })
}

