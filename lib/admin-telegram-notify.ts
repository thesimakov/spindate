import { APP_BASE_PATH } from "@/lib/app-path"

function adminPanelAbsoluteUrl(): string | null {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (!origin) return null
  const base = APP_BASE_PATH || ""
  return `${origin}${base}/admin-lemnity`
}

/**
 * Уведомление в Telegram о новом объявлении в тикере (на модерации).
 * Если не заданы `TELEGRAM_ADMIN_BOT_TOKEN` и `TELEGRAM_ADMIN_CHAT_ID` — ничего не делает.
 */
export async function notifyTelegramTickerModerationQueued(input: {
  adId: number
  authorDisplayName: string
  body: string
  linkUrl: string
  costHearts: number
}): Promise<void> {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim()
  const chatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
  if (!token || !chatIdRaw) return

  const preview = input.body.trim().slice(0, 280)
  const longBody = input.body.trim().length > 280
  const adminUrl = adminPanelAbsoluteUrl()

  const lines = [
    "Spindate — объявление в тикере на модерации",
    `id: ${input.adId}`,
    `Автор: ${input.authorDisplayName}`,
    `Текст: ${preview}${longBody ? "…" : ""}`,
    `Ссылка: ${input.linkUrl}`,
    `Оплачено: ${input.costHearts} сердец`,
  ]
  if (adminUrl) {
    lines.push(`Админка: ${adminUrl} (вкладка «Объявления»)`)
  }

  const text = lines.join("\n")
  const url = `https://api.telegram.org/bot${token}/sendMessage`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdRaw,
        text,
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.warn("[admin-telegram] sendMessage failed:", res.status, errText.slice(0, 200))
    }
  } catch (e) {
    console.warn("[admin-telegram] sendMessage error:", e)
  }
}
