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

