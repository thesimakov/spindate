import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"
import type { UserVisualPrefs } from "@/lib/game-types"
import { mergeVisualPrefsJson, parseVisualPrefsJson } from "@/lib/user-visual-prefs"

type GameStateRow = {
  voice_balance: number
  inventory_json: string
  visual_prefs_json?: string
}

export async function GET(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  const userId = auth?.userId ?? null
  const vkUserId = auth?.vkUserId ?? null
  const okUserId = auth?.okUserId ?? null
  if (!userId && vkUserId == null && okUserId == null) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const db = getDb()
  const row = userId
    ? (db
        .prepare(
          `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM user_game_state WHERE user_id = ?`,
        )
        .get(userId) as GameStateRow | undefined)
    : vkUserId != null
      ? (db
          .prepare(
            `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM vk_user_game_state WHERE vk_user_id = ?`,
          )
          .get(vkUserId) as GameStateRow | undefined)
      : (db
          .prepare(
            `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM ok_user_game_state WHERE ok_user_id = ?`,
          )
          .get(okUserId!) as GameStateRow | undefined)

  const voiceBalance = row?.voice_balance ?? 0
  let inventory: unknown[] = []
  if (row?.inventory_json) {
    try {
      inventory = JSON.parse(row.inventory_json) as unknown[]
    } catch {
      inventory = []
    }
  }
  const visualPrefs = parseVisualPrefsJson(row?.visual_prefs_json)

  return NextResponse.json({ ok: true, voiceBalance, inventory, visualPrefs: visualPrefs ?? {} })
}

export async function PUT(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  const userId = auth?.userId ?? null
  const vkUserId = auth?.vkUserId ?? null
  const okUserId = auth?.okUserId ?? null
  if (!userId && vkUserId == null && okUserId == null) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const voiceBalance = typeof body?.voiceBalance === "number" ? Math.max(0, body.voiceBalance) : undefined
  const inventory =
    Array.isArray(body?.inventory) && body.inventory.length >= 0
      ? body.inventory
      : undefined
  const status =
    typeof body?.status === "string"
      ? body.status.trim().slice(0, 15)
      : undefined
  const visualPatch =
    body?.visualPrefs != null && typeof body.visualPrefs === "object" && !Array.isArray(body.visualPrefs)
      ? (body.visualPrefs as Partial<UserVisualPrefs>)
      : undefined

  const db = getDb()
  const now = Date.now()

  if (voiceBalance !== undefined || inventory !== undefined || visualPatch !== undefined) {
    const existing = userId
      ? (db
          .prepare(
            `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM user_game_state WHERE user_id = ?`,
          )
          .get(userId) as GameStateRow | undefined)
      : vkUserId != null
        ? (db
            .prepare(
              `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM vk_user_game_state WHERE vk_user_id = ?`,
            )
            .get(vkUserId) as GameStateRow | undefined)
        : (db
            .prepare(
              `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM ok_user_game_state WHERE ok_user_id = ?`,
            )
            .get(okUserId!) as GameStateRow | undefined)

    const nextBalance = voiceBalance !== undefined ? voiceBalance : (existing?.voice_balance ?? 0)
    const nextInventoryJson =
      inventory !== undefined ? JSON.stringify(inventory) : (existing?.inventory_json ?? "[]")
    const nextVisualJson =
      visualPatch !== undefined
        ? mergeVisualPrefsJson(existing?.visual_prefs_json, visualPatch)
        : (existing?.visual_prefs_json ?? "{}")

    if (userId) {
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, visual_prefs_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           visual_prefs_json = excluded.visual_prefs_json,
           updated_at = excluded.updated_at`,
      ).run(userId, nextBalance, nextInventoryJson, nextVisualJson, now)
    } else if (vkUserId != null) {
      db.prepare(
        `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, visual_prefs_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(vk_user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           visual_prefs_json = excluded.visual_prefs_json,
           updated_at = excluded.updated_at`,
      ).run(vkUserId, nextBalance, nextInventoryJson, nextVisualJson, now)
    } else {
      db.prepare(
        `INSERT INTO ok_user_game_state (ok_user_id, voice_balance, inventory_json, visual_prefs_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(ok_user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           visual_prefs_json = excluded.visual_prefs_json,
           updated_at = excluded.updated_at`,
      ).run(okUserId!, nextBalance, nextInventoryJson, nextVisualJson, now)
    }
  }

  if (userId && status !== undefined) {
    db.prepare(
      `UPDATE player_profiles
       SET status = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(status, now, userId)
  }

  return NextResponse.json({ ok: true })
}
