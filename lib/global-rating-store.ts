import { getDb } from "@/lib/db"
import type { GameAction } from "@/lib/game-types"
import { classifyLogEntries, ratingActorKey, type RatingCategory } from "@/lib/rating-global-rules"

/**
 * Запись в глобальный рейтинг после успешного pushTableEvent для ADD_LOG.
 * Идемпотентность: INSERT OR IGNORE по dedupe_id.
 */
export function tryInsertGlobalRatingFromAddLog(input: {
  tableId: number
  action: GameAction
  createdAtMs: number
}): void {
  if (input.action.type !== "ADD_LOG") return
  const entry = input.action.entry
  const from = entry.fromPlayer
  if (!from) return

  const rows = classifyLogEntries(entry)
  if (rows.length === 0) return

  const actorKey = ratingActorKey(from)
  if (!actorKey) return

  const displayName = (from.name ?? "").trim() || "Игрок"
  const avatarUrl = (from.avatar ?? "").trim()

  const db = getDb()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO global_rating_events (dedupe_id, table_id, actor_key, category, weight, created_at, display_name, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const row of rows) {
    const dedupeId = `${input.tableId}:${entry.id}:${row.category}`
    stmt.run(
      dedupeId,
      input.tableId,
      actorKey,
      row.category,
      row.weight,
      input.createdAtMs,
      displayName,
      avatarUrl,
    )
  }
}

export type LeaderboardRow = {
  rank: number
  actorKey: string
  name: string
  avatar: string
  score: number
}

export function queryGlobalLeaderboard(input: {
  startMs: number
  endMs: number
  category: RatingCategory
  limit: number
}): LeaderboardRow[] {
  const db = getDb()
  const cat = input.category
  const top = db
    .prepare(
      `SELECT actor_key, SUM(weight) AS score
       FROM global_rating_events
       WHERE category = ? AND created_at >= ? AND created_at < ?
       GROUP BY actor_key
       ORDER BY score DESC
       LIMIT ?`,
    )
    .all(cat, input.startMs, input.endMs, input.limit) as Array<{ actor_key: string; score: number }>

  const metaStmt = db.prepare(
    `SELECT display_name, avatar_url FROM global_rating_events
     WHERE actor_key = ? AND category = ? AND created_at >= ? AND created_at < ?
     ORDER BY created_at DESC LIMIT 1`,
  )

  return top.map((r, i) => {
    const m = metaStmt.get(r.actor_key, cat, input.startMs, input.endMs) as
      | { display_name: string; avatar_url: string }
      | undefined
    return {
      rank: i + 1,
      actorKey: r.actor_key,
      name: m?.display_name?.trim() || "—",
      avatar: (m?.avatar_url ?? "").trim(),
      score: r.score,
    }
  })
}
