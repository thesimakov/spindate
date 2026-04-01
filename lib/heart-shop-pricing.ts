/**
 * Прайс пакетов сердец (магазин + get_item VK).
 * Логика: чем крупнее пакет, тем дешевле 1 сердце в голосах и тем выше скидка.
 */

/** Базовый курс для витрины и бейджа скидки: round(сердца / 15), минимум 1 */
export const HEARTS_PER_VOTE_LIST = 15

const PAY_VOTES_BY_PACK: Record<number, number> = {
  5: 1,
  50: 3,
  150: 8,
  200: 9,
  500: 26,
  1000: 48,
  5000: 210,
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
