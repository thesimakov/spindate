import type { Player } from "@/lib/game-types"

/** Разбор профиля игрока для live/rooms (как в app/api/table/live/route.ts) */
export function parsePlayerFromClientBody(raw: unknown): Player | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const id = Number(p.id)
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : ""
  const avatar = typeof p.avatar === "string" ? p.avatar.trim() : ""
  const gender = p.gender === "female" ? "female" : p.gender === "male" ? "male" : null
  const ageRaw = Number(p.age)
  const age = Number.isFinite(ageRaw) ? Math.min(120, Math.max(18, Math.floor(ageRaw))) : 18
  const purpose =
    p.purpose === "relationships" || p.purpose === "communication" || p.purpose === "love"
      ? p.purpose
      : "communication"
  const status =
    typeof p.status === "string" && p.status.trim() ? p.status.trim().slice(0, 15) : undefined
  const authUserId =
    typeof p.authUserId === "string" && p.authUserId.trim() ? p.authUserId.trim() : undefined
  const vkUserIdRaw = Number(p.vkUserId)
  const vkUserId = Number.isInteger(vkUserIdRaw) && vkUserIdRaw > 0 ? vkUserIdRaw : undefined
  if (!Number.isInteger(id) || id <= 0) return null
  if (!gender) return null

  return {
    id,
    name: name || `Игрок ${id}`,
    avatar,
    gender,
    age,
    purpose,
    lookingFor: p.lookingFor === "male" || p.lookingFor === "female" ? p.lookingFor : undefined,
    authProvider: p.authProvider === "vk" || p.authProvider === "login" ? p.authProvider : undefined,
    city: typeof p.city === "string" ? p.city : undefined,
    interests: typeof p.interests === "string" ? p.interests : undefined,
    zodiac: typeof p.zodiac === "string" ? p.zodiac : undefined,
    isVip: typeof p.isVip === "boolean" ? p.isVip : undefined,
    status,
    authUserId,
    vkUserId,
    isBot: false,
  }
}
