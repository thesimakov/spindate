/** Серверные вызовы VK API для сообществ (групп). */

const VK_API_VERSION = "5.199"

/** VK error 6 — слишком много запросов в секунду. */
const VK_ERR_TOO_MANY_PER_SECOND = 6

function getServiceToken(): string | undefined {
  const t = process.env.VK_SERVICE_ACCESS_TOKEN?.trim()
  return t || undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type VkGroupsIsMemberResult =
  | { ok: true; member: boolean; raw?: unknown }
  | { ok: false; reason: string; vkError?: unknown }

/**
 * Один запрос groups.isMember без ретраев — для массовых проверок в админке
 * (между вызовами нужна пауза, иначе VK error 6).
 */
export async function vkGroupsIsMemberOnce(args: {
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
      const code = json.error.error_code
      if (code === VK_ERR_TOO_MANY_PER_SECOND) {
        return { ok: false, reason: "rate_limit", vkError: json.error }
      }
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

/**
 * Проверка подписки пользователя на сообщество (сервисный ключ приложения).
 * При лимите VK (error 6) делает несколько повторов с паузой.
 * @see https://dev.vk.com/method/groups.isMember
 */
export async function vkGroupsIsMember(args: {
  groupId: number
  userId: number
}): Promise<VkGroupsIsMemberResult> {
  const maxAttempts = 5
  const backoffMs = [0, 800, 1600, 2400, 4000]
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(backoffMs[attempt] ?? 1000)
    const result = await vkGroupsIsMemberOnce(args)
    if (result.ok) return result
    if (result.reason !== "rate_limit") return result
  }
  return { ok: false, reason: "rate_limit" }
}
