export const TICKER_AD_TIERS = {
  "10m": { duration_ms: 600_000, cost_hearts: 200, label: "10 минут" },
  "20m": { duration_ms: 1_200_000, cost_hearts: 500, label: "20 минут" },
  "1h": { duration_ms: 3_600_000, cost_hearts: 2_000, label: "1 час" },
} as const

export type TickerAdTierId = keyof typeof TICKER_AD_TIERS
