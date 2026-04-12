import { getDb } from "@/lib/db"

export type AdminUserFlags = {
  userId: string
  blockedUntil: number | null
  bannedUntil: number | null
  deleted: boolean
}

export function getAdminFlagsForUserId(userId: string): AdminUserFlags | null {
  const db = getDb()
  const row = db
    .prepare(`SELECT user_id, blocked_until, banned_until, deleted FROM user_admin_flags WHERE user_id = ?`)
    .get(userId) as { user_id: string; blocked_until: number | null; banned_until: number | null; deleted: number } | undefined
  if (!row) return null
  return {
    userId: row.user_id,
    blockedUntil: typeof row.blocked_until === "number" ? row.blocked_until : null,
    bannedUntil: typeof row.banned_until === "number" ? row.banned_until : null,
    deleted: Boolean(row.deleted),
  }
}

export function upsertAdminFlags(args: {
  userId: string
  blockedUntil?: number | null
  bannedUntil?: number | null
  deleted?: boolean
}) {
  const db = getDb()
  const now = Date.now()
  const prev = getAdminFlagsForUserId(args.userId)
  const nextBlocked = args.blockedUntil !== undefined ? args.blockedUntil : prev?.blockedUntil ?? null
  const nextBanned = args.bannedUntil !== undefined ? args.bannedUntil : prev?.bannedUntil ?? null
  const nextDeleted = args.deleted !== undefined ? (args.deleted ? 1 : 0) : prev?.deleted ? 1 : 0
  db.prepare(
    `INSERT INTO user_admin_flags (user_id, blocked_until, banned_until, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       blocked_until = excluded.blocked_until,
       banned_until = excluded.banned_until,
       deleted = excluded.deleted,
       updated_at = excluded.updated_at`,
  ).run(args.userId, nextBlocked, nextBanned, nextDeleted, now)
}

export function clearAdminFlags(userId: string) {
  const db = getDb()
  db.prepare(`DELETE FROM user_admin_flags WHERE user_id = ?`).run(userId)
}

/** Снять пометку «удалён администратором» после успешного входа (игрок снова обычный пользователь). */
export function clearDeletedSanction(userId: string) {
  const flags = getAdminFlagsForUserId(userId)
  if (!flags?.deleted) return
  upsertAdminFlags({ userId, deleted: false })
}

export function isRestricted(flags: AdminUserFlags | null): { blocked: boolean; banned: boolean; deleted: boolean } {
  const now = Date.now()
  return {
    blocked: !!flags?.blockedUntil && flags.blockedUntil > now,
    banned: !!flags?.bannedUntil && flags.bannedUntil > now,
    deleted: !!flags?.deleted,
  }
}

