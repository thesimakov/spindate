import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"

/**
 * Проверка настроек Telegram для уведомлений о модерации тикера.
 * GET с заголовком X-Admin-Token (как в остальной админке).
 */
export async function GET(req: Request) {
  const deny = requireAdmin(req)
  if (deny) return deny

  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()

  const base = {
    hasToken: Boolean(token),
    hasChatId: Boolean(chatId),
  }

  if (!token) {
    return NextResponse.json({
      ok: true,
      ...base,
      tokenValid: false,
      hint: "Добавьте TELEGRAM_ADMIN_BOT_TOKEN в .env.local на сервере и выполните pm2 restart spindate",
    })
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = (await r.json().catch(() => null)) as {
      ok?: boolean
      result?: { username?: string }
      description?: string
    }
    const tokenValid = r.ok && data?.ok === true

    if (!tokenValid) {
      return NextResponse.json({
        ok: true,
        ...base,
        tokenValid: false,
        telegramDescription: data?.description ?? null,
        hint: "Токен неверный или отозван — создайте нового бота в @BotFather",
      })
    }

    if (!chatId) {
      return NextResponse.json({
        ok: true,
        ...base,
        tokenValid: true,
        botUsername: data?.result?.username ?? null,
        hint: "Задайте TELEGRAM_ADMIN_CHAT_ID (напишите боту /start и откройте getUpdates в браузере)",
      })
    }

    return NextResponse.json({
      ok: true,
      ...base,
      tokenValid: true,
      botUsername: data?.result?.username ?? null,
      hint: "Токен и chat_id заданы. Оформите тестовое объявление в тикере и смотрите pm2 logs spindate — строка [admin-telegram]",
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ...base,
      error: e instanceof Error ? e.message : "fetch_failed",
    })
  }
}
