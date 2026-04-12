import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { createStarsInvoiceLink } from "@/lib/telegram-payments-api"
import { getTelegramStarsPack } from "@/lib/telegram-stars-pricing"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"

export async function POST(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const pack = getTelegramStarsPack(body?.packId)
  if (!pack) {
    return NextResponse.json({ ok: false, error: "Неизвестный пакет" }, { status: 400 })
  }

  const id = randomUUID()
  const payload = `spd:${id}`
  const db = getDb()
  const now = Date.now()

  if (auth.userId) {
    db.prepare(
      `INSERT INTO telegram_stars_pending (id, app_user_id, vk_user_id, hearts, stars, created_at) VALUES (?, ?, 0, ?, ?, ?)`,
    ).run(id, auth.userId, pack.hearts, pack.stars, now)
  } else {
    db.prepare(
      `INSERT INTO telegram_stars_pending (id, app_user_id, vk_user_id, hearts, stars, created_at) VALUES (?, NULL, ?, ?, ?, ?)`,
    ).run(id, auth.vkUserId, pack.hearts, pack.stars, now)
  }

  try {
    const invoiceUrl = await createStarsInvoiceLink({
      title: `${pack.hearts} ❤`,
      description: pack.description,
      payload,
      stars: pack.stars,
    })
    return NextResponse.json({ ok: true, invoiceUrl })
  } catch (e) {
    db.prepare(`DELETE FROM telegram_stars_pending WHERE id = ?`).run(id)
    console.warn("[telegram-stars/invoice]", e)
    return NextResponse.json({ ok: false, error: "Не удалось создать счёт" }, { status: 503 })
  }
}
