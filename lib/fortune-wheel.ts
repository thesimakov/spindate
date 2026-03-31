/** Включить боковую панель «Колесо фортуны» и пункт в меню. Выключено — включим позже. */
export const FORTUNE_WHEEL_ENABLED = false

export type FortuneWheelReward =
  | { kind: "hearts"; amount: number; label: string; icon: string }
  | { kind: "roses"; amount: number; label: string; icon: string }
  | { kind: "tickets"; amount: number; label: string; icon: string }

/** Правила мини-игры: список секторов и их награды. */
export const FORTUNE_WHEEL_SEGMENTS: readonly FortuneWheelReward[] = [
  { kind: "hearts", amount: 1, label: "x1", icon: "❤️" },
  { kind: "hearts", amount: 5, label: "x5", icon: "❤️" },
  { kind: "hearts", amount: 10, label: "x10", icon: "❤️" },
  { kind: "hearts", amount: 20, label: "x20", icon: "❤️" },
  { kind: "hearts", amount: 100, label: "x100", icon: "🪙" },
  { kind: "hearts", amount: 1000, label: "x1000", icon: "🪙" },
  { kind: "roses", amount: 1, label: "x1", icon: "🌹" },
  { kind: "roses", amount: 3, label: "x3", icon: "🌹" },
  { kind: "tickets", amount: 1, label: "x1", icon: "🎡" },
  { kind: "tickets", amount: 2, label: "x2", icon: "🎡" },
] as const

/** Хранилище билетов по игроку. */
export function fortuneWheelTicketsStorageKey(playerId: number): string {
  return `spindate_fortune_wheel_tickets_v1_${playerId}`
}

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
