import type { GameLogEntry, Player } from "@/lib/game-types"
import { KIND_ACTION_COST, RATING_GIFT_TYPES } from "@/lib/rating-global-rules"

export type PopularityRecipient = { recipient: Player; weight: number }

/**
 * Очки популярности за входящие действия (кому адресовано в логе).
 */
export function classifyPopularityRecipients(entry: GameLogEntry): PopularityRecipient[] {
  const t = entry.type
  const acc = new Map<number, { recipient: Player; weight: number }>()

  const add = (p: Player | undefined | null, weight: number) => {
    if (!p || p.isBot || weight <= 0) return
    const prev = acc.get(p.id)
    if (prev) prev.weight += weight
    else acc.set(p.id, { recipient: p, weight })
  }

  if (t === "kiss") {
    add(entry.toPlayer, 10)
    return [...acc.values()]
  }
  if (t === "care") {
    add(entry.toPlayer, 8)
    return [...acc.values()]
  }
  if (t === "rose") {
    add(entry.toPlayer, 6)
    return [...acc.values()]
  }
  if (t === "chat_request" || t === "invite") {
    add(entry.toPlayer, 4)
    return [...acc.values()]
  }

  if (RATING_GIFT_TYPES.has(t)) {
    add(entry.toPlayer, 7)
  }

  const kindCost = KIND_ACTION_COST[t]
  if (typeof kindCost === "number" && kindCost > 0) {
    add(entry.toPlayer, Math.max(1, kindCost))
  }

  return [...acc.values()]
}

export function utcMonthKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return `${y}-${m < 10 ? "0" : ""}${m}`
}
