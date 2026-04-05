"use client"

import { payVotesForPack } from "@/lib/heart-shop-pricing"
import { appPath } from "@/lib/app-path"

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
  bdate?: string // "D.M.YYYY" или "D.M"
  city?: { id: number; title: string }
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

function locationHasVkMiniParams(searchOrHash: string): boolean {
  return /[?&#]vk_user_id=/.test(searchOrHash) || /[?&#]vk_app_id=/.test(searchOrHash)
}

/**
 * Строка query с подписанными параметрами запуска VK (search или фрагмент URL).
 * Не вызывает bridge — только адресная строка.
 */
export function getVkLaunchSearchFromLocation(): string {
  if (typeof window === "undefined") return ""
  const search = window.location.search
  if (search.includes("vk_user_id=") && search.includes("sign=")) return search
  const hash = window.location.hash.slice(1)
  if (!hash) return search
  let fromHash = ""
  const q = hash.indexOf("?")
  if (q >= 0) fromHash = hash.slice(q)
  else if (/^vk_\w+=/.test(hash) || /&vk_\w+=/.test(hash)) fromHash = `?${hash}`
  if (fromHash.includes("vk_user_id=") && fromHash.includes("sign=")) return fromHash
  return search || fromHash
}

function serializeVkLaunchParamsFromBridge(data: Record<string, unknown>): string {
  const vkPairs: { key: string; value: string }[] = []
  let sign = ""
  for (const [key, val] of Object.entries(data)) {
    if (key === "sign" && typeof val === "string") {
      sign = val
      continue
    }
    if (!key.startsWith("vk_")) continue
    if (val === undefined || val === null) continue
    vkPairs.push({ key, value: String(val) })
  }
  if (!sign || vkPairs.length === 0) return ""
  vkPairs.sort((a, b) => a.key.localeCompare(b.key))
  const qs = vkPairs.map(({ key, value }) => `${key}=${encodeURIComponent(value)}`).join("&")
  return `?${qs}&sign=${encodeURIComponent(sign)}`
}

/**
 * Полная строка параметров запуска для POST /api/auth/vk: из URL или VKWebAppGetLaunchParams.
 * Вызывать после initVk().
 */
function unwrapVkLaunchParamsPayload(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.sign === "string" && o.vk_user_id != null) return o
  const inner = o.data
  if (inner != null && typeof inner === "object") {
    const d = inner as Record<string, unknown>
    if (typeof d.sign === "string" && d.vk_user_id != null) return d
  }
  return null
}

export async function ensureVkLaunchSearch(): Promise<string> {
  if (typeof window === "undefined") return ""
  const fromLoc = getVkLaunchSearchFromLocation()
  if (fromLoc.includes("vk_user_id=") && fromLoc.includes("sign=")) return fromLoc
  const b = await getBridgeAsync()
  if (!b) return fromLoc
  /** Часть WebView ВК не отвечает на GetLaunchParams — не блокируем вход бесконечно. */
  const BRIDGE_GET_LAUNCH_TIMEOUT_MS = 8000
  try {
    const raw = await Promise.race([
      b.send("VKWebAppGetLaunchParams", {}),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), BRIDGE_GET_LAUNCH_TIMEOUT_MS),
      ),
    ])
    if (raw === "timeout") return fromLoc
    const payload = unwrapVkLaunchParamsPayload(raw)
    if (payload) {
      const ser = serializeVkLaunchParamsFromBridge(payload)
      if (ser) return ser
    }
  } catch {
    // вне VK или метод недоступен
  }
  return fromLoc
}

/**
 * Как {@link ensureVkLaunchSearch}, но если подписи ещё нет в URL — один проход bridge,
 * затем короткий опрос адресной строки (часть клиентов ВК дописывает hash после первого кадра).
 */
export async function ensureVkLaunchSearchResilient(): Promise<string> {
  if (typeof window === "undefined") return ""

  const immediate = getVkLaunchSearchFromLocation()
  if (immediate.includes("vk_user_id=") && immediate.includes("sign=")) return immediate

  const once = await ensureVkLaunchSearch()
  if (once.includes("vk_user_id=") && once.includes("sign=")) return once

  const POLL_MS = 400
  const POLL_ATTEMPTS = 28

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS))
    const loc = getVkLaunchSearchFromLocation()
    if (loc.includes("vk_user_id=") && loc.includes("sign=")) return loc
  }

  return getVkLaunchSearchFromLocation() || once
}

/** Запущено ли приложение внутри VK Mini App (iframe/клиент). */
export function isVkMiniApp(): boolean {
  if (typeof window === "undefined") return false
  const search = window.location.search
  const hash = window.location.hash
  if (locationHasVkMiniParams(search) || locationHasVkMiniParams(hash)) return true
  if (/(^|[?&])vk_platform=/.test(search)) return true
  try {
    const r = document.referrer || ""
    if (/\/\/(m\.)?vk\.(com|ru)\//i.test(r)) return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Мини-приложение ВК: query/referrer или встроенный WebView (у части клиентов в iframe нет vk_* в URL дочернего окна).
 */
export async function isVkRuntimeEnvironment(): Promise<boolean> {
  if (isVkMiniApp()) return true
  const b = await getBridgeAsync()
  if (!b) return false
  try {
    if (typeof b.isEmbedded === "function" && b.isEmbedded()) return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Просим ВК развернуть мини-приложение до максимально доступной области.
 * В части клиентов помогает убрать боковые поля/ограничения контейнера.
 * @see https://dev.vk.com/bridge/VKWebAppExpand
 */
export async function requestVkExpand(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !isVkMiniApp()) return false
  try {
    await b.send("VKWebAppExpand", {})
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
    void requestVkExpand()
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

/**
 * Запрос широкоформатного режима через VKWebAppSetViewSettings.
 * Устанавливает status_bar_style для максимальной ширины iframe.
 */
export async function requestVkWidescreen(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !isVkMiniApp()) return false
  try {
    await b.send("VKWebAppSetViewSettings", {
      status_bar_style: "dark",
      action_bar_color: "#0f172a",
      navigation_bar_color: "#0f172a",
    })
    return true
  } catch {
    return false
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
  await requestVkExpand()
  await requestVkWidescreen()
}

const VK_INIT_TIMEOUT_MS = 8000

/**
 * То же, что initVk, но не ждёт дольше VK_INIT_TIMEOUT_MS.
 * В части клиентов ВК promise VKWebAppInit не завершается — иначе не доходят до /api/auth/me.
 */
export async function initVkResilient(): Promise<void> {
  await Promise.race([
    initVk(),
    new Promise<void>((resolve) => setTimeout(resolve, VK_INIT_TIMEOUT_MS)),
  ])
}

/** Получить данные пользователя VK. */
export async function getUserInfo(): Promise<VkUserInfo> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      const data = await b.send("VKWebAppGetUserInfo", {})
      const d = data as {
        id: number; first_name: string; last_name: string; photo_200: string
        sex?: 1 | 2; bdate?: string; city?: { id: number; title: string }
      }
      return {
        id: d.id,
        first_name: d.first_name ?? "",
        last_name: d.last_name ?? "",
        photo_200: d.photo_200 ?? "",
        sex: d.sex,
        bdate: d.bdate,
        city: d.city,
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

/** App ID из env — используется для оплаты и других bridge-вызовов, требующих app_id */
function getVkAppId(): number | undefined {
  try {
    const raw = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_VK_APP_ID : undefined
    if (raw) {
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
  } catch { /* ignore */ }
  return undefined
}

/** Идентификаторы товаров для VK Pay (должны совпадать с app/api/vk/payments). */
export const VK_ITEM_IDS = {
  hearts_5: "hearts_5",
  hearts_50: "hearts_50",
  hearts_150: "hearts_150",
  hearts_200: "hearts_200",
  hearts_500: "hearts_500",
  hearts_1000: "hearts_1000",
  hearts_5000: "hearts_5000",
  vip_7d: "vip_7d",
  vip_30d: "vip_30d",
} as const

export type ShowPaymentWallOptions = {
  /** id пользователя ВК (строка) — для подписи заказа на сервере */
  userId?: string
  description?: string
}

function vkPayResultOk(res: unknown): boolean {
  if (typeof res === "boolean") return res
  if (res && typeof res === "object") {
    const o = res as { success?: boolean; result?: unknown }
    if (o.success === true) return true
    const inner = o.result
    if (inner && typeof inner === "object") {
      const r = inner as { success?: boolean; status?: boolean }
      if (r.success === true || r.status === true) return true
    }
  }
  return false
}

/**
 * Оплата голосами VK: сначала {@link https://dev.vk.com/bridge/VKWebAppShowOrderBox виртуальный товар},
 * затем при необходимости — {@link https://dev.vk.com/bridge/VKWebAppOpenPayForm pay-to-service} с подписью `/api/payment/sign` (как в rps-vk-game).
 *
 * @param amount — сумма в голосах VK
 * @param itemId — id товара в каталоге приложения (get_item)
 */
export async function showPaymentWall(
  amount: number,
  itemId?: string,
  options?: ShowPaymentWallOptions,
): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Promise((resolve) => setTimeout(() => resolve(true), 300))
  }

  const b = await getBridgeAsync()
  const description = options?.description ?? "Пополнение сердечек"
  const userId = options?.userId ?? ""

  if (!b || !isVkMiniApp()) {
    return new Promise((resolve) => setTimeout(() => resolve(true), 500))
  }

  try {
    await b.send("VKWebAppInit", {})
  } catch {
    /* ignore */
  }

  if (itemId) {
    try {
      const result = await b.send("VKWebAppShowOrderBox", {
        type: "item",
        item: itemId,
      })
      if (vkPayResultOk(result)) return true
      if (typeof result === "boolean" && result) return true
    } catch (e) {
      console.warn("[VK] VKWebAppShowOrderBox", e)
    }
  }

  const appId = getVkAppId()
  if (!appId) {
    console.warn("[VK] NEXT_PUBLIC_VK_APP_ID не задан — оплата голосами недоступна")
    return false
  }

  try {
    const signRes = await fetch(appPath("/api/payment/sign"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        userId,
        description,
        currency: "votes",
      }),
    })
    if (!signRes.ok) {
      console.warn("[VK] /api/payment/sign", signRes.status)
      return false
    }
    const signData = (await signRes.json()) as {
      ok?: boolean
      app_id?: number
      order_id?: string
      sign?: string
    }
    if (!signData.ok || !signData.app_id || !signData.order_id || !signData.sign) {
      console.warn("[VK] неверный ответ подписи", signData)
      return false
    }

    const payFormResult = await b.send("VKWebAppOpenPayForm" as never, {
      app_id: signData.app_id,
      action: "pay-to-service",
      params: {
        amount,
        description,
        order_id: signData.order_id,
        currency: "votes",
        data: itemId ?? "",
        sign: signData.sign,
      },
    } as never)

    if (typeof payFormResult === "boolean") return payFormResult
    return vkPayResultOk(payFormResult)
  } catch (e) {
    console.warn("[VK] VKWebAppOpenPayForm", e)
    return false
  }
}

/** Покупка 200 сердец (9 голосов). */
export async function buyHearts200(): Promise<boolean> {
  return showPaymentWall(payVotesForPack(200), VK_ITEM_IDS.hearts_200)
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

/**
 * Показать диалог приглашения друзей в приложение.
 * @see https://dev.vk.com/bridge/VKWebAppShowInviteBox
 */
export async function inviteFriends(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      const res = await b.send("VKWebAppShowInviteBox", {})
      const r = res as { success?: boolean; result?: boolean }
      return r?.success === true || r?.result === true || res != null
    } catch (e) {
      console.warn("VKWebAppShowInviteBox failed", e)
      return false
    }
  }
  return false
}

export type VkFriend = {
  id: number
  first_name: string
  last_name: string
  photo_200?: string
}

/**
 * Получить список друзей VK, которые установили приложение.
 * @see https://dev.vk.com/bridge/VKWebAppGetFriends
 */
export async function getFriends(): Promise<VkFriend[]> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      const res = await b.send("VKWebAppGetFriends", { multi: true })
      const r = res as { users?: VkFriend[] }
      return r?.users ?? []
    } catch (e) {
      console.warn("VKWebAppGetFriends failed", e)
      return []
    }
  }
  return []
}

/**
 * Пригласить конкретного друга по user_id.
 * @see https://dev.vk.com/bridge/VKWebAppShowInviteBox
 */
export async function recommendApp(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      const res = await b.send("VKWebAppRecommend", {})
      const r = res as { result?: boolean }
      return r?.result === true
    } catch (e) {
      console.warn("VKWebAppRecommend failed", e)
      return false
    }
  }
  return false
}

/** Доступна ли нативная реклама VK (reward / interstitial). */
export async function checkVkNativeAd(adFormat: "reward" | "interstitial"): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const res = await b.send("VKWebAppCheckNativeAds", { ad_format: adFormat })
    return (res as { result?: boolean })?.result === true
  } catch {
    return false
  }
}

/** Показ нативной рекламы VK (например, reward за просмотр). */
export async function showVkNativeAd(adFormat: "reward" | "interstitial"): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const res = await b.send("VKWebAppShowNativeAds", { ad_format: adFormat })
    return (res as { result?: boolean })?.result === true
  } catch (e) {
    console.warn("[VK] VKWebAppShowNativeAds", e)
    return false
  }
}

/**
 * Баннерная реклама VK внизу окна мини-приложения.
 * По умолчанию у платформы layout_type = resize (область WebView уменьшается на высоту баннера).
 * banner_align не передаём: в документации он учитывается только при layout_type = overlay
 * (и десктоп / горизонтальная ориентация); при overlay + align ещё и height_type игнорируется.
 * @see https://dev.vk.com/ru/bridge/VKWebAppShowBannerAd
 */
export async function showVkBannerAdBottomCompact(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const check = await b.send("VKWebAppCheckBannerAd", {})
    if ((check as { result?: boolean })?.result !== true) return false
    const res = await b.send("VKWebAppShowBannerAd", {
      banner_location: "bottom",
      layout_type: "resize",
      height_type: "compact",
    })
    return (res as { result?: boolean })?.result === true
  } catch (e) {
    console.warn("[VK] VKWebAppShowBannerAd", e)
    return false
  }
}

export const vkBridge = {
  getUserInfo,
  showPaymentWall,
  buyHearts200,
  buyHearts500,
  buyHearts1000,
  buyVip,
  inviteFriends,
  getFriends,
  recommendApp,
  checkVkNativeAd,
  showVkNativeAd,
  showVkBannerAdBottomCompact,
  initVk,
  initVkResilient,
  isVkMiniApp,
  isVkRuntimeEnvironment,
  ensureVkLaunchSearch,
  ensureVkLaunchSearchResilient,
  getVkLaunchSearchFromLocation,
  subscribeVkViewportResize,
  requestVkExpand,
  VK_ITEM_IDS,
}
