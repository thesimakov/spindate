import type { InventoryItem } from "@/lib/game-types"
import { catalogMediaUrl } from "@/lib/assets"

export type GiftCatalogSection = "free" | "paid" | "vip"

/** Чем оплачивается подарок в каталоге: сердечки или розы из инвентаря. */
export type GiftPayCurrency = "hearts" | "roses"

export type GiftCatalogRow = {
  id: InventoryItem["type"]
  section: GiftCatalogSection
  name: string
  emoji: string
  /** Путь к картинке (загрузка админки → `/api/catalog/upload-asset/...` или статика `/assets/...`). */
  img: string
  /** Звук при дарении (загрузка в админке → `gift_music`, пусто = общий звук по умолчанию). */
  music: string
  cost: number
  /** По умолчанию сердечки; «Премиум» в игре — подарки с оплатой розами. */
  payCurrency: GiftPayCurrency
  published: boolean
  deleted?: boolean
  /** Лимитированный подарок: можно выкупить себе и затем хранить/подарить. */
  limited?: boolean
  /**
   * Остаток в каталоге: **−1** — без лимита; **0** — закончилось; **>0** — сколько штук можно выдать.
   */
  stock: number
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
  { id: "toy_bear", section: "vip", name: "Плюшевый мишка", emoji: "🧸", img: "", music: "", cost: 10, payCurrency: "hearts", published: true, limited: false, stock: -1 },
  { id: "plush_heart", section: "paid", name: "Подушка-сердце", emoji: "❤️", img: "", music: "", cost: 8, payCurrency: "hearts", published: true, limited: false, stock: -1 },
  { id: "toy_car", section: "paid", name: "Игрушечная машинка", emoji: "🚗", img: "", music: "", cost: 7, payCurrency: "hearts", published: true, limited: false, stock: -1 },
  { id: "toy_ball", section: "paid", name: "Футбольный мяч", emoji: "⚽️", img: "", music: "", cost: 6, payCurrency: "hearts", published: true, limited: false, stock: -1 },
  { id: "souvenir_magnet", section: "paid", name: "Магнитик на холодильник", emoji: "🧲", img: "", music: "", cost: 3, payCurrency: "hearts", published: true, limited: false, stock: -1 },
  { id: "souvenir_keychain", section: "paid", name: "Брелок-сувенир", emoji: "🔑", img: "", music: "", cost: 5, payCurrency: "hearts", published: true, limited: false, stock: -1 },
  { id: "chocolate_box", section: "paid", name: "Коробка конфет", emoji: "🍫", img: "", music: "", cost: 4, payCurrency: "hearts", published: true, limited: false, stock: -1 },
]

export function isGiftCatalogId(value: string): value is InventoryItem["type"] {
  return typeof value === "string" && value.trim().length > 0
}

/** Сколько ❤ начислить при обмене подарка из магазина: цена подарка в ❤ минус 1. */
export function heartsFromGiftSellback(costHearts: number): number {
  return Math.max(0, Math.floor(costHearts) - 1)
}

/** Цена подарка в сердцах по строке каталога (только опубликованные). Для оплаты розами — null (обмен на ❤ не применяется). */
export function getPublishedShopGiftHeartCost(
  giftType: InventoryItem["type"],
  rows: readonly GiftCatalogRow[],
): number | null {
  const row = rows.find((r) => r.id === giftType && r.published && !r.deleted)
  if (!row || row.cost < 1) return null
  if (row.payCurrency === "roses") return null
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
    const rec = item as Partial<GiftCatalogRow> & {
      id?: string
      section?: string
      payCurrency?: string
      pay_currency?: string
    }
    if (typeof rec.id !== "string" || !isGiftCatalogId(rec.id)) continue
    const payRaw = rec.payCurrency ?? rec.pay_currency
    const payCurrency: GiftPayCurrency = payRaw === "roses" ? "roses" : "hearts"
    const section: GiftCatalogSection =
      rec.section === "free" || rec.section === "vip"
        ? rec.section
        : payCurrency === "roses"
          ? Number(rec.cost) >= 25
            ? "vip"
            : "paid"
          : Number(rec.cost) >= 25
            ? "vip"
            : "paid"
    const rawStock = (rec as { stock?: unknown }).stock
    const stock =
      typeof rawStock === "number" && Number.isFinite(rawStock) ? Math.floor(rawStock) : -1

    const musicRaw = typeof (rec as { music?: unknown }).music === "string" ? (rec as { music: string }).music.trim() : ""
    const limitedRaw = (rec as { limited?: unknown }).limited

    const normalized: GiftCatalogRow = {
      id: rec.id,
      section,
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      emoji: typeof rec.emoji === "string" && rec.emoji.trim() ? rec.emoji.trim() : "🎁",
      img: toGiftImageUrl(typeof rec.img === "string" ? rec.img : ""),
      music: musicRaw,
      cost: Math.max(0, Number.isFinite(Number(rec.cost)) ? Math.floor(Number(rec.cost)) : 0),
      payCurrency,
      published: rec.published !== false,
      deleted: rec.deleted === true,
      limited: limitedRaw === true || limitedRaw === 1,
      stock: stock < 0 ? -1 : stock,
    }
    if (!options?.includeDeleted && normalized.deleted) continue
    if (options?.onlyPublished && !normalized.published) continue
    out.push(normalized)
  }
  return out
}
