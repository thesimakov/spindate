import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { verifyPassword } from "@/lib/auth/password"
import { newId, newSessionToken, sha256Base64 } from "@/lib/auth/session"

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

  const ok = await verifyPassword(password, user.password_salt, user.password_hash)
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Неверный логин или пароль" }, { status: 401 })
  }

  const profile = db
    .prepare(
      `SELECT display_name, avatar_url, gender, age, purpose FROM player_profiles WHERE user_id = ?`,
    )
    .get(user.id) as
    | { display_name: string; avatar_url: string; gender: string; age: number; purpose: string }
    | undefined

  const displayName = profile?.display_name ?? username
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`
  const gender = profile?.gender ?? "male"
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"

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
    },
    voiceBalance,
    inventory,
  })
  const isProd = process.env.NODE_ENV === "production"
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires: new Date(expiresAt),
  })
  return res
}

