/**
 * URL для платёжных уведомлений ВКонтакте.
 * Указывается в настройках мини-приложения: Платежи → Подключение.
 * Формат ответов и подпись — как в VK Payments API (обёртка `response` / `error`).
 * @see https://dev.vk.com/ru/mini-apps/settings/payments/setting-up
 * @see https://dev.vk.ru/ru/api/payments/notifications/overview
 */

import { NextRequest, NextResponse } from "next/server"
import { APP_BASE_PATH } from "@/lib/app-path"
import { payVotesForPack } from "@/lib/heart-shop-pricing"
import { verifyVkPaymentsSig } from "@/lib/vk-payments-sign"
import { getDb } from "@/lib/db"

/**
 * Защищённый ключ приложения (как в кабинете VK).
 * Приоритет:
 * 1) VK_PAYMENTS_SECRET / VK_MINI_APP_SECRET — явный ключ для callback /api/vk/payments
 * 2) VK_PAYMENT_SECRET — опечатка в старых инструкциях (без «S» в PAYMENTS)
 * 3) VK_SECRET_KEY / VK_APP_SECRET_KEY — обратная совместимость (уже используется в /api/payment/sign)
 */
function vkPaymentsSecretFromEnv(): string {
  const a = process.env.VK_PAYMENTS_SECRET?.trim()
  const b = process.env.VK_MINI_APP_SECRET?.trim()
  const typo = process.env.VK_PAYMENT_SECRET?.trim()
  const c = process.env.VK_SECRET_KEY?.trim()
  const d = process.env.VK_APP_SECRET_KEY?.trim()
  return a || b || typo || c || d || ""
}

/** Только флаги наличия — без значений, для логов при отсутствии секрета. */
function vkPaymentSecretEnvFlags() {
  return {
    VK_PAYMENTS_SECRET: Boolean(process.env.VK_PAYMENTS_SECRET?.trim()),
    VK_MINI_APP_SECRET: Boolean(process.env.VK_MINI_APP_SECRET?.trim()),
    VK_PAYMENT_SECRET: Boolean(process.env.VK_PAYMENT_SECRET?.trim()),
    VK_SECRET_KEY: Boolean(process.env.VK_SECRET_KEY?.trim()),
    VK_APP_SECRET_KEY: Boolean(process.env.VK_APP_SECRET_KEY?.trim()),
  }
}

const JSON_VK = { "Content-Type": "application/json; encoding=utf-8" } as const

/** Идентификаторы товаров (голоса ВКонтакте). Должны совпадать с `item` в VKWebAppOpenPayForm. */
const VK_PAYMENT_ITEMS = {
  hearts_12: { title: "12 сердец", price: payVotesForPack(12) },
  hearts_60: { title: "60 сердец", price: payVotesForPack(60) },
  hearts_150: { title: "150 сердец", price: payVotesForPack(150) },
  hearts_400: { title: "400 сердец", price: payVotesForPack(400) },
  hearts_1000: { title: "1000 сердец", price: payVotesForPack(1000) },
  hearts_2500: { title: "2500 сердец", price: payVotesForPack(2500) },
  hearts_7500: { title: "7500 сердец", price: payVotesForPack(7500) },
  vip_7d: { title: "VIP 7 дней", price: 15 },
  vip_30d: { title: "VIP 30 дней", price: 50 },
} as const

type ItemId = keyof typeof VK_PAYMENT_ITEMS

/** Диагностика без утечки секретов: не логируем `sig`, полные payload и id пользователей. */
function vkPaymentDiag(extra: Record<string, string | number | boolean | undefined>) {
  console.info("[vk/payments]", JSON.stringify({ ts: Date.now(), ...extra }))
}

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

/** Публичный HTTPS URL картинки товара для get_item (VK ожидает `photo_url`). */
function vkPaymentItemPhotoUrl(itemKey: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")
  const fallbackOrigin = "https://spindate.lemnity.ru"
  const origin = base || fallbackOrigin
  const m = /^hearts_(\d+)$/i.exec(itemKey)
  const path = m
    ? `${APP_BASE_PATH}/assets/${m[1]}.svg`
    : `${APP_BASE_PATH}/favicon.svg`
  return `${origin}${path}`
}

/** get_item — информация о товаре; в запросе поле `item` (как передал клиент). */
function handleGetItem(itemKey: string, isTest: boolean): NextResponse {
  const item = itemKey && VK_PAYMENT_ITEMS[itemKey as ItemId]
  if (!item) {
    vkPaymentDiag({
      phase: "get_item",
      outcome: "unknown_product",
      item: itemKey ? itemKey.slice(0, 96) : "",
    })
    return vkError(20, "Product does not exist", true)
  }
  const title = isTest ? `${item.title} (тестовый режим)` : item.title
  vkPaymentDiag({
    phase: "get_item",
    outcome: "ok",
    item: itemKey.slice(0, 96),
    price: item.price,
    test: isTest,
  })
  return vkJson({
    response: {
      title,
      price: item.price,
      item_id: itemKey,
      photo_url: vkPaymentItemPhotoUrl(itemKey),
    },
  })
}

/** order_status_change — подтверждение обработки заказа; в ответе — order_id (число). */
function parseVkUserId(params: URLSearchParams): number | null {
  const raw =
    params.get("user_id") ??
    params.get("receiver_id") ??
    params.get("vk_user_id") ??
    params.get("uid") ??
    ""
  const id = Number.parseInt(String(raw), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

function heartsByItem(itemKey: string): number {
  const m = /^hearts_(\d+)$/i.exec(itemKey)
  if (m) {
    const n = Number.parseInt(m[1], 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return 0
}

function vipDaysByItem(itemKey: string): number {
  if (itemKey === "vip_7d") return 7
  if (itemKey === "vip_30d") return 30
  return 0
}

function grantVipByVkUser(vkUserId: number, days: number): void {
  if (days <= 0) return
  const db = getDb()
  const now = Date.now()
  const ms = days * 24 * 60 * 60 * 1000

  const linkedUser = db
    .prepare(`SELECT id FROM users WHERE vk_user_id = ?`)
    .get(vkUserId) as { id: string } | undefined

  const userId = linkedUser?.id
  if (!userId) return

  const existing = db
    .prepare(`SELECT vip_until FROM user_game_state WHERE user_id = ?`)
    .get(userId) as { vip_until: number | null } | undefined

  const base = Math.max(existing?.vip_until ?? 0, now)
  const newUntil = base + ms

  db.prepare(
    `UPDATE user_game_state SET vip_until = ?, updated_at = ? WHERE user_id = ?`,
  ).run(newUntil, now, userId)
}

function isGrantableOrderStatus(statusRaw: string): boolean {
  const s = statusRaw.trim().toLowerCase()
  if (!s) return true
  return s === "chargeable" || s === "success" || s === "paid" || s === "charged"
}

function grantHeartsByVkUser(vkUserId: number, hearts: number): void {
  if (hearts <= 0) return
  const db = getDb()
  const now = Date.now()

  const linkedUser = db
    .prepare(`SELECT id FROM users WHERE vk_user_id = ?`)
    .get(vkUserId) as { id: string } | undefined

  if (linkedUser?.id) {
    db.prepare(
      `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
       VALUES (?, ?, '[]', ?)
       ON CONFLICT(user_id) DO UPDATE SET
         voice_balance = user_game_state.voice_balance + excluded.voice_balance,
         updated_at = excluded.updated_at`,
    ).run(linkedUser.id, hearts, now)
    return
  }

  db.prepare(
    `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at)
     VALUES (?, ?, '[]', ?)
     ON CONFLICT(vk_user_id) DO UPDATE SET
       voice_balance = vk_user_game_state.voice_balance + excluded.voice_balance,
       updated_at = excluded.updated_at`,
  ).run(vkUserId, hearts, now)
}

function handleOrderStatusChange(params: URLSearchParams, orderIdRaw: string, itemKey: string): NextResponse {
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

  const vkUserId = parseVkUserId(params)
  if (!vkUserId) {
    return vkError(11, "Missing user_id", true)
  }

  const paymentStatus = String(params.get("status") ?? params.get("order_status") ?? "")
  const grantable = isGrantableOrderStatus(paymentStatus)
  vkPaymentDiag({
    phase: "order_status_change",
    order_id: orderId,
    item: itemKey.slice(0, 96),
    grantable,
    status: paymentStatus ? paymentStatus.slice(0, 48) : "(empty)",
  })
  const now = Date.now()
  const providerOrderId = String(orderId)
  const notificationType = String(params.get("notification_type") ?? "order_status_change")
  const payloadJson = JSON.stringify(Object.fromEntries(params.entries()))
  const db = getDb()

  const tx = db.transaction(() => {
    const exists = db
      .prepare(`SELECT processed FROM vk_payment_orders WHERE provider_order_id = ?`)
      .get(providerOrderId) as { processed: number } | undefined
    if (exists?.processed === 1) return

    db.prepare(
      `INSERT INTO vk_payment_orders (
         provider_order_id, vk_user_id, item_id, notification_type, status, processed, payload_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(provider_order_id) DO UPDATE SET
         vk_user_id = excluded.vk_user_id,
         item_id = excluded.item_id,
         notification_type = excluded.notification_type,
         status = excluded.status,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
    ).run(providerOrderId, vkUserId, itemKey, notificationType, paymentStatus || null, payloadJson, now, now)

    if (grantable) {
      const hearts = heartsByItem(itemKey)
      if (hearts > 0) {
        grantHeartsByVkUser(vkUserId, hearts)
      }
      const vipDays = vipDaysByItem(itemKey)
      if (vipDays > 0) {
        grantVipByVkUser(vkUserId, vipDays)
      }
      db.prepare(
        `UPDATE vk_payment_orders
         SET processed = 1, updated_at = ?
         WHERE provider_order_id = ?`,
      ).run(Date.now(), providerOrderId)
    }
  })

  tx()

  return vkJson({ response: { order_id: orderId } })
}

export async function POST(req: NextRequest) {
  try {
    const params = await bodyToUrlParams(req)
    const sig = params.get("sig") ?? undefined
    const VK_PAYMENTS_SECRET = vkPaymentsSecretFromEnv()

    if (!VK_PAYMENTS_SECRET) {
      console.error(
        "[vk/payments] Payment secret not configured — env flags (true = set, length hidden):",
        JSON.stringify(vkPaymentSecretEnvFlags()),
      )
      return vkError(10, "Payment secret not configured", true)
    }
    if (!verifyVkPaymentsSig(params, sig, VK_PAYMENTS_SECRET)) {
      vkPaymentDiag({
        phase: "reject",
        reason: "invalid_signature",
        notification_type: String(params.get("notification_type") ?? "").slice(0, 64),
      })
      return vkError(10, "The calculated and sent signatures do not match", true)
    }

    const notificationType = String(params.get("notification_type") ?? "")
    const baseType = normalizeNotificationType(notificationType)
    const itemParam = String(params.get("item") ?? params.get("item_id") ?? "").slice(0, 96)
    vkPaymentDiag({
      phase: "inbound",
      notification_type: notificationType.slice(0, 80),
      base_type: baseType.slice(0, 64),
      item: itemParam,
      order_id_present: Boolean(String(params.get("order_id") ?? "").length),
    })

    if (baseType === "get_item") {
      const itemKey = String(params.get("item") ?? params.get("item_id") ?? "")
      const isTest = /_test$/i.test(notificationType)
      return handleGetItem(itemKey, isTest)
    }

    if (baseType === "order_status_change") {
      const orderId = String(params.get("order_id") ?? "")
      const itemKey = String(params.get("item_id") ?? params.get("item") ?? "")
      return handleOrderStatusChange(params, orderId, itemKey)
    }

    vkPaymentDiag({
      phase: "reject",
      reason: "unknown_notification_type",
      notification_type: notificationType.slice(0, 80),
    })
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
