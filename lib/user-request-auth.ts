import { getDb } from "@/lib/db"
import { getSessionTokenFromRequest, sha256Base64 } from "@/lib/auth/session"

export function getUserIdFromSession(req: Request): string | null {
  const token = getSessionTokenFromRequest(req)
  if (!token) return null
  const db = getDb()
  const tokenHash = sha256Base64(token)
  const now = Date.now()
  const row = db
    .prepare(`SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?`)
    .get(tokenHash, now) as { user_id: string } | undefined
  return row?.user_id ?? null
}

export function getVkUserIdFromRequest(req: Request): number | null {
  const url = new URL(req.url)
  const raw = url.searchParams.get("vk_user_id")
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

export function getOkUserIdFromRequest(req: Request): number | null {
  const url = new URL(req.url)
  const raw = url.searchParams.get("ok_user_id")
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

/** Как в user/state: сессия имеет приоритет; иначе query vk_user_id или ok_user_id. */
export type GameUserIdAuth =
  | { userId: string; vkUserId: null; okUserId: null }
  | { userId: null; vkUserId: number; okUserId: null }
  | { userId: null; vkUserId: null; okUserId: number }

export function getGameUserIdFromRequest(req: Request): GameUserIdAuth | null {
  const userId = getUserIdFromSession(req)
  if (userId) return { userId, vkUserId: null, okUserId: null }
  const vkUserId = getVkUserIdFromRequest(req)
  if (vkUserId) return { userId: null, vkUserId, okUserId: null }
  const okUserId = getOkUserIdFromRequest(req)
  if (okUserId) return { userId: null, vkUserId: null, okUserId }
  return null
}
