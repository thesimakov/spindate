export const TICKER_AD_TIERS = {
  "5m": { duration_ms: 300_000, cost_hearts: 100, label: "5 минут" },
  "10m": { duration_ms: 600_000, cost_hearts: 200, label: "10 минут" },
  "20m": { duration_ms: 1_200_000, cost_hearts: 500, label: "20 минут" },
} as const

export type TickerAdTierId = keyof typeof TICKER_AD_TIERS

/** Порядок отображения и выбора «первого доступного» тарифа. */
export const TICKER_AD_TIER_ORDER: readonly TickerAdTierId[] = ["5m", "10m", "20m"]
