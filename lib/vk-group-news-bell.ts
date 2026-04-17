import type { Player } from "@/lib/game-types"
import { readVkUserIdFromClientLocation } from "@/lib/vk-bridge"

/** localStorage: анимация колокольчика «новости ВК» выключена — пользователь подписан / подтверждено */
const STORAGE_KEY = "spindate_vk_group_news_subscribed_v1"

export const VK_GROUP_BELL_STORAGE_EVENT = "spindate-vk-group-bell"

export function buildVkGroupSubscribeRewardUrl(user: Player | null): string {
  let vk: number | null = null
  if (user) {
    if (user.authProvider === "vk") {
      const id = typeof user.vkUserId === "number" ? user.vkUserId : user.id
      if (typeof id === "number" && id > 0) vk = id
    } else if (typeof user.vkUserId === "number" && user.vkUserId > 0) {
      vk = user.vkUserId
    }
  }
  if (vk == null) vk = readVkUserIdFromClientLocation()
  if (vk != null) {
    return `/api/rewards/vk-group-subscribe?vk_user_id=${encodeURIComponent(String(vk))}`
  }
  return "/api/rewards/vk-group-subscribe"
}

export function isVkGroupBellAnimationOff(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function markVkGroupBellAnimationOff(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, "1")
    window.dispatchEvent(new Event(VK_GROUP_BELL_STORAGE_EVENT))
  } catch {
    /* ignore */
  }
}

export function resetVkGroupBellAnimationState(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event(VK_GROUP_BELL_STORAGE_EVENT))
  } catch {
    /* ignore */
  }
}
