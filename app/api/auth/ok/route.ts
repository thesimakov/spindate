import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { generateSalt, hashPassword } from "@/lib/auth/password"
import { newId, newSessionToken, setSessionCookie, sha256Base64 } from "@/lib/auth/session"
import { parseOkApplicationKey, parseOkLoggedUserId, verifyOkLaunchParams } from "@/lib/ok-launch-params"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"
import { parseVisualPrefsJson } from "@/lib/user-visual-prefs"

const VALID_GENDERS = ["male", "female"] as const
const VALID_PURPOSES = ["relationships", "communication", "love"] as const

function getOkApplicationSecret(): string {
  return (process.env.OK_APPLICATION_SECRET ?? "").trim()
}

function sessionCookieResponse(body: Record<string, unknown>, token: string, expiresAt: number) {
  const res = NextResponse.json(body)
  setSessionCookie(res, token, expiresAt)
  return res
}

function buildUserPayload(
  db: ReturnType<typeof getDb>,
  userId: string,
  username: string,
  okUserId: number | null,
) {
  const profile = db
    .prepare(
      `SELECT display_name, avatar_url, status, gender, age, purpose, city, zodiac, interests FROM player_profiles WHERE user_id = ?`,
    )
    .get(userId) as
    | {
        display_name: string
        avatar_url: string
        status: string
        gender: string
        age: number
        purpose: string
        city: string
        zodiac: string
        interests: string
      }
    | undefined

  const displayName = profile?.display_name ?? username
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`
  const gender = profile?.gender ?? "male"
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"
  const status = profile?.status ?? ""

  return {
    id: userId,
    username,
    displayName,
    avatarUrl,
    gender,
    age,
    purpose,
    status,
    okUserId: okUserId ?? undefined,
    ...(profile?.city ? { city: profile.city } : {}),
    ...(profile?.zodiac ? { zodiac: profile.zodiac } : {}),
    ...(profile?.interests ? { interests: profile.interests } : {}),
  }
}

export async function POST(req: Request) {
  const secret = getOkApplicationSecret()
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Не задан OK_APPLICATION_SECRET в окружении сервера" },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => null)
  const rawParams = body?.launchParams
  const launchParams: Record<string, string> =
    rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)
      ? Object.fromEntries(
          Object.entries(rawParams as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
        )
      : {}

  if (!verifyOkLaunchParams(launchParams, secret)) {
    return NextResponse.json({ ok: false, error: "Неверные параметры запуска ОК" }, { status: 401 })
  }

  const okUserId = parseOkLoggedUserId(launchParams)
  if (!okUserId) {
    return NextResponse.json({ ok: false, error: "Нет logged_user_id" }, { status: 400 })
  }

  const expectedAppKey = process.env.NEXT_PUBLIC_OK_APP_ID?.trim()
  if (expectedAppKey) {
    const ak = parseOkApplicationKey(launchParams)
    if (ak !== null && ak !== expectedAppKey) {
      return NextResponse.json({ ok: false, error: "Несовпадение application_key" }, { status: 400 })
    }
  }

  const profileIn = body?.profile as
    | {
        firstName?: string
        lastName?: string
        photoUrl?: string
      }
    | undefined

  const purposeRaw = typeof body?.purpose === "string" ? body.purpose : "communication"
  const purpose = VALID_PURPOSES.includes(purposeRaw as (typeof VALID_PURPOSES)[number])
    ? purposeRaw
    : "communication"

  const displayFromOk = [profileIn?.firstName, profileIn?.lastName].filter(Boolean).join(" ").trim()
  const avatarFromOk = typeof profileIn?.photoUrl === "string" ? profileIn.photoUrl.trim() : ""

  const db = getDb()
  const now = Date.now()

  let userRow = db
    .prepare(`SELECT id, username FROM users WHERE ok_user_id = ?`)
    .get(okUserId) as { id: string; username: string } | undefined

  if (!userRow) {
    const gender: (typeof VALID_GENDERS)[number] = "male"
    const ageNum = 25

    const userId = newId()
    const username = `ok_${okUserId}`
    const salt = generateSalt()
    const rnd = newId() + newId()
    const passwordHash = await hashPassword(rnd, salt)

    db.prepare(
      `INSERT INTO users (id, username, password_hash, password_salt, created_at, updated_at, vk_user_id, ok_user_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(userId, username, passwordHash, salt, now, now, okUserId)

    const displayName = displayFromOk.length > 0 ? displayFromOk : `Игрок ${okUserId}`
    const avatarUrl =
      avatarFromOk.length > 0
        ? avatarFromOk
        : `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`

    db.prepare(
      `INSERT INTO player_profiles (user_id, display_name, avatar_url, status, gender, age, purpose, city, zodiac, interests, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?, ?, '', '', '', ?, ?)`,
    ).run(userId, displayName, avatarUrl, gender, ageNum, purpose, now, now)

    const okState = db
      .prepare(
        `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM ok_user_game_state WHERE ok_user_id = ?`,
      )
      .get(okUserId) as { voice_balance: number; inventory_json: string; visual_prefs_json: string } | undefined

    const voiceBalance = okState?.voice_balance ?? 150
    const inventoryJson = okState?.inventory_json ?? "[]"
    const visualPrefsJson = okState?.visual_prefs_json ?? "{}"

    db.prepare(
      `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, visual_prefs_json, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, voiceBalance, inventoryJson, visualPrefsJson, now)

    if (okState) {
      db.prepare(`DELETE FROM ok_user_game_state WHERE ok_user_id = ?`).run(okUserId)
    }

    userRow = { id: userId, username }
  } else if (profileIn != null && typeof profileIn === "object") {
    const cur = db
      .prepare(`SELECT display_name, avatar_url FROM player_profiles WHERE user_id = ?`)
      .get(userRow.id) as { display_name: string; avatar_url: string } | undefined

    const nextName = displayFromOk.length > 0 ? displayFromOk : (cur?.display_name ?? "")
    const nextAvatar = avatarFromOk.length > 0 ? avatarFromOk : (cur?.avatar_url ?? "")

    db.prepare(
      `UPDATE player_profiles SET display_name = ?, avatar_url = ?, updated_at = ? WHERE user_id = ?`,
    ).run(nextName, nextAvatar || "", now, userRow.id)
  }

  const flags = getAdminFlagsForUserId(userRow.id)
  const r = isRestricted(flags)
  if (r.deleted) return NextResponse.json({ ok: false, error: "Аккаунт удалён" }, { status: 403 })
  if (r.blocked) return NextResponse.json({ ok: false, error: "Вы заблокированы" }, { status: 403 })
  if (r.banned) return NextResponse.json({ ok: false, error: "Вы временно забанены" }, { status: 403 })

  const token = newSessionToken()
  const tokenHash = sha256Base64(token)
  const sessionId = newId()
  const ttlMs = 1000 * 60 * 60 * 24 * 14
  const expiresAt = now + ttlMs
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`).run(
    sessionId,
    userRow.id,
    tokenHash,
    now,
    expiresAt,
  )

  const gameRow = db
    .prepare(
      `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM user_game_state WHERE user_id = ?`,
    )
    .get(userRow.id) as { voice_balance: number; inventory_json: string; visual_prefs_json: string } | undefined

  const voiceBalance = gameRow?.voice_balance ?? 0
  let inventory: unknown[] = []
  if (gameRow?.inventory_json) {
    try {
      inventory = JSON.parse(gameRow.inventory_json) as unknown[]
    } catch {
      inventory = []
    }
  }
  const visualPrefs = parseVisualPrefsJson(gameRow?.visual_prefs_json) ?? {}

  const userPayload = buildUserPayload(db, userRow.id, userRow.username, okUserId)

  return sessionCookieResponse(
    {
      ok: true,
      user: userPayload,
      voiceBalance,
      inventory,
      visualPrefs,
      sessionToken: token,
      authProvider: "ok",
    },
    token,
    expiresAt,
  )
}
