import type { GameLogEntry, Player } from "@/lib/game-types"
import { GIFT_RATING_TYPE_SET } from "@/lib/gift-progress-shared"

/** Стоимость действий для рейтинга «Добрые» (сердца) */
export const KIND_ACTION_COST: Record<string, number> = {
  beer: 1,
  banya: 5,
  flowers: 5,
  diamond: 20,
  tools: 1,
  lipstick: 5,
}

export const RATING_GIFT_TYPES = GIFT_RATING_TYPE_SET

export type RatingCategory = "love" | "gift" | "kind"

export type ClassifiedRating = {
  category: RatingCategory
  weight: number
}

/**
 * Классификация для глобального рейтинга. Одно событие может дать несколько строк
 * (как в старом UI: «Щедрые» по типам подарков и «Добрые» по сердцам — пересечения, напр. flowers).
 */
export function classifyLogEntries(entry: GameLogEntry): ClassifiedRating[] {
  const t = entry.type
  const out: ClassifiedRating[] = []
  if (t === "kiss") {
    out.push({ category: "love", weight: 1 })
    return out
  }
  if (RATING_GIFT_TYPES.has(t)) {
    out.push({ category: "gift", weight: 1 })
  }
  const cost = KIND_ACTION_COST[t]
  if (cost != null && cost > 0) {
    out.push({ category: "kind", weight: cost })
  }
  return out
}

/**
 * Стабильный ключ игрока для агрегации (VK или логин).
 */
export function ratingActorKey(from: Player): string | null {
  if (from.isBot) return null
  if (from.authProvider === "login" && from.authUserId?.trim()) {
    return `login:${from.authUserId.trim()}`
  }
  if (from.authProvider === "ok") {
    const ok = from.okUserId ?? from.id
    if (typeof ok === "number" && Number.isInteger(ok) && ok > 0) {
      return `ok:${ok}`
    }
  }
  const vk = from.vkUserId ?? (from.authProvider === "vk" || from.authProvider === undefined ? from.id : undefined)
  if (typeof vk === "number" && Number.isInteger(vk) && vk > 0) {
    return `vk:${vk}`
  }
  return null
}
