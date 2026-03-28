/**
 * URL для платёжных уведомлений ВКонтакте.
 * Указывается в настройках мини-приложения: Платежи → Подключение.
 * Формат ответов и подпись — как в VK Payments API (обёртка `response` / `error`).
 * @see https://dev.vk.com/ru/mini-apps/settings/payments/setting-up
 * @see https://dev.vk.ru/ru/api/payments/notifications/overview
 */

import { NextRequest, NextResponse } from "next/server"
import { payVotesForPack } from "@/lib/heart-shop-pricing"
import { verifyVkPaymentsSig } from "@/lib/vk-payments-sign"

/** Защищённый ключ приложения (совпадает с полем в настройках VK). Обязателен для проверки sig в продакшене. */
const VK_PAYMENTS_SECRET = process.env.VK_PAYMENTS_SECRET ?? ""

const JSON_VK = { "Content-Type": "application/json; encoding=utf-8" } as const

/** Идентификаторы товаров (голоса ВКонтакте). Должны совпадать с `item` в VKWebAppOpenPayForm. */
const VK_PAYMENT_ITEMS = {
  hearts_5: { title: "5 сердец", price: payVotesForPack(5) },
  hearts_50: { title: "50 сердец", price: payVotesForPack(50) },
  hearts_150: { title: "150 сердец", price: payVotesForPack(150) },
  hearts_500: { title: "500 сердец", price: payVotesForPack(500) },
  hearts_1000: { title: "1000 сердец", price: payVotesForPack(1000) },
  hearts_5000: { title: "5000 сердец", price: payVotesForPack(5000) },
  vip_7d: { title: "VIP 7 дней", price: 20 },
  vip_30d: { title: "VIP 30 дней", price: 70 },
} as const

type ItemId = keyof typeof VK_PAYMENT_ITEMS

function vkJson(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), { status, headers: JSON_VK })
}

/** Ошибка по спецификации VK (коды 1–999 — на стороне приложения). */
function vkError(code: number, msg: string, critical: boolean) {
  return vkJson({ error: { error_code: code, error_msg: msg, critical } })
}

async function bodyToUrlParams(req: NextRequest): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    const raw = await req.json().catch(() => ({}))
    const p = new URLSearchParams()
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v == null) continue
        if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x)))
        else p.append(k, String(v))
      }
    }
    return p
  }
  const text = await req.text()
  return new URLSearchParams(text)
}

function normalizeNotificationType(t: string): string {
  return t.replace(/_test$/i, "")
}

/** get_item — информация о товаре; в запросе поле `item` (как передал клиент). */
function handleGetItem(itemKey: string): NextResponse {
  const item = itemKey && VK_PAYMENT_ITEMS[itemKey as ItemId]
  if (!item) {
    return vkError(20, "Product does not exist", true)
  }
  return vkJson({
    response: {
      title: item.title,
      price: item.price,
      item_id: itemKey,
    },
  })
}

/** order_status_change — подтверждение обработки заказа; в ответе — order_id (число). */
function handleOrderStatusChange(orderIdRaw: string, itemKey: string): NextResponse {
  const orderId = Number.parseInt(orderIdRaw, 10)
  if (!orderIdRaw || Number.isNaN(orderId)) {
    return vkError(11, "Invalid order_id", true)
  }
  if (!itemKey) {
    return vkError(11, "Missing item", true)
  }
  const item = VK_PAYMENT_ITEMS[itemKey as ItemId]
  if (!item) {
    return vkError(20, "Product does not exist", true)
  }
  return vkJson({ response: { order_id: orderId } })
}

export async function POST(req: NextRequest) {
  try {
    const params = await bodyToUrlParams(req)
    const sig = params.get("sig") ?? undefined

    if (VK_PAYMENTS_SECRET) {
      if (!verifyVkPaymentsSig(params, sig, VK_PAYMENTS_SECRET)) {
        return vkError(10, "The calculated and sent signatures do not match", true)
      }
    }

    const notificationType = String(params.get("notification_type") ?? "")
    const baseType = normalizeNotificationType(notificationType)

    if (baseType === "get_item") {
      const itemKey = String(params.get("item") ?? params.get("item_id") ?? "")
      return handleGetItem(itemKey)
    }

    if (baseType === "order_status_change") {
      const orderId = String(params.get("order_id") ?? "")
      const itemKey = String(params.get("item_id") ?? params.get("item") ?? "")
      return handleOrderStatusChange(orderId, itemKey)
    }

    return vkError(1, `${notificationType || "empty"} not processed`, true)
  } catch (e) {
    console.error("[vk/payments]", e)
    return vkError(2, "internal_error", false)
  }
}

/** GET — проверка доступности URL (мониторинг); не часть API VK. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "vk-payments" })
}
