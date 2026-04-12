import { apiFetch } from "@/lib/api-fetch"
import type { InventoryItem, Player, UserVisualPrefs } from "@/lib/game-types"

function vkUserIdForApi(user: Player): number | undefined {
  if (typeof user.vkUserId === "number") return user.vkUserId
  if (user.authProvider === "vk" && typeof user.id === "number") return user.id
  return undefined
}

function okUserIdForApi(user: Player): number | undefined {
  if (typeof user.okUserId === "number") return user.okUserId
  if (user.authProvider === "ok" && typeof user.id === "number") return user.id
  return undefined
}

/** URL для PUT состояния (логин — cookie, VK/ОК — query). */
export function userStatePutUrl(user: Player): string | null {
  if (user.authProvider === "login") return "/api/user/state"
  if (user.authProvider === "vk") {
    const vk = vkUserIdForApi(user)
    if (vk == null) return null
    return `/api/user/state?vk_user_id=${encodeURIComponent(String(vk))}`
  }
  if (user.authProvider === "ok") {
    const ok = okUserIdForApi(user)
    if (ok == null) return null
    return `/api/user/state?ok_user_id=${encodeURIComponent(String(ok))}`
  }
  return null
}

/** POST начисления за VK reward от спонсоров (сессия или vk_user_id, как у /api/user/state). */
export function vkAdRewardPostUrl(user: Player): string | null {
  if (user.authProvider !== "vk") return null
  const vk = vkUserIdForApi(user)
  if (vk == null) return null
  return `/api/vk/ad-reward?vk_user_id=${encodeURIComponent(String(vk))}`
}

/** Сразу записать баланс, инвентарь и визуальные настройки (обходит debounce GameProvider). */
export async function persistUserGameState(
  user: Player,
  voiceBalance: number,
  inventory: InventoryItem[],
  visualPrefs?: UserVisualPrefs,
): Promise<boolean> {
  const url = userStatePutUrl(user)
  if (!url) return false
  try {
    const res = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        voiceBalance,
        inventory,
        ...(visualPrefs ? { visualPrefs } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
