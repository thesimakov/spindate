import "server-only"

import type { Database } from "better-sqlite3"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"

export type AuthMeSuccessPayload = {
  ok: true
  authProvider: "vk" | "ok" | "login"
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string
    gender: string
    age: number
    purpose: string
    status: string
    vkUserId?: number
    okUserId?: number
    city?: string
    zodiac?: string
    interests?: string
  }
}

export type AuthMeErrorPayload =
  | { ok: false; error: string; status: 401 }
  | { ok: false; error: string; status: 403 }

export function buildAuthMePayloadForUserId(db: Database, userId: string): AuthMeSuccessPayload | AuthMeErrorPayload {
  const userRow = db
    .prepare(`SELECT id, username, vk_user_id, ok_user_id FROM users WHERE id = ?`)
    .get(userId) as
    | {
        id: string
        username: string
        vk_user_id: number | null
        ok_user_id: number | null
      }
    | undefined

  if (!userRow) {
    return { ok: false, error: "Пользователь не найден", status: 401 }
  }

  const flags = getAdminFlagsForUserId(userRow.id)
  const r = isRestricted(flags)
  if (r.blocked) return { ok: false, error: "Вы заблокированы", status: 403 }
  if (r.banned) return { ok: false, error: "Вы временно забанены", status: 403 }

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

  const displayName = (profile?.display_name?.trim() || userRow.username) as string
  const avatarUrl =
    profile?.avatar_url ||
    `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(userRow.username)}`
  const gender = profile?.gender ?? "male"
  const age = profile?.age ?? 25
  const purpose = profile?.purpose ?? "communication"
  const status = profile?.status ?? ""

  const authProvider =
    userRow.vk_user_id != null ? "vk" : userRow.ok_user_id != null ? "ok" : "login"

  return {
    ok: true,
    authProvider,
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
      ...(userRow.ok_user_id != null ? { okUserId: userRow.ok_user_id } : {}),
      ...(profile?.city ? { city: profile.city } : {}),
      ...(profile?.zodiac ? { zodiac: profile.zodiac } : {}),
      ...(profile?.interests ? { interests: profile.interests } : {}),
    },
  }
}

