import { APP_BASE_PATH } from "@/lib/app-path"

let warnedMissingTelegramEnv = false
function warnTelegramMissingEnvOnce(): void {
  if (warnedMissingTelegramEnv) return
  warnedMissingTelegramEnv = true
  console.warn(
    "[admin-telegram] пропуск: нет TELEGRAM_ADMIN_BOT_TOKEN или TELEGRAM_ADMIN_CHAT_ID в env сервера (см. .env.example)",
  )
}

/** Убирает кавычки из .env и приводит числовой chat_id к number (Telegram принимает оба варианта). */
function normalizeTelegramChatId(raw: string): string | number {
  const s = raw.trim().replace(/^["']|["']$/g, "")
  if (/^-?\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isSafeInteger(n)) return n
  }
  return s
}

/** Как в `app/layout.tsx` — чтобы ссылка в Telegram совпадала с прод-доменом, если в env не задан URL. */
const APP_PUBLIC_ORIGIN_FALLBACK = "https://spindate.lemnity.ru"

function adminPanelAbsoluteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  const origin = raw || APP_PUBLIC_ORIGIN_FALLBACK
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
  if (!token || !chatIdRaw) {
    warnTelegramMissingEnvOnce()
    return
  }

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
    `Админка: ${adminUrl} (вкладка «Объявления»)`,
  ]

  const text = lines.join("\n")
  const url = `https://api.telegram.org/bot${token}/sendMessage`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: normalizeTelegramChatId(chatIdRaw),
        text,
        disable_web_page_preview: true,
      }),
    })
    const errText = await res.text().catch(() => "")
    if (!res.ok) {
      console.warn("[admin-telegram] sendMessage failed:", res.status, errText.slice(0, 400))
      return
    }
    try {
      const j = JSON.parse(errText) as { ok?: boolean; description?: string }
      if (j?.ok === true) {
        console.info(`[admin-telegram] уведомление отправлено, ad id=${input.adId}`)
      } else {
        console.warn("[admin-telegram] Telegram ответил ok=false:", j?.description ?? errText.slice(0, 300))
      }
    } catch {
      console.info(`[admin-telegram] ответ sendMessage не JSON (ad id=${input.adId})`)
    }
  } catch (e) {
    console.warn("[admin-telegram] sendMessage error:", e)
  }
}
