import { assetUrl, BOTTLE_IMAGES } from "@/lib/assets"
import type { BottleSkin } from "@/lib/game-types"

export type BottleCatalogSkinRow = {
  id: BottleSkin
  name: string
  img: string
  cost: number
  published: boolean
  deleted?: boolean
}

export type BottleCatalogDefaultRow = Omit<BottleCatalogSkinRow, "img"> & { imgPath: string }

/** Дефолтный каталог для первичного сида БД и фолбэка в клиенте. */
export const DEFAULT_BOTTLE_CATALOG_SKINS: BottleCatalogDefaultRow[] = [
  { id: "classic", name: "Классическая", imgPath: BOTTLE_IMAGES.classic, cost: 0, published: true },
  { id: "ruby", name: "Лимонад", imgPath: BOTTLE_IMAGES.ruby, cost: 5, published: true },
  { id: "neon", name: "Виски", imgPath: BOTTLE_IMAGES.neon, cost: 5, published: false },
  { id: "frost", name: "Шампанское", imgPath: BOTTLE_IMAGES.frost, cost: 5, published: false },
  { id: "baby", name: "Детская", imgPath: BOTTLE_IMAGES.baby, cost: 5, published: true },
  { id: "vip", name: "VIP-бутылка", imgPath: BOTTLE_IMAGES.vip, cost: 200, published: false },
  { id: "milk", name: "Молочная", imgPath: BOTTLE_IMAGES.milk, cost: 5, published: true },
  { id: "frame_69", name: "Бутылочка 69", imgPath: BOTTLE_IMAGES.frame_69, cost: 5, published: true },
  { id: "frame_70", name: "Бутылочка 70", imgPath: BOTTLE_IMAGES.frame_70, cost: 5, published: true },
  { id: "frame_71", name: "Бутылочка 71", imgPath: BOTTLE_IMAGES.frame_71, cost: 5, published: true },
  { id: "frame_72", name: "Кетчуп", imgPath: BOTTLE_IMAGES.frame_72, cost: 5, published: true },
  { id: "frame_73", name: "Бутылочка 73", imgPath: BOTTLE_IMAGES.frame_73, cost: 5, published: true },
  { id: "frame_74", name: "Бутылочка 74", imgPath: BOTTLE_IMAGES.frame_74, cost: 5, published: true },
  { id: "frame_75", name: "Бутылочка 75", imgPath: BOTTLE_IMAGES.frame_75, cost: 5, published: true },
  { id: "frame_76", name: "Бутылочка 76", imgPath: BOTTLE_IMAGES.frame_76, cost: 5, published: true },
  { id: "frame_77", name: "Бутылочка 77", imgPath: BOTTLE_IMAGES.frame_77, cost: 5, published: true },
  { id: "frame_78", name: "Бутылочка 78", imgPath: BOTTLE_IMAGES.frame_78, cost: 5, published: true },
  { id: "frame_79", name: "Бутылочка 79", imgPath: BOTTLE_IMAGES.frame_79, cost: 5, published: true },
  { id: "frame_80", name: "Бутылочка 80", imgPath: BOTTLE_IMAGES.frame_80, cost: 5, published: true },
  { id: "fortune_wheel", name: "Колесо фортуны", imgPath: "", cost: 300, published: true },
]

const BOTTLE_SKIN_IDS: BottleSkin[] = DEFAULT_BOTTLE_CATALOG_SKINS.map((row) => row.id)
const BOTTLE_SKIN_ID_SET = new Set<string>(BOTTLE_SKIN_IDS)

export function isBottleSkin(value: string): value is BottleSkin {
  return BOTTLE_SKIN_ID_SET.has(value)
}

export function toBottleImageUrl(raw: string): string {
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? trimmed
  if (pathOnly.startsWith("/")) return assetUrl(pathOnly)
  if (pathOnly.startsWith("assets/")) return assetUrl(pathOnly)
  return assetUrl(`/assets/${pathOnly}`)
}

export function toBottleCatalogRow(row: BottleCatalogDefaultRow): BottleCatalogSkinRow {
  return {
    id: row.id,
    name: row.name,
    img: toBottleImageUrl(row.imgPath),
    cost: row.cost,
    published: row.published,
    deleted: false,
  }
}

export const DEFAULT_BOTTLE_CATALOG_ROWS: BottleCatalogSkinRow[] = DEFAULT_BOTTLE_CATALOG_SKINS.map(toBottleCatalogRow)

export const VISIBLE_BOTTLE_CATALOG_SKINS: BottleCatalogSkinRow[] = DEFAULT_BOTTLE_CATALOG_ROWS.filter(
  (row) => row.published && !row.deleted,
)

export function normalizeBottleCatalogRows(
  rows: unknown,
  options?: { onlyPublished?: boolean; includeDeleted?: boolean },
): BottleCatalogSkinRow[] {
  if (!Array.isArray(rows)) return options?.onlyPublished ? VISIBLE_BOTTLE_CATALOG_SKINS : DEFAULT_BOTTLE_CATALOG_ROWS
  const out: BottleCatalogSkinRow[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object") continue
    const rec = item as Partial<BottleCatalogSkinRow> & { id?: string }
    if (typeof rec.id !== "string" || !isBottleSkin(rec.id)) continue
    const normalized: BottleCatalogSkinRow = {
      id: rec.id,
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      img: toBottleImageUrl(typeof rec.img === "string" ? rec.img : ""),
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

export function getBottleCatalogCostFromRows(rows: BottleCatalogSkinRow[], id: BottleSkin): number {
  return rows.find((r) => r.id === id)?.cost ?? 0
}

export function getBottleCatalogCost(id: BottleSkin): number {
  return getBottleCatalogCostFromRows(DEFAULT_BOTTLE_CATALOG_ROWS, id)
}

export function getBottleCatalogRowById(id: BottleSkin): BottleCatalogSkinRow | null {
  return DEFAULT_BOTTLE_CATALOG_ROWS.find((row) => row.id === id) ?? null
}

export function formatBottleCatalogPrice(cost: number): string {
  return cost === 0 ? "Бесплатно" : `${cost} ❤`
}
