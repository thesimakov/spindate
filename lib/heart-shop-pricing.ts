/**
 * Прайс пакетов сердец (магазин + get_item VK).
 * Базовый курс витрины: ~10 ❤ за голос; пакеты с бонусом к курсу.
 */

/** Базовый курс для витрины и бейджа скидки: round(сердца / 10), минимум 1 */
export const HEARTS_PER_VOTE_LIST = 10

/** Размеры пакетов в сердцах (согласованы с item id hearts_{N} в VK). */
export const VK_HEART_PACK_AMOUNTS = [12, 60, 150, 400, 1000, 2500, 7500] as const

/** Фактическая цена в голосах VK по размеру пакета. */
const PAY_VOTES_BY_PACK: Record<number, number> = {
  12: 1,
  60: 5,
  150: 10,
  400: 25,
  1000: 50,
  2500: 100,
  7500: 250,
}

/** «Витринная» цена в голосах (для −%): по курсу ~10 ❤ за голос, округление */
export function listVotesForPack(hearts: number): number {
  return Math.max(1, Math.round(hearts / HEARTS_PER_VOTE_LIST))
}

/** Фактическая оплата в голосах (фиксированный прайс по пакетам) */
export function payVotesForPack(hearts: number): number {
  const fixed = PAY_VOTES_BY_PACK[hearts]
  if (typeof fixed === "number") return fixed
  return Math.max(1, Math.ceil(hearts / HEARTS_PER_VOTE_LIST))
}
