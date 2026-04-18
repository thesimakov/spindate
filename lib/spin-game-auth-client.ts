"use client"

import { getSpinGameBaseUrl } from "@/lib/spin-game-config"
import { setSpinGameSessionToken } from "@/lib/spin-game-session"

export type SpinGameVkAuthBody = {
  vkUserId: string
  username: string
  avatar?: string
  gender?: "male" | "female" | "other"
  age?: number
}

/**
 * POST {NEXT_PUBLIC_SPIN_GAME_URL}/api/auth/vk и сохранение `sessionToken` для Socket.io.
 * Возвращает false, если URL не настроен или запрос не удался.
 */
export async function loginSpinGameWithVk(body: SpinGameVkAuthBody): Promise<boolean> {
  const base = getSpinGameBaseUrl()
  if (!base) return false
  try {
    const res = await fetch(`${base}/api/auth/vk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { sessionToken?: string }
    if (!data.sessionToken) return false
    setSpinGameSessionToken(data.sessionToken)
    return true
  } catch {
    return false
  }
}
