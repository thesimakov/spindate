import { apiFetch } from "@/lib/api-fetch"
import type { InventoryItem, Player } from "@/lib/game-types"

function vkUserIdForApi(user: Player): number | undefined {
  if (typeof user.vkUserId === "number") return user.vkUserId
  if (user.authProvider === "vk" && typeof user.id === "number") return user.id
  return undefined
}

/** URL для PUT состояния (логин — cookie, VK — query). */
export function userStatePutUrl(user: Player): string | null {
  if (user.authProvider === "login") return "/api/user/state"
  if (user.authProvider === "vk") {
    const vk = vkUserIdForApi(user)
    if (vk == null) return null
    return `/api/user/state?vk_user_id=${encodeURIComponent(String(vk))}`
  }
  return null
}

/** Сразу записать баланс и инвентарь на сервер (обходит debounce GameProvider). */
export async function persistUserGameState(
  user: Player,
  voiceBalance: number,
  inventory: InventoryItem[],
): Promise<boolean> {
  const url = userStatePutUrl(user)
  if (!url) return false
  try {
    const res = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ voiceBalance, inventory }),
    })
    return res.ok
  } catch {
    return false
  }
}
