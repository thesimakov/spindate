import { APP_BASE_PATH } from "@/lib/app-path"

let warnedMissingVkEnv = false

function warnVkMissingEnvOnce(): void {
  if (warnedMissingVkEnv) return
  warnedMissingVkEnv = true
  console.warn(
    "[admin-vk] пропуск: нет VK_MODERATION_GROUP_TOKEN или VK_MODERATION_ADMIN_USER_ID в env сервера (см. .env.example)",
  )
}

const VK_API_DEFAULT_VERSION = "5.199"
const APP_PUBLIC_ORIGIN_FALLBACK = "https://spindate.lemnity.ru"

function getVkApiVersion(): string {
  const v = process.env.VK_MODERATION_API_VERSION?.trim()
  if (!v) return VK_API_DEFAULT_VERSION
  return v
}

function adminPanelAbsoluteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  const origin = raw || APP_PUBLIC_ORIGIN_FALLBACK
  const base = APP_BASE_PATH || ""
  return `${origin}${base}/admin-lemnity`
}

function parseAdminVkUserId(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw.trim())
  if (!Number.isSafeInteger(n) || n <= 0) return null
  return n
}

function makeRandomId(adId: number): number {
  const now = Date.now() % 1_000_000
  return (adId % 1_000_000) * 1_000_000 + now
}

/**
 * Уведомление в VK ЛС администратору о новом объявлении в тикере (на модерации).
 * Если не заданы VK_MODERATION_GROUP_TOKEN и VK_MODERATION_ADMIN_USER_ID — ничего не делает.
 */
export async function notifyVkTickerModerationQueued(input: {
  adId: number
  authorDisplayName: string
  body: string
  linkUrl: string
  costHearts: number
}): Promise<void> {
  const token = process.env.VK_MODERATION_GROUP_TOKEN?.trim()
  const adminVkUserId = parseAdminVkUserId(process.env.VK_MODERATION_ADMIN_USER_ID)
  if (!token || !adminVkUserId) {
    warnVkMissingEnvOnce()
    return
  }

  const preview = input.body.trim().slice(0, 280)
  const longBody = input.body.trim().length > 280
  const adminUrl = adminPanelAbsoluteUrl()

  const message = [
    "Spindate — объявление в тикере на модерации",
    `id: ${input.adId}`,
    `Автор: ${input.authorDisplayName}`,
    `Текст: ${preview}${longBody ? "…" : ""}`,
    `Ссылка: ${input.linkUrl}`,
    `Оплачено: ${input.costHearts} сердец`,
    `Админка: ${adminUrl} (вкладка «Объявления»)`,
  ].join("\n")

  const body = new URLSearchParams({
    user_id: String(adminVkUserId),
    random_id: String(makeRandomId(input.adId)),
    message,
    access_token: token,
    v: getVkApiVersion(),
  })

  try {
    const res = await fetch("https://api.vk.com/method/messages.send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const json = (await res.json().catch(() => null)) as
      | { response?: number; error?: { error_code?: number; error_msg?: string } }
      | null
    if (!res.ok || !json) {
      console.warn("[admin-vk] messages.send failed:", res.status)
      return
    }
    if (json.error) {
      console.warn(
        "[admin-vk] messages.send vk error:",
        json.error.error_code ?? "unknown",
        json.error.error_msg ?? "unknown",
      )
      return
    }
    console.info(`[admin-vk] уведомление отправлено, ad id=${input.adId}`)
  } catch (e) {
    console.warn("[admin-vk] messages.send error:", e)
  }
}
