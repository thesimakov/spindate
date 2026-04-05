/** Компактное отображение сердец: 1000 → 1к, 7472 → 7,5к, 10000 → 10к */
export function formatVoiceBalanceCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0"
  const v = Math.floor(n)
  if (v < 1000) return String(v)
  const k = v / 1000
  if (Number.isInteger(k)) return `${k}к`
  const rounded = Math.round(k * 10) / 10
  const intPart = Math.floor(rounded)
  const frac = Math.round((rounded - intPart) * 10)
  if (frac === 0) return `${intPart}к`
  return `${intPart},${frac}к`
}
