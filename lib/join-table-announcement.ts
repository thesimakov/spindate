import type { Gender } from "@/lib/game-types"

/** Строка в общий чат стола при входе игрока (род по полу профиля). */
export function tableJoinAnnouncementText(name: string, gender?: Gender): string {
  const n = name.trim() || "Игрок"
  if (gender === "female") return `К нам присоединилась ${n}`
  return `К нам присоединился ${n}`
}
