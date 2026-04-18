/**
 * Базовый URL сервиса из `reference/spin-game-stack` (Express + Socket.io).
 * Пример: `NEXT_PUBLIC_SPIN_GAME_URL=http://127.0.0.1:4000`
 */
export function getSpinGameBaseUrl(): string | null {
  if (typeof process === "undefined") return null
  const raw = process.env.NEXT_PUBLIC_SPIN_GAME_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, "")
}
