/**
 * Прайс пакетов сердец (магазин + get_item VK).
 * Логика: ориентир **15 ❤ ≈ 1 голос**; фиксированные якоря по пакетам.
 * Для 1000/5000 в ТЗ указаны «руб» — в VK Pay передаём те же числа как сумму оплаты (как и раньше в проекте).
 */

/** Базовый курс для витрины и бейджа скидки: round(сердца / 15), минимум 1 */
export const HEARTS_PER_VOTE_LIST = 15

const PAY_VOTES_BY_PACK: Record<number, number> = {
  5: 1,
  50: 3,
  150: 9,
  500: 30,
  1000: 50,
  5000: 270,
}

/** «Витринная» цена в голосах (для −%): по курсу ~15 ❤ за голос, округление */
export function listVotesForPack(hearts: number): number {
  return Math.max(1, Math.round(hearts / HEARTS_PER_VOTE_LIST))
}

/** Фактическая оплата в голосах (фиксированный прайс по пакетам) */
export function payVotesForPack(hearts: number): number {
  const fixed = PAY_VOTES_BY_PACK[hearts]
  if (typeof fixed === "number") return fixed
  return Math.max(1, Math.ceil(hearts / HEARTS_PER_VOTE_LIST))
}
