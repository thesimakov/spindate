/** Включить боковую панель «Колесо фортуны» и пункт в меню. */
export const FORTUNE_WHEEL_ENABLED = true

/** Стоимость одного спина за сердца (реклама — не чаще 1× в сутки, отдельно). */
export const FORTUNE_WHEEL_SPIN_COST_HEARTS = 25

export type FortuneWheelReward =
  | { kind: "hearts"; amount: number; label: string; icon: string }
  | { kind: "roses"; amount: number; label: string; icon: string }

/** Локальный календарный день (как в ежедневных бонусах игры). */
export function getLocalDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Ключ localStorage: бесплатный спин по рекламе уже использован за сутки. */
export function fortuneWheelAdSpinStorageKey(playerId: number, dateKey: string): string {
  return `fortune_wheel_ad_spin_v2_${playerId}_${dateKey}`
}

/** Правила мини-игры: список секторов и их награды (без «билетов» — спин за ❤ или рекламу). */
export const FORTUNE_WHEEL_SEGMENTS: readonly FortuneWheelReward[] = [
  { kind: "hearts", amount: 1, label: "x1", icon: "❤️" },
  { kind: "hearts", amount: 5, label: "x5", icon: "❤️" },
  { kind: "hearts", amount: 10, label: "x10", icon: "❤️" },
  { kind: "hearts", amount: 20, label: "x20", icon: "❤️" },
  { kind: "hearts", amount: 100, label: "x100", icon: "🪙" },
  { kind: "hearts", amount: 1000, label: "x1000", icon: "🪙" },
  { kind: "roses", amount: 1, label: "x1", icon: "🌹" },
  { kind: "roses", amount: 3, label: "x3", icon: "🌹" },
] as const

/** Вычисляет угол остановки и индекс сектора по правилам рулетки. */
export function resolveFortuneWheelSpin(currentRotationDeg: number, segmentCount: number) {
  const idx = Math.floor(Math.random() * segmentCount)
  const segmentAngle = 360 / segmentCount
  const centerAngle = idx * segmentAngle + segmentAngle / 2
  const targetOffset = 360 - centerAngle
  const spins = 6 + Math.floor(Math.random() * 2)
  const nextRotation = currentRotationDeg + spins * 360 + targetOffset
  return { idx, nextRotation }
}
