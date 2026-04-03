import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getSessionTokenFromRequest, sha256Base64 } from "@/lib/auth/session"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"

export async function GET(req: Request) {
  const token = getSessionTokenFromRequest(req)
  if (!token) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const db = getDb()
  const tokenHash = sha256Base64(token)
  const now = Date.now()

  const session = db
    .prepare(
      `SELECT s.user_id FROM sessions s
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as { user_id: string } | undefined

  if (!session) {
    return NextResponse.json({ ok: false, error: "Сессия истекла" }, { status: 401 })
  }

  const userRow = db
    .prepare(`SELECT id, username, vk_user_id FROM users WHERE id = ?`)
    .get(session.user_id) as { id: string; username: string; vk_user_id: number | null } | undefined

  if (!userRow) {
    return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 401 })
  }

  const flags = getAdminFlagsForUserId(userRow.id)
  const r = isRestricted(flags)
  if (r.deleted) return NextResponse.json({ ok: false, error: "Аккаунт удалён" }, { status: 403 })
  if (r.blocked) return NextResponse.json({ ok: false, error: "Вы заблокированы" }, { status: 403 })
  if (r.banned) return NextResponse.json({ ok: false, error: "Вы временно забанены" }, { status: 403 })

  const profile = db
    .prepare(
      `SELECT display_name, avatar_url, status, gender, age, purpose, city, zodiac FROM player_profiles WHERE user_id = ?`,
    )
    .get(session.user_id) as
    | { display_name: string; avatar_url: string; status: string; gender: string; age: number; purpose: string; city: string; zodiac: string }
    | undefined

  const displayName = profile?.display_name ?? userRow.username
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(userRow.username)}`
  const gender = profile?.gender ?? "male"
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"
  const status = profile?.status ?? ""

  return NextResponse.json({
    ok: true,
    user: {
      id: userRow.id,
      username: userRow.username,
      displayName,
      avatarUrl,
      gender,
      age,
      purpose,
      status,
      ...(userRow.vk_user_id != null ? { vkUserId: userRow.vk_user_id } : {}),
      ...(profile?.city ? { city: profile.city } : {}),
      ...(profile?.zodiac ? { zodiac: profile.zodiac } : {}),
    },
  })
}
