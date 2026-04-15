export const TICKER_AD_TIERS = {
  "8m": { duration_ms: 480_000, cost_hearts: 80, label: "8 минут" },
  "15m": { duration_ms: 900_000, cost_hearts: 150, label: "15 минут" },
  "35m": { duration_ms: 2_100_000, cost_hearts: 350, label: "35 минут" },
} as const

export type TickerAdTierId = keyof typeof TICKER_AD_TIERS

/** Порядок отображения и выбора «первого доступного» тарифа. */
export const TICKER_AD_TIER_ORDER: readonly TickerAdTierId[] = ["8m", "15m", "35m"]
