import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sha256Base64 } from "@/lib/auth/session"

export async function GET(req: Request) {
  const token = req.headers.get("cookie")?.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? null
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

  const profile = db
    .prepare(
      `SELECT display_name, avatar_url, gender, age, purpose FROM player_profiles WHERE user_id = ?`,
    )
    .get(session.user_id) as
    | { display_name: string; avatar_url: string; gender: string; age: number; purpose: string }
    | undefined

  const displayName = profile?.display_name ?? userRow.username
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(userRow.username)}`
  const gender = profile?.gender ?? "male"
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"

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
      ...(userRow.vk_user_id != null ? { vkUserId: userRow.vk_user_id } : {}),
    },
  })
}
