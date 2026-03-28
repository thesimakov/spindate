import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { generateSalt, hashPassword } from "@/lib/auth/password"
import { newId, newSessionToken, setSessionCookie, sha256Base64 } from "@/lib/auth/session"
import { parseVkAppIdFromLaunchSearch, parseVkUserIdFromLaunchSearch, verifyVkLaunchParams } from "@/lib/vk-launch-params"

const VALID_GENDERS = ["male", "female"] as const
const VALID_PURPOSES = ["relationships", "communication", "love"] as const

function getMiniAppSecret(): string {
  return process.env.VK_MINI_APP_SECRET ?? process.env.VK_PAYMENTS_SECRET ?? ""
}

function sessionCookieResponse(
  body: Record<string, unknown>,
  token: string,
  expiresAt: number,
) {
  const res = NextResponse.json(body)
  setSessionCookie(res, token, expiresAt)
  return res
}

function buildUserPayload(
  db: ReturnType<typeof getDb>,
  userId: string,
  username: string,
  vkUserId: number | null,
) {
  const profile = db
    .prepare(
      `SELECT display_name, avatar_url, gender, age, purpose FROM player_profiles WHERE user_id = ?`,
    )
    .get(userId) as
    | { display_name: string; avatar_url: string; gender: string; age: number; purpose: string }
    | undefined

  const displayName = profile?.display_name ?? username
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`
  const gender = profile?.gender ?? "male"
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"

  return {
    id: userId,
    username,
    displayName,
    avatarUrl,
    gender,
    age,
    purpose,
    vkUserId: vkUserId ?? undefined,
  }
}

export async function POST(req: Request) {
  const secret = getMiniAppSecret()
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Не задан VK_MINI_APP_SECRET (или VK_PAYMENTS_SECRET) в окружении сервера" },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => null)
  const launchParams =
    typeof body?.launchParams === "string"
      ? body.launchParams
      : typeof body?.search === "string"
        ? body.search
        : ""

  if (!launchParams || !verifyVkLaunchParams(launchParams, secret)) {
    return NextResponse.json({ ok: false, error: "Неверные параметры запуска VK" }, { status: 401 })
  }

  const vkUserId = parseVkUserIdFromLaunchSearch(launchParams)
  if (!vkUserId) {
    return NextResponse.json({ ok: false, error: "Нет vk_user_id" }, { status: 400 })
  }

  const expectedApp = process.env.NEXT_PUBLIC_VK_APP_ID
  if (expectedApp) {
    const aid = parseVkAppIdFromLaunchSearch(launchParams)
    if (aid !== null && String(aid) !== String(expectedApp).trim()) {
      return NextResponse.json({ ok: false, error: "Несовпадение vk_app_id" }, { status: 400 })
    }
  }

  const profileIn = body?.profile as
    | {
        firstName?: string
        lastName?: string
        photoUrl?: string
        sex?: number
        age?: number
      }
    | undefined

  const ageNum =
    typeof profileIn?.age === "number" && profileIn.age >= 18 && profileIn.age <= 120
      ? profileIn.age
      : 25
  const genderFromSex =
    profileIn?.sex === 2 ? "male" : profileIn?.sex === 1 ? "female" : undefined
  const gender =
    genderFromSex && VALID_GENDERS.includes(genderFromSex as (typeof VALID_GENDERS)[number])
      ? genderFromSex
      : "male"
  const purposeRaw = typeof body?.purpose === "string" ? body.purpose : "communication"
  const purpose = VALID_PURPOSES.includes(purposeRaw as (typeof VALID_PURPOSES)[number])
    ? purposeRaw
    : "communication"

  const displayFromVk = [profileIn?.firstName, profileIn?.lastName].filter(Boolean).join(" ").trim()
  const avatarFromVk = typeof profileIn?.photoUrl === "string" ? profileIn.photoUrl.trim() : ""

  const db = getDb()
  const now = Date.now()

  let userRow = db
    .prepare(`SELECT id, username FROM users WHERE vk_user_id = ?`)
    .get(vkUserId) as { id: string; username: string } | undefined

  if (!userRow) {
    const userId = newId()
    const username = `vk_${vkUserId}`
    const salt = generateSalt()
    const rnd = newId() + newId()
    const passwordHash = await hashPassword(rnd, salt)

    db.prepare(
      `INSERT INTO users (id, username, password_hash, password_salt, created_at, updated_at, vk_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, username, passwordHash, salt, now, now, vkUserId)

    const displayName =
      displayFromVk.length > 0 ? displayFromVk : `Игрок ${vkUserId}`
    const avatarUrl =
      avatarFromVk.length > 0
        ? avatarFromVk
        : `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`

    db.prepare(
      `INSERT INTO player_profiles (user_id, display_name, avatar_url, gender, age, purpose, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, displayName, avatarUrl, gender, ageNum, purpose, now, now)

    const vkState = db
      .prepare(`SELECT voice_balance, inventory_json FROM vk_user_game_state WHERE vk_user_id = ?`)
      .get(vkUserId) as { voice_balance: number; inventory_json: string } | undefined

    const voiceBalance = vkState?.voice_balance ?? 150
    const inventoryJson = vkState?.inventory_json ?? "[]"

    db.prepare(
      `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
       VALUES (?, ?, ?, ?)`,
    ).run(userId, voiceBalance, inventoryJson, now)

    if (vkState) {
      db.prepare(`DELETE FROM vk_user_game_state WHERE vk_user_id = ?`).run(vkUserId)
    }

    userRow = { id: userId, username }
  } else if (displayFromVk.length > 0 || avatarFromVk.length > 0 || genderFromSex) {
    const cur = db
      .prepare(`SELECT display_name, avatar_url FROM player_profiles WHERE user_id = ?`)
      .get(userRow.id) as { display_name: string; avatar_url: string } | undefined
    const nextName = displayFromVk.length > 0 ? displayFromVk : (cur?.display_name ?? "")
    const nextAvatar = avatarFromVk.length > 0 ? avatarFromVk : (cur?.avatar_url ?? "")
    db.prepare(
      `UPDATE player_profiles SET display_name = ?, avatar_url = ?, gender = ?, age = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(nextName, nextAvatar || "", gender, ageNum, now, userRow.id)
  }

  const token = newSessionToken()
  const tokenHash = sha256Base64(token)
  const sessionId = newId()
  const ttlMs = 1000 * 60 * 60 * 24 * 14
  const expiresAt = now + ttlMs
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(sessionId, userRow.id, tokenHash, now, expiresAt)

  const gameRow = db
    .prepare(`SELECT voice_balance, inventory_json FROM user_game_state WHERE user_id = ?`)
    .get(userRow.id) as { voice_balance: number; inventory_json: string } | undefined

  const voiceBalance = gameRow?.voice_balance ?? 0
  let inventory: unknown[] = []
  if (gameRow?.inventory_json) {
    try {
      inventory = JSON.parse(gameRow.inventory_json) as unknown[]
    } catch {
      inventory = []
    }
  }

  const userPayload = buildUserPayload(db, userRow.id, userRow.username, vkUserId)

  return sessionCookieResponse(
    {
      ok: true,
      user: userPayload,
      voiceBalance,
      inventory,
      sessionToken: token,
    },
    token,
    expiresAt,
  )
}
