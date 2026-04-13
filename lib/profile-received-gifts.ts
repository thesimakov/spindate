import type { GiftCatalogRow } from "@/lib/gift-catalog"
import { DEFAULT_GIFT_CATALOG_ROWS, toGiftImageUrl } from "@/lib/gift-catalog"
import { PAIR_ACTIONS, type InventoryItem } from "@/lib/game-types"

/** Эмодзи для подарков-эмоций за столом (PAIR_ACTIONS), если нет картинки в каталоге */
const PAIR_GIFT_EMOJI: Partial<Record<string, string>> = {
  kiss: "💋",
  cocktail: "🍬",
  flowers: "🌸",
  diamond: "💎",
  beer: "🍺",
  banya: "🧖",
  tools: "🔧",
  lipstick: "💄",
  skip: "⏭️",
}

export type ReceivedGiftRow = {
  type: string
  count: number
  label: string
  emoji: string
  imgSrc: string
}

/**
 * Считает подарки, полученные от других игроков: инвентарь с toPlayerId + розы из rosesGiven.
 */
export function aggregateReceivedGiftsByType(args: {
  inventory: InventoryItem[]
  rosesGiven: Array<{ fromPlayerId: number; toPlayerId: number; timestamp: number }> | undefined
  userId: number
}): Map<string, number> {
  const map = new Map<string, number>()
  for (const i of args.inventory) {
    if (i.toPlayerId !== args.userId) continue
    if (i.fromPlayerId === 0) continue
    const t = i.type
    map.set(t, (map.get(t) ?? 0) + 1)
  }
  const roseSocial = (args.rosesGiven ?? []).filter((r) => r.toPlayerId === args.userId).length
  if (roseSocial > 0) {
    map.set("rose", (map.get("rose") ?? 0) + roseSocial)
  }
  return map
}

function resolveLabelEmojiImg(
  type: string,
  catalogRows: readonly GiftCatalogRow[],
): { label: string; emoji: string; imgSrc: string } {
  const fromCat =
    catalogRows.find((r) => r.id === type && r.published && !r.deleted) ??
    DEFAULT_GIFT_CATALOG_ROWS.find((r) => r.id === type)
  if (fromCat) {
    return {
      label: fromCat.name,
      emoji: fromCat.emoji,
      imgSrc: toGiftImageUrl(fromCat.img),
    }
  }
  if (type === "rose") {
    return { label: "Роза", emoji: "🌹", imgSrc: "" }
  }
  const pair = PAIR_ACTIONS.find((a) => a.id === type)
  if (pair) {
    return {
      label: pair.label,
      emoji: PAIR_GIFT_EMOJI[type] ?? "🎁",
      imgSrc: "",
    }
  }
  return { label: type, emoji: "🎁", imgSrc: "" }
}

/** Список строк для UI: агрегация + подписи, сортировка по убыванию количества */
export function buildReceivedGiftsRows(
  counts: Map<string, number>,
  catalogRows: readonly GiftCatalogRow[],
): ReceivedGiftRow[] {
  const rows: ReceivedGiftRow[] = []
  for (const [type, count] of counts) {
    if (count <= 0) continue
    const { label, emoji, imgSrc } = resolveLabelEmojiImg(type, catalogRows)
    rows.push({ type, count, label, emoji, imgSrc })
  }
  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
  return rows
}
