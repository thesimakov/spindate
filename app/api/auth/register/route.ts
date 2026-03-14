import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { generateSalt, hashPassword } from "@/lib/auth/password"
import { newId, newSessionToken, sha256Base64 } from "@/lib/auth/session"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const username = typeof body?.username === "string" ? body.username.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (username.length < 3) {
    return NextResponse.json({ ok: false, error: "Логин слишком короткий" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "Пароль слишком короткий" }, { status: 400 })
  }

  const db = getDb()
  const now = Date.now()
  const salt = generateSalt()
  const passwordHash = await hashPassword(password, salt)
  const userId = newId()

  try {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, password_salt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(userId, username, passwordHash, salt, now, now)
  } catch {
    return NextResponse.json({ ok: false, error: "Логин уже занят" }, { status: 409 })
  }

  // session
  const token = newSessionToken()
  const tokenHash = sha256Base64(token)
  const sessionId = newId()
  const ttlMs = 1000 * 60 * 60 * 24 * 14 // 14 дней
  const expiresAt = now + ttlMs

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(sessionId, userId, tokenHash, now, expiresAt)

  const res = NextResponse.json({ ok: true })
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

