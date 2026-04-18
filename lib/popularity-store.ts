import type { Database } from "better-sqlite3"
import type { GameAction } from "@/lib/game-types"
import { ratingActorKey } from "@/lib/rating-global-rules"
import { classifyPopularityRecipients, utcMonthKey } from "@/lib/popularity-rules"
import { getDb } from "@/lib/db"
import type { GameUserIdAuth } from "@/lib/user-request-auth"

/**
 * Запись входящей популярности после pushTableEvent (ADD_LOG).
 */
export function tryInsertPopularityFromAddLog(input: {
  tableId: number
  action: GameAction
  createdAtMs: number
}): void {
  if (input.action.type !== "ADD_LOG") return
  const entry = input.action.entry
  const rows = classifyPopularityRecipients(entry)
  if (rows.length === 0) return

  const monthKey = utcMonthKey(input.createdAtMs)
  const db = getDb()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO popularity_events (dedupe_id, table_id, actor_key, weight, created_at, month_key, display_name, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const { recipient, weight } of rows) {
    const actorKey = ratingActorKey(recipient)
    if (!actorKey) continue
    const dedupeId = `${input.tableId}:${entry.id}:pop:${actorKey}`
    const name = (recipient.name ?? "").trim() || "Игрок"
    const avatar = (recipient.avatar ?? "").trim()
    stmt.run(dedupeId, input.tableId, actorKey, weight, input.createdAtMs, monthKey, name, avatar)
  }
}

export function resolveActorKeyFromAuth(db: Database, auth: GameUserIdAuth): string | null {
  if (auth.userId) {
    const row = db
      .prepare(`SELECT vk_user_id, ok_user_id FROM users WHERE id = ?`)
      .get(auth.userId) as { vk_user_id: number | null; ok_user_id: number | null } | undefined
    if (row?.vk_user_id != null && row.vk_user_id > 0) return `vk:${row.vk_user_id}`
    if (row?.ok_user_id != null && row.ok_user_id > 0) return `ok:${row.ok_user_id}`
    return `login:${auth.userId}`
  }
  if (auth.vkUserId != null) return `vk:${auth.vkUserId}`
  if (auth.okUserId != null) return `ok:${auth.okUserId}`
  return null
}

export function sumGlobalRatingTotal(db: Database, actorKey: string): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(weight), 0) AS s FROM global_rating_events WHERE actor_key = ?`)
    .get(actorKey) as { s: number } | undefined
  return Math.floor(Number(row?.s ?? 0))
}

export function sumPopularityLifetime(db: Database, actorKey: string): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(weight), 0) AS s FROM popularity_events WHERE actor_key = ?`)
    .get(actorKey) as { s: number } | undefined
  return Math.floor(Number(row?.s ?? 0))
}

export function sumPopularityMonth(db: Database, actorKey: string, monthKey: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(weight), 0) AS s FROM popularity_events WHERE actor_key = ? AND month_key = ?`,
    )
    .get(actorKey, monthKey) as { s: number } | undefined
  return Math.floor(Number(row?.s ?? 0))
}

/** Уровень 1..99 от накопленной популярности (всё время). */
export function popularityLevelFromLifetime(total: number): number {
  if (total <= 0) return 1
  const lv = 1 + Math.floor(Math.sqrt(total / 80))
  return Math.min(99, Math.max(1, lv))
}

export function computeMonthRank(
  db: Database,
  actorKey: string,
  monthKey: string,
  myScore: number,
): number | null {
  if (myScore <= 0) return null
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT actor_key FROM popularity_events WHERE month_key = ?
         GROUP BY actor_key
         HAVING SUM(weight) > ?
       )`,
    )
    .get(monthKey, myScore) as { c: number } | undefined
  const above = Math.floor(Number(row?.c ?? 0))
  return above + 1
}

export type MonthlyLeaderboardRow = {
  rank: number
  actorKey: string
  name: string
  avatar: string
  score: number
}

export function queryMonthlyPopularityLeaderboard(monthKey: string, limit: number): MonthlyLeaderboardRow[] {
  const db = getDb()
  const lim = Math.min(100, Math.max(1, Math.floor(limit)))
  const scores = db
    .prepare(
      `SELECT actor_key, SUM(weight) AS score
       FROM popularity_events
       WHERE month_key = ?
       GROUP BY actor_key
       ORDER BY score DESC, actor_key ASC
       LIMIT ?`,
    )
    .all(monthKey, lim) as Array<{ actor_key: string; score: number }>

  const metaStmt = db.prepare(
    `SELECT display_name, avatar_url FROM popularity_events WHERE actor_key = ? AND month_key = ? ORDER BY created_at DESC LIMIT 1`,
  )

  return scores.map((r, i) => {
    const meta = metaStmt.get(r.actor_key, monthKey) as
      | { display_name: string; avatar_url: string }
      | undefined
    return {
      rank: i + 1,
      actorKey: r.actor_key,
      name: (meta?.display_name ?? "").trim() || "—",
      avatar: (meta?.avatar_url ?? "").trim(),
      score: Math.floor(Number(r.score)),
    }
  })
}

export const MONTHLY_TOP_FRAME_LIMIT = 20
