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
  const rows = db.prepare(
    `WITH top AS (
       SELECT actor_key, SUM(weight) AS score
       FROM global_rating_events
       WHERE category = ? AND created_at >= ? AND created_at < ?
       GROUP BY actor_key
       ORDER BY score DESC
       LIMIT ?
     ),
     latest_meta AS (
       SELECT actor_key, display_name, avatar_url
       FROM (
         SELECT
           actor_key,
           display_name,
           avatar_url,
           ROW_NUMBER() OVER (PARTITION BY actor_key ORDER BY created_at DESC) AS rn
         FROM global_rating_events
         WHERE category = ? AND created_at >= ? AND created_at < ?
       )
       WHERE rn = 1
     )
     SELECT
       top.actor_key,
       top.score,
       COALESCE(latest_meta.display_name, '') AS display_name,
       COALESCE(latest_meta.avatar_url, '') AS avatar_url
     FROM top
     LEFT JOIN latest_meta ON latest_meta.actor_key = top.actor_key
     ORDER BY top.score DESC`,
  ).all(
    cat,
    input.startMs,
    input.endMs,
    input.limit,
    cat,
    input.startMs,
    input.endMs,
  ) as Array<{ actor_key: string; score: number; display_name: string; avatar_url: string }>

  return rows.map((r, i) => {
    return {
      rank: i + 1,
      actorKey: r.actor_key,
      name: r.display_name.trim() || "—",
      avatar: r.avatar_url.trim(),
      score: r.score,
    }
  })
}
