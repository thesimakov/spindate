/**
 * URL для платёжных уведомлений ВКонтакте.
 * Указывается в настройках мини-приложения: Платежи → Подключение.
 * @see https://dev.vk.com/ru/mini-apps/settings/payments/setting-up
 */

import { NextRequest, NextResponse } from "next/server"

/** Идентификаторы товаров (голоса ВКонтакте). Должны совпадать с item_id при открытии формы оплаты. */
const VK_PAYMENT_ITEMS = {
  hearts_5: { title: "5 сердец", price: 1, description: "Пополнение сердец для игры" },
  hearts_50: { title: "50 сердец", price: 3, description: "Пополнение сердец для игры" },
  hearts_150: { title: "150 сердец", price: 9, description: "Пополнение сердец для игры" },
  hearts_500: { title: "500 сердец", price: 25, description: "Пополнение сердец для игры" },
  hearts_1000: { title: "1000 сердец", price: 60, description: "Пополнение сердец для игры" },
  hearts_5000: { title: "5000 сердец", price: 300, description: "Пополнение сердец для игры" },
  vip_7d: { title: "VIP 7 дней", price: 20, description: "VIP-подписка на 7 дней" },
  vip_30d: { title: "VIP 30 дней", price: 70, description: "VIP-подписка на 30 дней" },
} as const

type ItemId = keyof typeof VK_PAYMENT_ITEMS

function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) return req.json().catch(() => ({}))
  return req.formData().then((fd) => Object.fromEntries(fd.entries())) as Promise<Record<string, unknown>>
}

/** get_item — запрос информации о товаре. Платформа вызывает при показе формы оплаты. */
function handleGetItem(itemId: string): NextResponse {
  const item = itemId && VK_PAYMENT_ITEMS[itemId as ItemId]
  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 })
  }
  return NextResponse.json({
    title: item.title,
    price: item.price,
    description: item.description,
  })
}

/** order_status_change — уведомление об изменении статуса заказа (оплата/возврат). */
function handleOrderStatusChange(
  orderId: string,
  itemId: string,
  status: string,
  _userId: string,
): NextResponse {
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }
  const item = VK_PAYMENT_ITEMS[itemId as ItemId]
  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 })
  }
  if (status === "chargeable" || status === "paid" || status === "confirmed") {
    return NextResponse.json({ order_id: orderId, success: 1 })
  }
  if (status === "cancelled" || status === "refunded") {
    return NextResponse.json({ order_id: orderId, success: 1 })
  }
  return NextResponse.json({ order_id: orderId, success: 1 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req)
    const notificationType = String(body?.notification_type ?? body?.type ?? "")

    if (notificationType === "get_item") {
      const itemId = String(body?.item_id ?? body?.item ?? "")
      return handleGetItem(itemId)
    }

    if (notificationType === "order_status_change") {
      const orderId = String(body?.order_id ?? body?.order ?? "")
      const itemId = String(body?.item_id ?? body?.item ?? "")
      const status = String(body?.status ?? "")
      const userId = String(body?.user_id ?? body?.receiver_id ?? "")
      return handleOrderStatusChange(orderId, itemId, status, userId)
    }

    return NextResponse.json({ error: "unknown_notification_type" }, { status: 400 })
  } catch (e) {
    console.error("[vk/payments]", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
