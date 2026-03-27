"use client"

import { payVotesForPack } from "@/lib/heart-shop-pricing"

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

/** Максимальная высота iframe по документации VK Mini Apps (ограничение платформы). */
const VK_IFRAME_MAX_HEIGHT = 4050

/** Размер видимой области для передачи в VKWebAppResizeWindow (вкладка / окно / visualViewport). */
export function getViewportSizeForVk(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 800, height: 600 }
  const vv = window.visualViewport
  const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth))
  const rawH = vv?.height ?? window.innerHeight
  const h = Math.max(1, Math.min(Math.round(rawH), VK_IFRAME_MAX_HEIGHT))
  return { width: w, height: h }
}

/**
 * Подгоняет размер iframe мини-приложения под текущее окно вкладки/браузера.
 * На части мобильных клиентов метод может быть недоступен — ошибка игнорируется.
 * @see https://dev.vk.com/bridge/VKWebAppResizeWindow
 */
export async function resizeVkWindowToViewport(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !isVkMiniApp()) return false
  const { width, height } = getViewportSizeForVk()
  try {
    await b.send("VKWebAppResizeWindow", { width, height })
    return true
  } catch {
    return false
  }
}

const RESIZE_DEBOUNCE_MS = 120

/**
 * Повторно вызывает resize при изменении окна, вкладки или visualViewport (адресная строка на мобильных).
 * Верните функцию отписки при размонтировании корневого компонента.
 */
export function subscribeVkViewportResize(): () => void {
  if (typeof window === "undefined") return () => {}
  let timer: ReturnType<typeof setTimeout> | null = null
  const run = () => {
    void resizeVkWindowToViewport()
  }
  const schedule = () => {
    if (timer != null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      run()
    }, RESIZE_DEBOUNCE_MS)
  }
  window.addEventListener("resize", schedule)
  window.addEventListener("orientationchange", schedule)
  window.visualViewport?.addEventListener("resize", schedule)
  window.visualViewport?.addEventListener("scroll", schedule)
  return () => {
    if (timer != null) clearTimeout(timer)
    window.removeEventListener("resize", schedule)
    window.removeEventListener("orientationchange", schedule)
    window.visualViewport?.removeEventListener("resize", schedule)
    window.visualViewport?.removeEventListener("scroll", schedule)
  }
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
    id: 500000 + Math.floor(Math.random() * 500000),
    first_name: "Пользователь",
    last_name: "VK",
    photo_200: "https://api.dicebear.com/9.x/adventurer/svg?seed=Player",
    sex: 2,
  }
}

/** Идентификаторы товаров для VK Pay (должны совпадать с app/api/vk/payments). */
export const VK_ITEM_IDS = {
  hearts_5: "hearts_5",
  hearts_50: "hearts_50",
  hearts_150: "hearts_150",
  hearts_500: "hearts_500",
  hearts_1000: "hearts_1000",
  hearts_5000: "hearts_5000",
  vip_7d: "vip_7d",
  vip_30d: "vip_30d",
} as const

/** Показать форму оплаты VK. amount — сумма (по курсу VK: 1 голос = 1 сердце); itemId — для платёжных уведомлений (get_item, order_status_change). */
export async function showPaymentWall(amount: number, itemId?: string): Promise<boolean> {
  const b = await getBridgeAsync()
  let appId: number | undefined
  try {
    appId = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_VK_APP_ID
      ? Number(process.env.NEXT_PUBLIC_VK_APP_ID)
      : undefined
  } catch {
    appId = undefined
  }
  if (b && isVkMiniApp() && appId) {
    try {
      const params: Record<string, string> = {
        amount: String(amount),
        description: "Пополнение сердечек",
      }
      if (itemId) params.item = itemId
      const res = await b.send("VKWebAppOpenPayForm", {
        app_id: appId,
        action: "pay-to-service",
        params,
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

/** Покупка пака сердец (500). Для уведомлений VK вызывает get_item/order_status_change на сервер. */
export async function buyHearts500(): Promise<boolean> {
  return showPaymentWall(payVotesForPack(500), VK_ITEM_IDS.hearts_500)
}

/** Покупка пака сердец (1000). */
export async function buyHearts1000(): Promise<boolean> {
  return showPaymentWall(payVotesForPack(1000), VK_ITEM_IDS.hearts_1000)
}

/** Покупка VIP (оплата через VK, курс: 1 голос = 1 сердце). */
export async function buyVip(): Promise<boolean> {
  return showPaymentWall(70, VK_ITEM_IDS.vip_30d)
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
  buyHearts500,
  buyHearts1000,
  buyVip,
  inviteFriends,
  initVk,
  isVkMiniApp,
  getViewportSizeForVk,
  resizeVkWindowToViewport,
  subscribeVkViewportResize,
  VK_ITEM_IDS,
}
