"use client"

/**
 * Обёртка над VK Bridge для мини-приложения ВКонтакте.
 * В iframe/клиенте VK использует реальный bridge; вне VK — заглушки для разработки.
 */

export type VkUserInfo = {
  id: number
  first_name: string
  last_name: string
  photo_200: string
  sex?: 1 | 2 // 1 — женский, 2 — мужской
}

type Bridge = { send: (method: string, params?: object) => Promise<unknown>; isEmbedded?: () => boolean }

let bridgeInstance: Bridge | null = null
let bridgePromise: Promise<Bridge | null> | null = null

async function getBridgeAsync(): Promise<Bridge | null> {
  if (typeof window === "undefined") return null
  if (bridgeInstance) return bridgeInstance
  if (bridgePromise) return bridgePromise
  bridgePromise = (async () => {
    try {
      const m = await import("@vkontakte/vk-bridge")
      bridgeInstance = (m.default ?? m) as Bridge
      return bridgeInstance
    } catch {
      return null
    }
  })()
  return bridgePromise
}

/** Запущено ли приложение внутри VK Mini App (iframe/клиент). */
export function isVkMiniApp(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.has("vk_user_id") || params.has("vk_app_id")
}

/** Инициализация VK Mini App (вызвать при загрузке в VK). */
export async function initVk(): Promise<void> {
  const b = await getBridgeAsync()
  if (!b) return
  try {
    await b.send("VKWebAppInit", {})
  } catch {
    // вне VK или старая версия клиента
  }
}

/** Получить данные пользователя VK. */
export async function getUserInfo(): Promise<VkUserInfo> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      const data = await b.send("VKWebAppGetUserInfo", {})
      const d = data as { id: number; first_name: string; last_name: string; photo_200: string; sex?: 1 | 2 }
      return {
        id: d.id,
        first_name: d.first_name ?? "",
        last_name: d.last_name ?? "",
        photo_200: d.photo_200 ?? "",
        sex: d.sex,
      }
    } catch (e) {
      console.warn("VKWebAppGetUserInfo failed", e)
    }
  }
  return {
    id: Math.floor(Math.random() * 100000) + 1,
    first_name: "Пользователь",
    last_name: "VK",
    photo_200: "https://api.dicebear.com/9.x/adventurer/svg?seed=Player",
    sex: 2,
  }
}

/** Показать форму оплаты VK (голоса/рубли). amount — сумма в голосах. */
export async function showPaymentWall(amount: number): Promise<boolean> {
  const b = await getBridgeAsync()
  const appId = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_VK_APP_ID
    ? Number(process.env.NEXT_PUBLIC_VK_APP_ID)
    : undefined
  if (b && isVkMiniApp() && appId) {
    try {
      const res = await b.send("VKWebAppOpenPayForm", {
        app_id: appId,
        action: "pay-to-service",
        params: {
          amount: String(amount),
          description: `Покупка за ${amount} голосов`,
        },
      })
      const r = res as { result?: { success?: boolean }; success?: boolean }
      return r?.result?.success === true || r?.success === true
    } catch (e) {
      console.warn("VKWebAppOpenPayForm failed", e)
      return false
    }
  }
  return new Promise((resolve) => setTimeout(() => resolve(true), 500))
}

/** Покупка VIP (отдельный товар в VK Pay при необходимости). */
export async function buyVip(): Promise<boolean> {
  return showPaymentWall(99)
}

/** Показать диалог приглашения друзей в приложение. */
export async function inviteFriends(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      await b.send("VKWebAppShowInviteBox", {})
      return true
    } catch (e) {
      console.warn("VKWebAppShowInviteBox failed", e)
      return false
    }
  }
  return new Promise((resolve) => setTimeout(() => resolve(true), 300))
}

export const vkBridge = {
  getUserInfo,
  showPaymentWall,
  buyVip,
  inviteFriends,
  initVk,
  isVkMiniApp,
}
