import { z } from "zod"
import type { Env } from "../config/env.js"

const bodySchema = z.object({
  vkUserId: z.string().min(1),
  username: z.string().min(1).max(64),
  avatar: z.string().min(1).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  age: z.number().int().min(13).max(120).optional(),
})

export type VkAuthBody = z.infer<typeof bodySchema>

/**
 * В продакшене: проверка подписи VK (vk_user из launch params + secret).
 * Здесь — контракт; реализацию см. https://dev.vk.com/mini-apps/development/launch-params
 */
export function parseVkAuthBody(raw: unknown): VkAuthBody {
  return bodySchema.parse(raw)
}

export function assertDevBypass(env: Env, headerVkId: string | undefined): void {
  if (env.DEV_VK_BYPASS && headerVkId) return
  if (env.NODE_ENV === "development" && env.DEV_VK_BYPASS) return
}

/** Заголовок только для локальной отладки: X-VK-User-Id */
export function readDevVkUserId(headers: Record<string, string | string[] | undefined>): string | undefined {
  const v = headers["x-vk-user-id"]
  if (typeof v === "string" && v.length > 0) return v
  return undefined
}
