/**
 * Игровой цикл «бутылка»: выбор случайного активного игрока кроме текущего спиннера.
 */
export function pickRandomTarget(params: {
  roomPlayerIds: string[]
  spinnerUserId: string
}): string | null {
  const others = params.roomPlayerIds.filter((id) => id !== params.spinnerUserId)
  if (others.length === 0) return null
  const idx = Math.floor(Math.random() * others.length)
  return others[idx] ?? null
}
