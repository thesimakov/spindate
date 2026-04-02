import { assetUrl, BOTTLE_IMAGES } from "@/lib/assets"
import type { BottleSkin } from "@/lib/game-types"

export type BottleCatalogSkinRow = {
  id: BottleSkin
  name: string
  img: string
  cost: number
}

/** Скины и цены в каталоге бутылочек (магазин за столом). */
export const BOTTLE_CATALOG_SKINS: BottleCatalogSkinRow[] = [
  { id: "classic", name: "Классическая", img: assetUrl(BOTTLE_IMAGES.classic), cost: 0 },
  { id: "ruby", name: "Лимонад", img: assetUrl(BOTTLE_IMAGES.ruby), cost: 5 },
  { id: "neon", name: "Виски", img: assetUrl(BOTTLE_IMAGES.neon), cost: 5 },
  { id: "frost", name: "Шампанское", img: assetUrl(BOTTLE_IMAGES.frost), cost: 5 },
  { id: "baby", name: "Детская", img: assetUrl(BOTTLE_IMAGES.baby), cost: 5 },
  { id: "vip", name: "VIP-бутылка", img: assetUrl(BOTTLE_IMAGES.vip), cost: 200 },
  { id: "milk", name: "Молочная", img: assetUrl(BOTTLE_IMAGES.milk), cost: 5 },
  { id: "frame_69", name: "Бутылочка 69", img: assetUrl(BOTTLE_IMAGES.frame_69), cost: 5 },
  { id: "frame_70", name: "Бутылочка 70", img: assetUrl(BOTTLE_IMAGES.frame_70), cost: 5 },
  { id: "frame_71", name: "Бутылочка 71", img: assetUrl(BOTTLE_IMAGES.frame_71), cost: 5 },
  { id: "frame_72", name: "Кетчуп", img: assetUrl(BOTTLE_IMAGES.frame_72), cost: 5 },
  { id: "frame_73", name: "Бутылочка 73", img: assetUrl(BOTTLE_IMAGES.frame_73), cost: 5 },
  { id: "frame_74", name: "Бутылочка 74", img: assetUrl(BOTTLE_IMAGES.frame_74), cost: 5 },
  { id: "frame_75", name: "Бутылочка 75", img: assetUrl(BOTTLE_IMAGES.frame_75), cost: 5 },
  { id: "frame_76", name: "Бутылочка 76", img: assetUrl(BOTTLE_IMAGES.frame_76), cost: 5 },
  { id: "frame_77", name: "Бутылочка 77", img: assetUrl(BOTTLE_IMAGES.frame_77), cost: 5 },
  { id: "frame_78", name: "Бутылочка 78", img: assetUrl(BOTTLE_IMAGES.frame_78), cost: 5 },
  { id: "frame_79", name: "Бутылочка 79", img: assetUrl(BOTTLE_IMAGES.frame_79), cost: 5 },
  { id: "frame_80", name: "Бутылочка 80", img: assetUrl(BOTTLE_IMAGES.frame_80), cost: 5 },
  { id: "fortune_wheel", name: "Колесо фортуны", img: "", cost: 300 },
]

/**
 * Временная модерация: алкогольные скины скрыты из каталога.
 * Вернуть после модерации: удалить id из этого Set.
 */
export const TEMP_HIDDEN_BOTTLE_SKINS = new Set<BottleSkin>(["neon", "frost"])

export const VISIBLE_BOTTLE_CATALOG_SKINS: BottleCatalogSkinRow[] = BOTTLE_CATALOG_SKINS.filter(
  (row) => !TEMP_HIDDEN_BOTTLE_SKINS.has(row.id),
)

export function getBottleCatalogCost(id: BottleSkin): number {
  return BOTTLE_CATALOG_SKINS.find((r) => r.id === id)?.cost ?? 0
}

export function formatBottleCatalogPrice(cost: number): string {
  return cost === 0 ? "Бесплатно" : `${cost} ❤`
}
