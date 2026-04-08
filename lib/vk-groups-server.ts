/** Серверные вызовы VK API для сообществ (групп). */

const VK_API_VERSION = "5.199"

function getServiceToken(): string | undefined {
  const t = process.env.VK_SERVICE_ACCESS_TOKEN?.trim()
  return t || undefined
}

export type VkGroupsIsMemberResult =
  | { ok: true; member: boolean; raw?: unknown }
  | { ok: false; reason: string; vkError?: unknown }

/**
 * Проверка подписки пользователя на сообщество (сервисный ключ приложения).
 * @see https://dev.vk.com/method/groups.isMember
 */
export async function vkGroupsIsMember(args: {
  groupId: number
  userId: number
}): Promise<VkGroupsIsMemberResult> {
  const token = getServiceToken()
  if (!token) return { ok: false, reason: "missing_service_token" }
  if (!Number.isInteger(args.groupId) || args.groupId <= 0) return { ok: false, reason: "invalid_group_id" }
  if (!Number.isInteger(args.userId) || args.userId <= 0) return { ok: false, reason: "invalid_user_id" }

  const body = new URLSearchParams({
    group_id: String(args.groupId),
    user_id: String(args.userId),
    access_token: token,
    v: VK_API_VERSION,
  })

  try {
    const res = await fetch("https://api.vk.com/method/groups.isMember", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const json = (await res.json().catch(() => null)) as {
      response?: number | { member?: number }
      error?: { error_code?: number; error_msg?: string }
    } | null
    if (!json) return { ok: false, reason: "invalid_json" }
    if (json.error) {
      return { ok: false, reason: json.error.error_msg ?? "vk_api_error", vkError: json.error }
    }
    const r = json.response
    let member = false
    if (typeof r === "number") member = r === 1
    else if (r && typeof r === "object" && typeof r.member === "number") member = r.member === 1
    return { ok: true, member, raw: json.response }
  } catch {
    return { ok: false, reason: "fetch_failed" }
  }
}
