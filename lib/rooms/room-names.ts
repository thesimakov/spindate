/** Подпись для лобби: `Room #N` / «Комната #N» / «Игровые столы #N» → «Игровой стол #N». Без серверных зависимостей — безопасно для клиента. */
export function roomNameForDisplay(name: string, roomId: number): string {
  const t = name.trim()
  const mRoom = /^Room #(\d+)$/i.exec(t)
  if (mRoom) return `Игровой стол #${mRoom[1]}`
  const mOld = /^Комната #(\d+)$/i.exec(t)
  if (mOld) return `Игровой стол #${mOld[1]}`
  const mPlural = /^Игровые столы #(\d+)$/i.exec(t)
  if (mPlural) return `Игровой стол #${mPlural[1]}`
  return t || `Игровой стол #${roomId}`
}
