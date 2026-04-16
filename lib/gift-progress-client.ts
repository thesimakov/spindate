"use client"

import { apiFetch } from "@/lib/api-fetch"
import type { GiftProgressStats } from "@/lib/gift-progress-shared"
import type { Player } from "@/lib/game-types"

type GiftStatsResponse = { ok?: boolean; stats?: GiftProgressStats }
type GiftRecordResponse = GiftStatsResponse & { achievementUnlockedNow?: boolean }

export async function fetchGiftProgressStats(player: Player): Promise<GiftProgressStats | null> {
  try {
    const res = await apiFetch("/api/player-progress/gifts/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ player }),
    })
    const data = (await res.json().catch(() => null)) as GiftStatsResponse | null
    if (!res.ok || data?.ok !== true || !data.stats) return null
    return data.stats
  } catch {
    return null
  }
}

export async function recordGiftProgress(input: {
  dedupeId: string
  fromPlayer: Player
  toPlayer?: Player | null
  giftId: string
  heartsCost?: number
  rosesCost?: number
  createdAtMs?: number
}): Promise<{ stats: GiftProgressStats | null; achievementUnlockedNow: boolean }> {
  try {
    const res = await apiFetch("/api/player-progress/gifts/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    })
    const data = (await res.json().catch(() => null)) as GiftRecordResponse | null
    if (!res.ok || data?.ok !== true || !data.stats) {
      return { stats: null, achievementUnlockedNow: false }
    }
    return {
      stats: data.stats,
      achievementUnlockedNow: data.achievementUnlockedNow === true,
    }
  } catch {
    return { stats: null, achievementUnlockedNow: false }
  }
}
