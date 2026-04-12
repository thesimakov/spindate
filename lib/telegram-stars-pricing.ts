/** Базовый курс: 1 ⭐ ≈ 10 ❤. */
export const TELEGRAM_HEARTS_PER_STAR = 10

export type TelegramStarsPackId = "s5" | "s12" | "s25" | "s50" | "s100"

export const TELEGRAM_STARS_PACKS: readonly {
  id: TelegramStarsPackId
  hearts: number
  stars: number
  description: string
}[] = [
  { id: "s5", hearts: 50, stars: 5, description: "50 сердец" },
  { id: "s12", hearts: 120, stars: 12, description: "120 сердец" },
  { id: "s25", hearts: 250, stars: 25, description: "250 сердец" },
  { id: "s50", hearts: 500, stars: 50, description: "500 сердец" },
  { id: "s100", hearts: 1000, stars: 100, description: "1000 сердец" },
] as const

export function getTelegramStarsPack(id: unknown) {
  if (typeof id !== "string") return undefined
  return TELEGRAM_STARS_PACKS.find((p) => p.id === id)
}
