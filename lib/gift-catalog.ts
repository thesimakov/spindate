import type { InventoryItem } from "@/lib/game-types"

export type GiftCatalogSection = "free" | "paid" | "vip"

export type GiftCatalogRow = {
  id: InventoryItem["type"]
  section: GiftCatalogSection
  name: string
  emoji: string
  cost: number
  published: boolean
  deleted?: boolean
}

export const DEFAULT_GIFT_CATALOG_ROWS: GiftCatalogRow[] = [
  { id: "toy_bear", section: "vip", name: "Плюшевый мишка", emoji: "🧸", cost: 10, published: true },
  { id: "plush_heart", section: "paid", name: "Подушка-сердце", emoji: "❤️", cost: 8, published: true },
  { id: "toy_car", section: "paid", name: "Игрушечная машинка", emoji: "🚗", cost: 7, published: true },
  { id: "toy_ball", section: "paid", name: "Футбольный мяч", emoji: "⚽️", cost: 6, published: true },
  { id: "souvenir_magnet", section: "paid", name: "Магнитик на холодильник", emoji: "🧲", cost: 3, published: true },
  { id: "souvenir_keychain", section: "paid", name: "Брелок-сувенир", emoji: "🔑", cost: 5, published: true },
  { id: "chocolate_box", section: "paid", name: "Коробка конфет", emoji: "🍫", cost: 4, published: true },
]

export function isGiftCatalogId(value: string): value is InventoryItem["type"] {
  return typeof value === "string" && value.trim().length > 0
}

export function normalizeGiftCatalogRows(
  rows: unknown,
  options?: { onlyPublished?: boolean; includeDeleted?: boolean },
): GiftCatalogRow[] {
  if (!Array.isArray(rows)) {
    return options?.onlyPublished
      ? DEFAULT_GIFT_CATALOG_ROWS.filter((row) => row.published && !row.deleted)
      : DEFAULT_GIFT_CATALOG_ROWS
  }
  const out: GiftCatalogRow[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object") continue
    const rec = item as Partial<GiftCatalogRow> & { id?: string; section?: string }
    if (typeof rec.id !== "string" || !isGiftCatalogId(rec.id)) continue
    const section: GiftCatalogSection =
      rec.section === "free" || rec.section === "vip"
        ? rec.section
        : Number(rec.cost) >= 10
          ? "vip"
          : "paid"
    const normalized: GiftCatalogRow = {
      id: rec.id,
      section,
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      emoji: typeof rec.emoji === "string" && rec.emoji.trim() ? rec.emoji.trim() : "🎁",
      cost: Math.max(0, Number.isFinite(Number(rec.cost)) ? Math.floor(Number(rec.cost)) : 0),
      published: rec.published !== false,
      deleted: rec.deleted === true,
    }
    if (!options?.includeDeleted && normalized.deleted) continue
    if (options?.onlyPublished && !normalized.published) continue
    out.push(normalized)
  }
  return out
}
