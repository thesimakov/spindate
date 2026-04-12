import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { answerPreCheckoutQueryError, answerPreCheckoutQueryOk } from "@/lib/telegram-payments-api"

type SuccessfulPayment = {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_PAYMENTS_WEBHOOK_SECRET?.trim()
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? ""
  if (!secret || header !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = (await req.json()) as {
    pre_checkout_query?: { id: string; invoice_payload: string }
    message?: { successful_payment?: SuccessfulPayment }
  }

  const db = getDb()

  if (update.pre_checkout_query) {
    const raw = update.pre_checkout_query.invoice_payload
    const id = typeof raw === "string" && raw.startsWith("spd:") ? raw.slice(4) : ""
    const row = id
      ? (db.prepare(`SELECT id FROM telegram_stars_pending WHERE id = ?`).get(id) as { id: string } | undefined)
      : undefined
    if (!row) {
      await answerPreCheckoutQueryError(update.pre_checkout_query.id, "Заказ не найден")
      return NextResponse.json({ ok: true })
    }
    await answerPreCheckoutQueryOk(update.pre_checkout_query.id)
    return NextResponse.json({ ok: true })
  }

  const sp = update.message?.successful_payment
  if (sp && sp.currency === "XTR") {
    const raw = sp.invoice_payload
    const id = typeof raw === "string" && raw.startsWith("spd:") ? raw.slice(4) : ""
    const chargeId = sp.telegram_payment_charge_id
    if (id && chargeId) {
      const dup = db.prepare(`SELECT charge_id FROM telegram_stars_payments WHERE charge_id = ?`).get(chargeId) as
        | { charge_id: string }
        | undefined
      if (dup) {
        return NextResponse.json({ ok: true })
      }
      const row = db
        .prepare(`SELECT id, app_user_id, vk_user_id, hearts, stars FROM telegram_stars_pending WHERE id = ?`)
        .get(id) as
        | { id: string; app_user_id: string | null; vk_user_id: number; hearts: number; stars: number }
        | undefined
      const now = Date.now()
      if (row) {
        db.prepare(`DELETE FROM telegram_stars_pending WHERE id = ?`).run(id)
        db.prepare(
          `INSERT INTO telegram_stars_payments (charge_id, app_user_id, vk_user_id, hearts, stars, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(chargeId, row.app_user_id, row.vk_user_id, row.hearts, row.stars, now)
        if (row.app_user_id) {
          db.prepare(
            `UPDATE user_game_state SET voice_balance = voice_balance + ?, updated_at = ? WHERE user_id = ?`,
          ).run(row.hearts, now, row.app_user_id)
        } else if (row.vk_user_id > 0) {
          db.prepare(
            `UPDATE vk_user_game_state SET voice_balance = voice_balance + ?, updated_at = ? WHERE vk_user_id = ?`,
          ).run(row.hearts, now, row.vk_user_id)
        }
      } else {
        console.warn("[telegram-stars/webhook] successful_payment без pending:", chargeId)
      }
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
