import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getDb } from "@/lib/db"
import { upsertAdminFlags } from "@/lib/admin-flags"
import { leaveLiveTable } from "@/lib/live-tables-server"
import { invalidateProfileCache } from "@/lib/profile-cache"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

type Action =
  | "block_1w"
  | "ban_2h"
  | "delete_forever"
  | "clear_block"
  | "clear_ban"
  | "send_vk_group_request"

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
  let hasDbUser = false
  if (!userId || looksSynthetic) {
    if (vkUserId != null && vkUserId > 0) {
      const row = db
        .prepare(`SELECT id FROM users WHERE vk_user_id = ? LIMIT 1`)
        .get(vkUserId) as { id: string } | undefined
      if (row?.id) {
        userId = row.id
        hasDbUser = true
      }
    }
  }
  if (!hasDbUser && userId && !userId.startsWith("live:")) {
    const row = db.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).get(userId) as { id: string } | undefined
    hasDbUser = Boolean(row?.id)
  }

  if (!hasDbUser && action !== "delete_forever" && !(action === "send_vk_group_request" && vkUserId != null && vkUserId > 0)) {
    return NextResponse.json(
      { ok: false, error: "user_not_found_for_action" },
      { status: 404, headers: NO_CACHE },
    )
  }

  const now = Date.now()

  if (action === "block_1w") {
    if (!hasDbUser) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404, headers: NO_CACHE })
    upsertAdminFlags({ userId, blockedUntil: now + 7 * 24 * 60 * 60 * 1000 })
  } else if (action === "ban_2h") {
    if (!hasDbUser) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404, headers: NO_CACHE })
    upsertAdminFlags({ userId, bannedUntil: now + 2 * 60 * 60 * 1000 })
  } else if (action === "clear_block") {
    if (!hasDbUser) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404, headers: NO_CACHE })
    upsertAdminFlags({ userId, blockedUntil: null })
  } else if (action === "clear_ban") {
    if (!hasDbUser) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404, headers: NO_CACHE })
    upsertAdminFlags({ userId, bannedUntil: null })
  } else if (action === "delete_forever") {
    // Сразу выкинуть из live-стола, если присутствует
    if (playerId != null && playerId > 0) {
      await leaveLiveTable(playerId)
    }

    if (hasDbUser) {
      // Санкция: пометить удалённым и обнулить все игровые/профильные данные.
      upsertAdminFlags({ userId, deleted: true, blockedUntil: null, bannedUntil: null })

      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, visual_prefs_json, updated_at)
         VALUES (?, 0, '[]', '{}', ?)
         ON CONFLICT(user_id) DO UPDATE SET
           voice_balance = 0,
           inventory_json = '[]',
           visual_prefs_json = '{}',
           updated_at = excluded.updated_at`,
      ).run(userId, now)

      db.prepare(
        `UPDATE player_profiles
         SET display_name = '',
             avatar_url = '',
             status = '',
             gender = 'male',
             age = 25,
             purpose = 'communication',
             city = '',
             zodiac = '',
             interests = '',
             updated_at = ?
         WHERE user_id = ?`,
      ).run(now, userId)

      await invalidateProfileCache(userId)

      // Удалить активные сессии (чтобы сразу «вылетело» при следующих запросах)
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId)
    }

    // Для VK-only аккаунтов (без users.id) тоже обнуляем состояние.
    if (vkUserId != null && vkUserId > 0) {
      db.prepare(
        `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, visual_prefs_json, updated_at)
         VALUES (?, 0, '[]', '{}', ?)
         ON CONFLICT(vk_user_id) DO UPDATE SET
           voice_balance = 0,
           inventory_json = '[]',
           visual_prefs_json = '{}',
           updated_at = excluded.updated_at`,
      ).run(vkUserId, now)
    }
  } else if (action === "send_vk_group_request") {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS admin_player_requests (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         kind TEXT NOT NULL,
         target_user_id TEXT,
         target_vk_user_id INTEGER,
         payload_json TEXT NOT NULL DEFAULT '{}',
         created_at INTEGER NOT NULL,
         consumed_at INTEGER,
         consumed_by_user_id TEXT,
         consumed_by_vk_user_id INTEGER
       )`,
    ).run()

    const targetUserId = hasDbUser ? userId : null
    const targetVkUserId = vkUserId != null && vkUserId > 0 ? vkUserId : null
    if (!targetUserId && targetVkUserId == null) {
      return NextResponse.json(
        { ok: false, error: "request_target_not_found" },
        { status: 400, headers: NO_CACHE },
      )
    }
    db.prepare(
      `INSERT INTO admin_player_requests (
         kind, target_user_id, target_vk_user_id, payload_json, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).run("open_vk_group_news_modal", targetUserId, targetVkUserId, "{}", now)
  }

  return NextResponse.json({ ok: true }, { headers: NO_CACHE })
}

