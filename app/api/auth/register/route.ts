import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { generateSalt, hashPassword } from "@/lib/auth/password"
import { newId, newSessionToken, setSessionCookie, sha256Base64 } from "@/lib/auth/session"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"

const VALID_GENDERS = ["male", "female"] as const
const VALID_PURPOSES = ["relationships", "communication", "love"] as const

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const username = typeof body?.username === "string" ? body.username.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : ""
  const age = typeof body?.age === "number" ? body.age : typeof body?.age === "string" ? parseInt(body.age, 10) : 25
  const gender = VALID_GENDERS.includes(body?.gender) ? body.gender : "male"
  const purpose = VALID_PURPOSES.includes(body?.purpose) ? body.purpose : "communication"

  if (username.length < 3) {
    return NextResponse.json({ ok: false, error: "Логин слишком короткий" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "Пароль слишком короткий" }, { status: 400 })
  }
  const ageNum = Number.isFinite(age) && age >= 18 && age <= 120 ? age : 25

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

  // Если админ заранее пометил userId (редко), не даём создать сессию
  try {
    const flags = getAdminFlagsForUserId(userId)
    const r = isRestricted(flags)
    if (r.deleted || r.blocked || r.banned) {
      return NextResponse.json({ ok: false, error: "Регистрация запрещена" }, { status: 403 })
    }
  } catch {
    // ignore
  }

  const avatarUrl = gender === "female" ? "/assets/avatar-female.svg" : "/assets/avatar-male.svg"
  const profileDisplayName = displayName.length > 0 ? displayName : username
  db.prepare(
    `INSERT INTO player_profiles (user_id, display_name, avatar_url, status, gender, age, purpose, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
  ).run(userId, profileDisplayName, avatarUrl, gender, ageNum, purpose, now, now)

  db.prepare(
    `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
     VALUES (?, 150, '[]', ?)`,
  ).run(userId, now)

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

  const res = NextResponse.json({
    ok: true,
    user: {
      id: userId,
      username,
      displayName: profileDisplayName,
      avatarUrl,
      gender,
      age: ageNum,
      purpose,
      status: "",
    },
    voiceBalance: 150,
    inventory: [],
    sessionToken: token,
  })
  setSessionCookie(res, token, expiresAt)
  return res
}

