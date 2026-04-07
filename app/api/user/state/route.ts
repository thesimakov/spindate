import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"

export async function GET(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  const userId = auth?.userId ?? null
  const vkUserId = auth?.vkUserId ?? null
  if (!userId && vkUserId == null) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const db = getDb()
  const row = userId
    ? (db
        .prepare(`SELECT voice_balance, inventory_json FROM user_game_state WHERE user_id = ?`)
        .get(userId) as { voice_balance: number; inventory_json: string } | undefined)
    : (db
        .prepare(`SELECT voice_balance, inventory_json FROM vk_user_game_state WHERE vk_user_id = ?`)
        .get(vkUserId) as { voice_balance: number; inventory_json: string } | undefined)

  const voiceBalance = row?.voice_balance ?? 0
  let inventory: unknown[] = []
  if (row?.inventory_json) {
    try {
      inventory = JSON.parse(row.inventory_json) as unknown[]
    } catch {
      inventory = []
    }
  }

  return NextResponse.json({ ok: true, voiceBalance, inventory })
}

export async function PUT(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  const userId = auth?.userId ?? null
  const vkUserId = auth?.vkUserId ?? null
  if (!userId && vkUserId == null) {
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

  const db = getDb()
  const now = Date.now()

  if (voiceBalance !== undefined || inventory !== undefined) {
    const existing = userId
      ? (db
          .prepare(`SELECT voice_balance, inventory_json FROM user_game_state WHERE user_id = ?`)
          .get(userId) as { voice_balance: number; inventory_json: string } | undefined)
      : (db
          .prepare(`SELECT voice_balance, inventory_json FROM vk_user_game_state WHERE vk_user_id = ?`)
          .get(vkUserId) as { voice_balance: number; inventory_json: string } | undefined)

    const nextBalance = voiceBalance !== undefined ? voiceBalance : (existing?.voice_balance ?? 0)
    const nextInventoryJson =
      inventory !== undefined ? JSON.stringify(inventory) : (existing?.inventory_json ?? "[]")

    if (userId) {
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           updated_at = excluded.updated_at`,
      ).run(userId, nextBalance, nextInventoryJson, now)
    } else {
      db.prepare(
        `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(vk_user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           updated_at = excluded.updated_at`,
      ).run(vkUserId, nextBalance, nextInventoryJson, now)
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
