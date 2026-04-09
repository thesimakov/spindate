/**
 * Уведомления VK Mini App пользователям через API ВКонтакте.
 *
 * Документация:
 * - Запрос разрешения у пользователя: {@link https://dev.vk.com/bridge/VKWebAppAllowNotifications VKWebAppAllowNotifications}
 * - Настройка и ограничения в кабинете приложения:
 *   {@link https://dev.vk.com/mini-apps/management/notifications Уведомления мини-приложений}
 * - Отправка с сервера (сервисный ключ доступа из настроек приложения):
 *   {@link https://dev.vk.com/method/notifications.sendMessage notifications.sendMessage}
 *
 * Ограничения API (см. описание метода): обычно не более одного оповещения в сутки на пользователя,
 * получатель должен недавно запускать приложение и не отключить уведомления.
 */

import type { GameAction } from "@/lib/game-types"

const VK_API_VERSION = "5.199"

function getServiceToken(): string | undefined {
  const t = process.env.VK_SERVICE_ACCESS_TOKEN?.trim()
  return t || undefined
}

export type VkNotificationSendResult =
  | { ok: true; raw?: unknown }
  | { ok: false; reason: string; vkError?: unknown }

/**
 * Отправить оповещение от имени мини-приложения (ids — это VK user id, не внутренний id БД).
 */
export async function sendVkMiniAppNotifications(args: {
  vkUserIds: number[]
  message: string
  fragment?: string
}): Promise<VkNotificationSendResult> {
  const token = getServiceToken()
  if (!token) return { ok: false, reason: "missing_service_token" }

  const ids = [...new Set(args.vkUserIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) return { ok: false, reason: "no_recipients" }

  const message = args.message.trim().slice(0, 254)
  if (!message) return { ok: false, reason: "empty_message" }

  const body = new URLSearchParams({
    user_ids: ids.join(","),
    message,
    access_token: token,
    v: VK_API_VERSION,
  })
  const fragment = args.fragment?.trim()
  if (fragment) body.set("fragment", fragment.slice(0, 128))

  try {
    const res = await fetch("https://api.vk.com/method/notifications.sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const json = (await res.json().catch(() => null)) as {
      response?: { count?: number }
      error?: { error_code?: number; error_msg?: string }
    } | null
    if (!json) return { ok: false, reason: "invalid_json" }
    if (json.error) {
      return { ok: false, reason: json.error.error_msg ?? "vk_api_error", vkError: json.error }
    }
    return { ok: true, raw: json.response }
  } catch {
    return { ok: false, reason: "fetch_failed" }
  }
}

/** VK user id для уведомлений, если игрок связан с ВК. */
function vkNotifyUserId(player: { id: number; vkUserId?: number; authProvider?: string }): number | null {
  if (player.authProvider === "vk") {
    const v = player.vkUserId ?? player.id
    return Number.isInteger(v) && v > 0 ? v : null
  }
  if (typeof player.vkUserId === "number" && player.vkUserId > 0) return player.vkUserId
  return null
}

/**
 * Реакция на синхронизируемое событие стола: приглашение в личный чат.
 * Не блокирует ответ API; ошибки VK глушатся (лимиты/отключённые уведомления — норма).
 */
export function scheduleVkNotificationForTableAction(action: GameAction): void {
  if (action.type !== "ADD_LOG") return
  const entry = action.entry
  if (entry.type !== "invite" || !entry.toPlayer || !entry.fromPlayer) return
  const recipientVkId = vkNotifyUserId(entry.toPlayer)
  if (!recipientVkId) return

  const fromName = entry.fromPlayer.name?.trim() || "Игрок"
  const text = `${fromName} приглашает вас общаться в Крути и знакомься!`

  void sendVkMiniAppNotifications({
    vkUserIds: [recipientVkId],
    message: text,
    fragment: "player-chat",
  }).then((r) => {
    if (!r.ok && process.env.NODE_ENV === "development") {
      console.warn("[vk notifications]", r.reason, "vkError" in r ? r.vkError : "")
    }
  })
}
