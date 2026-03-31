import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { verifyPassword } from "@/lib/auth/password"
import { newId, newSessionToken, setSessionCookie, sha256Base64 } from "@/lib/auth/session"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const username = typeof body?.username === "string" ? body.username.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Введите логин и пароль" }, { status: 400 })
  }

  const db = getDb()
  const user = db
    .prepare(`SELECT id, password_hash, password_salt FROM users WHERE username = ?`)
    .get(username) as { id: string; password_hash: string; password_salt: string } | undefined

  if (!user) {
    return NextResponse.json({ ok: false, error: "Неверный логин или пароль" }, { status: 401 })
  }

  const flags = getAdminFlagsForUserId(user.id)
  const r = isRestricted(flags)
  if (r.deleted) return NextResponse.json({ ok: false, error: "Аккаунт удалён" }, { status: 403 })
  if (r.blocked) return NextResponse.json({ ok: false, error: "Вы заблокированы" }, { status: 403 })
  if (r.banned) return NextResponse.json({ ok: false, error: "Вы временно забанены" }, { status: 403 })

  const ok = await verifyPassword(password, user.password_salt, user.password_hash)
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Неверный логин или пароль" }, { status: 401 })
  }

  const profile = db
    .prepare(
      `SELECT display_name, avatar_url, status, gender, age, purpose FROM player_profiles WHERE user_id = ?`,
    )
    .get(user.id) as
    | { display_name: string; avatar_url: string; status: string; gender: string; age: number; purpose: string }
    | undefined

  const displayName = profile?.display_name ?? username
  const gender = profile?.gender === "female" ? "female" : "male"
  const avatarUrl =
    profile?.avatar_url || (gender === "female" ? "/assets/avatar-female.svg" : "/assets/avatar-male.svg")
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"
  const status = profile?.status ?? ""

  const gameStateRow = db
    .prepare(`SELECT voice_balance, inventory_json FROM user_game_state WHERE user_id = ?`)
    .get(user.id) as { voice_balance: number; inventory_json: string } | undefined
  const voiceBalance = gameStateRow?.voice_balance ?? 0
  let inventory: unknown[] = []
  if (gameStateRow?.inventory_json) {
    try {
      inventory = JSON.parse(gameStateRow.inventory_json) as unknown[]
    } catch {
      inventory = []
    }
  }

  const now = Date.now()
  const token = newSessionToken()
  const tokenHash = sha256Base64(token)
  const sessionId = newId()
  const ttlMs = 1000 * 60 * 60 * 24 * 14
  const expiresAt = now + ttlMs

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(sessionId, user.id, tokenHash, now, expiresAt)

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username,
      displayName,
      avatarUrl,
      gender,
      age,
      purpose,
      status,
    },
    voiceBalance,
    inventory,
    sessionToken: token,
  })
  setSessionCookie(res, token, expiresAt)
  return res
}

