import { getDb } from "@/lib/db"
import {
  GIFT_ACHIEVEMENT_KEY,
  GIFT_ACHIEVEMENT_TARGET,
  GIFT_ACHIEVEMENT_TITLE,
  type GiftProgressStats,
} from "@/lib/gift-progress-shared"
import type { Player } from "@/lib/game-types"
import { ratingActorKey } from "@/lib/rating-global-rules"

type GiftProgressAggregateRow = {
  gifts_sent_count: number
  hearts_spent: number
  roses_spent: number
  unlocked_at: number | null
}

function emptyGiftProgressStats(): GiftProgressStats {
  return {
    giftsSentCount: 0,
    heartsSpent: 0,
    rosesSpent: 0,
    achievement: {
      key: GIFT_ACHIEVEMENT_KEY,
      title: GIFT_ACHIEVEMENT_TITLE,
      current: 0,
      target: GIFT_ACHIEVEMENT_TARGET,
      unlocked: false,
      unlockedAt: null,
    },
  }
}

function mapGiftProgressRow(row: GiftProgressAggregateRow | undefined): GiftProgressStats {
  const giftsSentCount = Math.max(0, Math.floor(row?.gifts_sent_count ?? 0))
  const heartsSpent = Math.max(0, Math.floor(row?.hearts_spent ?? 0))
  const rosesSpent = Math.max(0, Math.floor(row?.roses_spent ?? 0))
  const unlockedAt = typeof row?.unlocked_at === "number" && Number.isFinite(row.unlocked_at) ? row.unlocked_at : null
  return {
    giftsSentCount,
    heartsSpent,
    rosesSpent,
    achievement: {
      key: GIFT_ACHIEVEMENT_KEY,
      title: GIFT_ACHIEVEMENT_TITLE,
      current: giftsSentCount,
      target: GIFT_ACHIEVEMENT_TARGET,
      unlocked: giftsSentCount >= GIFT_ACHIEVEMENT_TARGET,
      unlockedAt,
    },
  }
}

export function queryGiftProgressStatsByActorKey(actorKey: string | null | undefined): GiftProgressStats {
  const safeActorKey = typeof actorKey === "string" ? actorKey.trim() : ""
  if (!safeActorKey) return emptyGiftProgressStats()
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS gifts_sent_count,
         COALESCE(SUM(hearts_cost), 0) AS hearts_spent,
         COALESCE(SUM(roses_cost), 0) AS roses_spent,
         MIN(CASE WHEN rowid >= 1 THEN created_at END) AS unlocked_at
       FROM player_gift_progress_events
       WHERE actor_key = ?`,
    )
    .get(safeActorKey) as GiftProgressAggregateRow | undefined
  return mapGiftProgressRow(row)
}

export function queryGiftProgressStatsForPlayer(player: Player | null | undefined): GiftProgressStats {
  if (!player) return emptyGiftProgressStats()
  return queryGiftProgressStatsByActorKey(ratingActorKey(player))
}

export function recordGiftProgressEvent(input: {
  dedupeId: string
  fromPlayer: Player
  toPlayer?: Player | null
  giftId: string
  heartsCost?: number
  rosesCost?: number
  createdAtMs?: number
}): { stats: GiftProgressStats; achievementUnlockedNow: boolean } {
  const actorKey = ratingActorKey(input.fromPlayer)
  if (!actorKey) {
    return { stats: emptyGiftProgressStats(), achievementUnlockedNow: false }
  }
  const db = getDb()
  const safeDedupeId = input.dedupeId.trim()
  if (!safeDedupeId) {
    return { stats: queryGiftProgressStatsByActorKey(actorKey), achievementUnlockedNow: false }
  }
  const safeGiftId = input.giftId.trim()
  const recipientActorKey = input.toPlayer ? ratingActorKey(input.toPlayer) ?? "" : ""
  const createdAtMs =
    typeof input.createdAtMs === "number" && Number.isFinite(input.createdAtMs) ? Math.floor(input.createdAtMs) : Date.now()
  const heartsCost =
    typeof input.heartsCost === "number" && Number.isFinite(input.heartsCost) ? Math.max(0, Math.floor(input.heartsCost)) : 0
  const rosesCost =
    typeof input.rosesCost === "number" && Number.isFinite(input.rosesCost) ? Math.max(0, Math.floor(input.rosesCost)) : 0
  const before = queryGiftProgressStatsByActorKey(actorKey)
  const displayName = (input.fromPlayer.name ?? "").trim() || "Игрок"
  const avatarUrl = (input.fromPlayer.avatar ?? "").trim()

  const insert = db
    .prepare(
      `INSERT OR IGNORE INTO player_gift_progress_events
        (dedupe_id, actor_key, recipient_actor_key, gift_id, hearts_cost, roses_cost, created_at, display_name, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      safeDedupeId,
      actorKey,
      recipientActorKey,
      safeGiftId,
      heartsCost,
      rosesCost,
      createdAtMs,
      displayName,
      avatarUrl,
    )

  const stats = queryGiftProgressStatsByActorKey(actorKey)
  const achievementUnlockedNow =
    insert.changes > 0 &&
    before.achievement.current < GIFT_ACHIEVEMENT_TARGET &&
    stats.achievement.current >= GIFT_ACHIEVEMENT_TARGET

  return { stats, achievementUnlockedNow }
}
