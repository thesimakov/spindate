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

/** Максимальная высота iframe: в панели VK «Размер iframe» до 4500 px (см. dev.vk.com games → Отображение). */
const VK_IFRAME_MAX_HEIGHT = 4500

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
 * Подгоняет размер iframe под окно (VKWebAppResizeWindow).
 * Ширина вкладки на десктопе учитывается, если в панели VK включён широкоформатный режим;
 * иначе ширина ограничена настройкой «Размер iframe» (до 1000 px) — см. документацию VK.
 * На части мобильных клиентов метод недоступен — ошибка игнорируется.
 * @see https://dev.vk.com/bridge/VKWebAppResizeWindow
 * @see https://dev.vk.com/ru/games/settings/general/display
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
  initVkResilient,
  isVkMiniApp,
  ensureVkLaunchSearch,
  ensureVkLaunchSearchResilient,
  getVkLaunchSearchFromLocation,
  getViewportSizeForVk,
  resizeVkWindowToViewport,
  subscribeVkViewportResize,
  VK_ITEM_IDS,
}
