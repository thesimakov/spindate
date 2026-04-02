import type { InventoryItem } from "@/lib/game-types"
import { catalogMediaUrl } from "@/lib/assets"

export type GiftCatalogSection = "free" | "paid" | "vip"

export type GiftCatalogRow = {
  id: InventoryItem["type"]
  section: GiftCatalogSection
  name: string
  emoji: string
  /** Путь к картинке (загрузка админки → `/api/catalog/upload-asset/...` или статика `/assets/...`). */
  img: string
  cost: number
  published: boolean
  deleted?: boolean
}

export function toGiftImageUrl(raw: string): string {
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? trimmed
  const withSlash = pathOnly.startsWith("/") ? pathOnly : pathOnly.startsWith("assets/") ? `/${pathOnly}` : `/assets/${pathOnly}`
  return catalogMediaUrl(withSlash)
}

export const DEFAULT_GIFT_CATALOG_ROWS: GiftCatalogRow[] = [
  { id: "toy_bear", section: "vip", name: "Плюшевый мишка", emoji: "🧸", img: "", cost: 10, published: true },
  { id: "plush_heart", section: "paid", name: "Подушка-сердце", emoji: "❤️", img: "", cost: 8, published: true },
  { id: "toy_car", section: "paid", name: "Игрушечная машинка", emoji: "🚗", img: "", cost: 7, published: true },
  { id: "toy_ball", section: "paid", name: "Футбольный мяч", emoji: "⚽️", img: "", cost: 6, published: true },
  { id: "souvenir_magnet", section: "paid", name: "Магнитик на холодильник", emoji: "🧲", img: "", cost: 3, published: true },
  { id: "souvenir_keychain", section: "paid", name: "Брелок-сувенир", emoji: "🔑", img: "", cost: 5, published: true },
  { id: "chocolate_box", section: "paid", name: "Коробка конфет", emoji: "🍫", img: "", cost: 4, published: true },
]

export function isGiftCatalogId(value: string): value is InventoryItem["type"] {
  return typeof value === "string" && value.trim().length > 0
}

/** Сколько ❤ начислить при обмене подарка из магазина: цена подарка в ❤ минус 1. */
export function heartsFromGiftSellback(costHearts: number): number {
  return Math.max(0, Math.floor(costHearts) - 1)
}

/** Цена подарка в сердцах по строке каталога (только опубликованные). */
export function getPublishedShopGiftHeartCost(
  giftType: InventoryItem["type"],
  rows: readonly GiftCatalogRow[],
): number | null {
  const row = rows.find((r) => r.id === giftType && r.published && !r.deleted)
  if (!row || row.cost < 1) return null
  return row.cost
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
      img: toGiftImageUrl(typeof rec.img === "string" ? rec.img : ""),
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
