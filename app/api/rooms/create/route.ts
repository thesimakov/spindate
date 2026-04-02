import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getSessionTokenFromRequest, sha256Base64 } from "@/lib/auth/session"
import { createUserRoomPaid, getCreateRoomCost } from "@/lib/rooms/room-registry"
import { normalizeRoomBottleSkin, normalizeRoomTableStyle } from "@/lib/rooms/room-appearance"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

function getUserIdFromSession(req: Request): string | null {
  const token = getSessionTokenFromRequest(req)
  if (!token) return null
  const db = getDb()
  const tokenHash = sha256Base64(token)
  const now = Date.now()
  const row = db
    .prepare(`SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?`)
    .get(tokenHash, now) as { user_id: string } | undefined
  return row?.user_id ?? null
}

function getVkUserIdFromRequest(req: Request): number | null {
  const url = new URL(req.url)
  const raw = url.searchParams.get("vk_user_id")
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

export async function POST(req: Request) {
  try {
    const userId = getUserIdFromSession(req)
    const vkUserId = userId ? null : getVkUserIdFromRequest(req)
    if (!userId && !vkUserId) {
      return NextResponse.json(
        { ok: false, error: "Войдите в аккаунт, чтобы создать стол" },
        { status: 401, headers: NO_CACHE },
      )
    }

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name : ""
    const bottleSkin = normalizeRoomBottleSkin(body?.bottleSkin)
    const tableStyle = normalizeRoomTableStyle(body?.tableStyle)

    const db = getDb()
    const now = Date.now()
    const COST_HEARTS = await getCreateRoomCost()

    const existing = userId
      ? (db
          .prepare(`SELECT voice_balance, inventory_json FROM user_game_state WHERE user_id = ?`)
          .get(userId) as { voice_balance: number; inventory_json: string } | undefined)
      : (db
          .prepare(`SELECT voice_balance, inventory_json FROM vk_user_game_state WHERE vk_user_id = ?`)
          .get(vkUserId) as { voice_balance: number; inventory_json: string } | undefined)

    const balance = existing?.voice_balance ?? 0
    if (balance < COST_HEARTS) {
      return NextResponse.json(
        {
          ok: false,
          error: `На сервере ${balance} ❤, нужно ${COST_HEARTS}. Откройте игру и дождитесь сохранения баланса.`,
        },
        { status: 400, headers: NO_CACHE },
      )
    }

    const nextBalance = balance - COST_HEARTS
    const createdById = userId ? hashUserIdToPositiveNumber(userId) : vkUserId!
    const invJson = existing?.inventory_json ?? "[]"

    if (userId) {
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           updated_at = excluded.updated_at`,
      ).run(userId, nextBalance, invJson, now)
    } else {
      db.prepare(
        `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(vk_user_id) DO UPDATE SET
           voice_balance = excluded.voice_balance,
           inventory_json = excluded.inventory_json,
           updated_at = excluded.updated_at`,
      ).run(vkUserId, nextBalance, invJson, now)
    }

    try {
      const room = await createUserRoomPaid(name, createdById, { bottleSkin, tableStyle })
      return NextResponse.json(
        { ok: true, room, voiceBalance: nextBalance, cost: COST_HEARTS },
        { headers: NO_CACHE },
      )
    } catch (roomErr) {
      try {
        if (userId) {
          db.prepare(`UPDATE user_game_state SET voice_balance = ?, updated_at = ? WHERE user_id = ?`).run(
            balance,
            now,
            userId,
          )
        } else {
          db.prepare(`UPDATE vk_user_game_state SET voice_balance = ?, updated_at = ? WHERE vk_user_id = ?`).run(
            balance,
            now,
            vkUserId,
          )
        }
      } catch (refundErr) {
        console.error("[api/rooms/create] refund failed", refundErr)
      }
      throw roomErr
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/rooms/create]", e)
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development"
            ? msg
            : "Сервер не смог создать стол. Попробуйте ещё раз через минуту.",
      },
      { status: 500, headers: NO_CACHE },
    )
  }
}

/** Согласовано с client Player.id для login-пользователей */
function hashUserIdToPositiveNumber(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i)
    h = h | 0
  }
  const n = Math.abs(h) || 1
  return n < 10000 ? n + 10000 : n
}
