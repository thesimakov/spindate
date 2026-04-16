"use client"

import { payVotesForPack } from "@/lib/heart-shop-pricing"
import { appPath } from "@/lib/app-path"
import { buildGameInviteClipboardText, getVkMiniAppPageUrl } from "@/lib/game-invite-copy"

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
  /** Интересы / деятельность, если клиент VK отдал в ответе GetUserInfo */
  interests?: string
}

function unwrapVkWebAppUserPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  const o = data as Record<string, unknown>

  const tryShape = (x: Record<string, unknown>): Record<string, unknown> | null => {
    const idRaw = x.id
    const id = typeof idRaw === "number" ? idRaw : typeof idRaw === "string" && /^\d+$/.test(idRaw) ? Number(idRaw) : NaN
    if (!Number.isFinite(id) || typeof x.first_name !== "string") return null
    return { ...x, id }
  }

  const top = tryShape(o)
  if (top) return top

  for (const key of ["detail", "data"]) {
    const inner = o[key]
    if (inner && typeof inner === "object") {
      const nested = tryShape(inner as Record<string, unknown>)
      if (nested) return nested
    }
  }
  const user = o.user
  if (user && typeof user === "object") {
    const nested = tryShape(user as Record<string, unknown>)
    if (nested) return nested
  }
  return null
}

function coerceSex(raw: unknown): 1 | 2 | undefined {
  if (raw === 1 || raw === 2) return raw
  if (raw === "1") return 1
  if (raw === "2") return 2
  return undefined
}

function coerceCity(raw: unknown): { id: number; title: string } | undefined {
  if (raw && typeof raw === "object" && "title" in raw) {
    const t = (raw as { title?: unknown; id?: unknown }).title
    const idNum = Number((raw as { id?: unknown }).id)
    if (typeof t === "string" && t.trim()) return { id: Number.isFinite(idNum) ? idNum : 0, title: t.trim() }
  }
  if (typeof raw === "string" && raw.trim()) return { id: 0, title: raw.trim() }
  return undefined
}

function pickInterestsFromPayload(o: Record<string, unknown>): string | undefined {
  for (const k of ["interests", "activities"]) {
    const v = o[k]
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 240)
  }
  return undefined
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

/** vk_user_id из адресной строки мини-приложения (без вызова bridge). */
export function readVkUserIdFromClientLocation(): number | null {
  const q = getVkLaunchSearchFromLocation()
  if (!q) return null
  const formatted = q.startsWith("?") ? q.slice(1) : q
  const raw = new URLSearchParams(formatted).get("vk_user_id")
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Параметр запуска VK из search/hash (например `vk_is_recommended`, `vk_platform`).
 * @see https://dev.vk.com/mini-apps/development/launch-params
 */
export function readVkLaunchParamValue(paramName: string): string | null {
  if (typeof window === "undefined") return null
  const fromSearch = new URLSearchParams(window.location.search).get(paramName)
  if (fromSearch != null && fromSearch !== "") return fromSearch
  const hash = window.location.hash
  const qi = hash.indexOf("?")
  if (qi >= 0) {
    const v = new URLSearchParams(hash.slice(qi + 1)).get(paramName)
    if (v != null && v !== "") return v
  }
  const m = hash.match(new RegExp(`[#&]${paramName.replace(/[\\^$*+?.()|[\\]{}]/g, "\\$&")}=([^&]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

/** Пользователь уже отправил рекомендацию приложения — не показывать {@link VKWebAppRecommend} повторно. */
export function readVkIsRecommendedFromLocation(): boolean {
  const v = readVkLaunchParamValue("vk_is_recommended")
  return v === "1" || v === "true"
}

/** Клиент VK Android — для {@link VKWebAppAddToHomeScreen} (ярлык только на Android). */
export function isVkAndroidClientFromLocation(): boolean {
  const p = readVkLaunchParamValue("vk_platform")
  if (!p) return false
  return p === "android" || /^android_/i.test(p) || p === "mobile_android"
}

/** Сообщество Lemnity (бонус за подписку, экран «мобильная версия»). */
export const VK_COMMUNITY_GROUP_ID = 236519647
export const VK_COMMUNITY_PUBLIC_URL = "https://vk.com/lemnitygame"

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
  const mini = isVkMiniApp()
  if (mini) return true
  const b = await getBridgeAsync()
  if (!b) return false
  try {
    const embedded = typeof b.isEmbedded === "function" ? b.isEmbedded() : false
    if (embedded) return true
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

const VK_INIT_TIMEOUT_MS = 2500

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
      const d = unwrapVkWebAppUserPayload(data)
      if (d) {
        const interests = pickInterestsFromPayload(d)
        return {
          id: d.id as number,
          first_name: (d.first_name as string) ?? "",
          last_name: (d.last_name as string) ?? "",
          photo_200: typeof d.photo_200 === "string" ? d.photo_200 : "",
          sex: coerceSex(d.sex),
          bdate: typeof d.bdate === "string" ? d.bdate : undefined,
          city: coerceCity(d.city),
          ...(interests ? { interests } : {}),
        }
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
  hearts_12: "hearts_12",
  hearts_60: "hearts_60",
  hearts_150: "hearts_150",
  hearts_400: "hearts_400",
  hearts_1000: "hearts_1000",
  hearts_2500: "hearts_2500",
  hearts_7500: "hearts_7500",
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
      const appIdForOrder = getVkAppId()
      const orderBoxParams: Record<string, unknown> = {
        type: "item",
        item: itemId,
      }
      if (appIdForOrder) orderBoxParams.app_id = appIdForOrder
      const result = await b.send("VKWebAppShowOrderBox", orderBoxParams)
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

/** Покупка пака сердец по размеру (см. VK_ITEM_IDS hearts_*). */
export async function buyHeartsPack(hearts: 12 | 60 | 150 | 400 | 1000 | 2500 | 7500): Promise<boolean> {
  const itemByHearts: Record<typeof hearts, string> = {
    12: VK_ITEM_IDS.hearts_12,
    60: VK_ITEM_IDS.hearts_60,
    150: VK_ITEM_IDS.hearts_150,
    400: VK_ITEM_IDS.hearts_400,
    1000: VK_ITEM_IDS.hearts_1000,
    2500: VK_ITEM_IDS.hearts_2500,
    7500: VK_ITEM_IDS.hearts_7500,
  }
  return showPaymentWall(payVotesForPack(hearts), itemByHearts[hearts])
}

/** Покупка VIP (оплата через VK, курс: 1 голос = 1 сердце). */
export async function buyVip(): Promise<boolean> {
  return showPaymentWall(50, VK_ITEM_IDS.vip_30d)
}

/**
 * Показать диалог приглашения друзей в приложение.
 * @param opts.requestKey — для игр: передаётся в запуск как `vk_request_key` ([док](https://dev.vk.com/ru/bridge/VKWebAppShowInviteBox)).
 * @see https://dev.vk.com/bridge/VKWebAppShowInviteBox
 */
export async function inviteFriends(opts?: { requestKey?: string }): Promise<boolean> {
  const b = await getBridgeAsync()
  if (b && isVkMiniApp()) {
    try {
      const key = typeof opts?.requestKey === "string" ? opts.requestKey.trim() : ""
      const payload = key ? { requestKey: key.slice(0, 500) } : {}
      const res = await b.send("VKWebAppShowInviteBox", payload)
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

export type ShareGameInviteOutcome = "ok_full" | "ok_recommend" | "fail"

/**
 * «Рассказать про игру»: копирует текст приглашения в буфер, открывает нативный шаринг ссылки на приложение.
 * Если пользователь уже рекомендовал приложение (`vk_is_recommended`), окно VKWebAppRecommend не вызывается.
 * Иначе при неудаче копирования/шаринга — fallback на {@link recommendApp}.
 * @see https://dev.vk.com/ru/bridge/VKWebAppRecommend
 */
export async function shareGameInvite(): Promise<ShareGameInviteOutcome> {
  await initVkResilient()
  const b = await getBridgeAsync()
  if (!b || !isVkMiniApp()) return "fail"

  const alreadyRecommended = readVkIsRecommendedFromLocation()
  const copyText = buildGameInviteClipboardText()
  const link = getVkMiniAppPageUrl()
  let copyOk = false
  let shareOk = false

  try {
    await b.send("VKWebAppCopyText", { text: copyText })
    copyOk = true
  } catch (e) {
    console.warn("[VK] VKWebAppCopyText", e)
  }

  if (link) {
    try {
      await b.send("VKWebAppShare", { link })
      shareOk = true
    } catch (e) {
      console.warn("[VK] VKWebAppShare", e)
    }
  }

  if (copyOk || shareOk) return "ok_full"
  if (alreadyRecommended) return "fail"
  return (await recommendApp()) ? "ok_recommend" : "fail"
}

/** Доступен ли нативный блок спонсоров VK (reward / interstitial). */
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

/** Показ нативного ролика спонсора VK (например, reward за просмотр). */
export async function showVkNativeAd(adFormat: "reward" | "interstitial"): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const res = await b.send("VKWebAppShowNativeAds", { ad_format: adFormat })
    return (res as { result?: boolean })?.result === true
  } catch (e) {
    console.warn("[VK] VKWebAppShowNativeAds", e)
    return false
  } finally {
    // Клиент VK часто скрывает горизонтальный баннер на время полноэкранного native — восстанавливаем после выхода.
    void refreshVkPersistentHorizontalBanner().catch(() => {})
  }
}

export type VkBannerShowOptions = {
  /** `top` — полоса у верхнего края WebView; `bottom` — внизу окна мини-приложения. Параметра привязки к DOM-контейнеру нет. */
  banner_location?: "top" | "bottom"
  /** `resize` — сжимает область веб-контента под высоту баннера; `overlay` — наложение поверх контента. */
  layout_type?: "resize" | "overlay"
  /** `compact` — ниже по высоте; `regular` — выше. */
  height_type?: "compact" | "regular"
  /** Часть платформ (напр. desktop overlay), см. ShowBannerAdRequest в @vkontakte/vk-bridge. */
  banner_align?: "left" | "right" | "center"
  orientation?: "horizontal" | "vertical"
  can_close?: boolean
}

/**
 * Баннер спонсоров VK: нативный клиент рисует полосу у края WebView, не внутри произвольного div.
 * Не вызывать VKWebAppCheckBannerAd до показа — проверка относится к уже открытому баннеру.
 * @see https://dev.vk.com/ru/bridge/VKWebAppShowBannerAd
 */
export async function showVkBannerAdCompact(options?: VkBannerShowOptions): Promise<boolean> {
  const b = await getBridgeAsync()
  const runtime = await isVkRuntimeEnvironment()
  if (!b || !runtime) return false
  const banner_location = options?.banner_location ?? "top"
  const layout_type = options?.layout_type ?? "resize"
  const height_type = options?.height_type ?? "compact"
  const payload: Record<string, unknown> = {
    banner_location,
    layout_type,
    height_type,
  }
  try {
    if (options?.banner_align != null) payload.banner_align = options.banner_align
    if (options?.orientation != null) payload.orientation = options.orientation
    if (options?.can_close != null) payload.can_close = options.can_close
    const res = await b.send("VKWebAppShowBannerAd", payload)
    return (res as { result?: boolean })?.result === true
  } catch (e) {
    console.warn("[VK] VKWebAppShowBannerAd", e)
    return false
  }
}

/** То же, что {@link showVkBannerAdCompact} с `banner_location: "bottom"`. */
export async function showVkBannerAdBottomCompact(): Promise<boolean> {
  return showVkBannerAdCompact({ banner_location: "bottom" })
}

/**
 * Как пресет с `banner_align: "left"` + `overlay` + `horizontal`, но **сверху и справа**:
 * `banner_location: "top"`, `banner_align: "right"`, `layout_type: "overlay"`, `orientation: "horizontal"`.
 * `can_close: false` — по контракту VK баннер не закрывают пользователем вручную.
 * @see https://dev.vk.com/ru/games/monetization/ad/banners
 */
export async function showVkBannerAdHorizontalPersistent(): Promise<boolean> {
  const strict = await showVkBannerAdCompact({
    banner_location: "top",
    layout_type: "overlay",
    banner_align: "right",
    orientation: "horizontal",
    height_type: "compact",
    can_close: false,
  })
  if (strict) return true

  // На части клиентов VK часть полей (align/orientation/can_close) может не поддерживаться.
  const soft = await showVkBannerAdCompact({
    banner_location: "top",
    layout_type: "overlay",
    height_type: "compact",
  })
  if (soft) return true

  // Крайний fallback для старых/нестабильных WebView.
  return showVkBannerAdCompact({
    banner_location: "top",
    layout_type: "resize",
    height_type: "compact",
  })
}

function vkPersistentBannerRetryDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const VK_PERSISTENT_BANNER_MAX_ATTEMPTS = 6
const VK_PERSISTENT_BANNER_BASE_DELAY_MS = 220
const VK_PERSISTENT_BANNER_MAX_DELAY_MS = 1200
const VK_PERSISTENT_BANNER_MIN_GAP_MS = 600

let vkPersistentBannerRefreshInFlight: Promise<void> | null = null
let vkPersistentBannerLastStartedAt = 0
let vkPersistentBannerDeferredTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Повторные попытки показать горизонтальный persistent-баннер (после {@link initVkResilient}).
 */
export async function refreshVkPersistentHorizontalBanner(): Promise<void> {
  const now = Date.now()
  if (vkPersistentBannerRefreshInFlight) {
    return vkPersistentBannerRefreshInFlight
  }
  if (now - vkPersistentBannerLastStartedAt < VK_PERSISTENT_BANNER_MIN_GAP_MS) {
    const waitMs = VK_PERSISTENT_BANNER_MIN_GAP_MS - (now - vkPersistentBannerLastStartedAt)
    if (vkPersistentBannerDeferredTimer == null) {
      vkPersistentBannerDeferredTimer = setTimeout(() => {
        vkPersistentBannerDeferredTimer = null
        void refreshVkPersistentHorizontalBanner()
      }, Math.max(20, waitMs))
    }
    return
  }

  vkPersistentBannerLastStartedAt = now
  vkPersistentBannerRefreshInFlight = (async () => {
    // Fast-first: на части клиентов bridge уже готов, и баннер можно показать без ожидания init.
    const fastFirstOk = await showVkBannerAdHorizontalPersistent()
    if (fastFirstOk) return

    await initVkResilient()
    let failStreak = 0

    for (let i = 0; i < VK_PERSISTENT_BANNER_MAX_ATTEMPTS; i++) {
      // При длительной серии неудач повторно инициализируем bridge/runtime.
      if (i > 0 && failStreak >= 2) {
        await initVkResilient()
      }

      const ok = await showVkBannerAdHorizontalPersistent()
      if (ok) return
      failStreak += 1

      const backoff = Math.min(
        VK_PERSISTENT_BANNER_MAX_DELAY_MS,
        VK_PERSISTENT_BANNER_BASE_DELAY_MS * 2 ** i,
      )
      const jitter = Math.floor(Math.random() * 220)
      await vkPersistentBannerRetryDelay(backoff + jitter)
    }
  })()

  try {
    await vkPersistentBannerRefreshInFlight
  } finally {
    vkPersistentBannerRefreshInFlight = null
  }
}

/** Снять нативный баннер (если нужно вручную; при обычной игре не вызываем — баннер остаётся статичным). */
export async function hideVkBannerAd(): Promise<void> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return
  try {
    await b.send("VKWebAppHideBannerAd", {})
  } catch (e) {
    console.warn("[VK] VKWebAppHideBannerAd", e)
  }
}

/**
 * Горизонтальная ориентация, блок справа, overlay (десктоп / часть клиентов ВК).
 * @see https://dev.vk.com/ru/games/monetization/ad/banners
 */
export async function showVkBannerAdOverlayRightVertical(): Promise<boolean> {
  return showVkBannerAdCompact({
    banner_location: "top",
    layout_type: "overlay",
    banner_align: "right",
    orientation: "horizontal",
    height_type: "regular",
  })
}

/**
 * Диалог разрешения push-уведомлений от мини-приложения (системный экран ВК).
 * Без согласия пользователя {@link https://dev.vk.com/method/notifications.sendMessage notifications.sendMessage} не доставляет оповещения.
 * @see https://dev.vk.com/bridge/VKWebAppAllowNotifications
 */
export async function requestVkAllowNotifications(): Promise<{ ok: boolean }> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return { ok: false }
  try {
    const raw = await b.send("VKWebAppAllowNotifications", {})
    const data = raw as { result?: boolean } | null
    if (data && typeof data === "object" && data.result === false) return { ok: false }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * Отключение уведомлений от приложения (по желанию пользователя).
 * @see https://dev.vk.com/bridge/VKWebAppDenyNotifications
 */
export async function requestVkDenyNotifications(): Promise<{ ok: boolean }> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return { ok: false }
  try {
    await b.send("VKWebAppDenyNotifications", {})
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * Добавить мини-приложение в избранное (левое меню / Сервисы → Избранное).
 * После прохождения модерации приложения.
 * @see https://dev.vk.com/ru/bridge/VKWebAppAddToFavorites
 */
export async function addVkAppToFavorites(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const raw = await b.send("VKWebAppAddToFavorites", {})
    const data = raw as { result?: boolean } | null
    return data?.result === true
  } catch (e) {
    console.warn("[VK] VKWebAppAddToFavorites", e)
    return false
  }
}

export type VkAddToHomeScreenInfo = {
  /** Ярлык уже на главном экране (поля зависят от версии клиента). */
  isAdded?: boolean
}

/**
 * Узнать, добавлен ли ярлык на главный экран (перед {@link addVkAppToHomeScreen}).
 * @see https://dev.vk.com/ru/bridge/VKWebAppAddToHomeScreenInfo
 */
export async function getVkAddToHomeScreenInfo(): Promise<VkAddToHomeScreenInfo> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return {}
  try {
    const raw = await b.send("VKWebAppAddToHomeScreenInfo", {})
    if (raw == null || typeof raw !== "object") return {}
    const o = raw as Record<string, unknown>
    const nested = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : o
    const isAdded =
      nested.is_installed_to_home_screen === true ||
      nested.is_added === true ||
      nested.is_installed === true ||
      o.is_installed_to_home_screen === true
    return { isAdded: isAdded === true ? true : undefined }
  } catch (e) {
    console.warn("[VK] VKWebAppAddToHomeScreenInfo", e)
    return {}
  }
}

/**
 * Предложить добавить ярлык на главный экран (только Android).
 * @see https://dev.vk.com/ru/bridge/VKWebAppAddToHomeScreen
 */
export async function addVkAppToHomeScreen(): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const raw = await b.send("VKWebAppAddToHomeScreen", {})
    const data = raw as { result?: boolean } | null
    return data?.result === true
  } catch (e) {
    console.warn("[VK] VKWebAppAddToHomeScreen", e)
    return false
  }
}

/**
 * Открыть запись на стене пользователя или сообщества в оверлее (в основном Web).
 * @see https://dev.vk.com/ru/bridge/VKWebAppOpenWallPost
 */
export async function openVkWallPost(ownerId: number, postId: number): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  if (!Number.isFinite(ownerId) || !Number.isFinite(postId) || postId <= 0) return false
  try {
    const raw = await b.send("VKWebAppOpenWallPost", {
      owner_id: Math.trunc(ownerId),
      post_id: Math.trunc(postId),
    })
    const data = raw as { result?: boolean } | null
    return data?.result !== false
  } catch (e) {
    console.warn("[VK] VKWebAppOpenWallPost", e)
    return false
  }
}

export type VkLeaderBoardOptions = {
  /** Значение для строки игрока в таблице (тип задаётся в кабинете VK). */
  user_result?: number
  /** 0 — друзья, 1 — глобально. */
  global?: 0 | 1
  app_id?: number
}

/**
 * Турнирная таблица VK (настройка в кабинете игры).
 * @see https://dev.vk.com/ru/bridge/VKWebAppShowLeaderBoardBox
 */
export async function showVkLeaderBoardBox(opts?: VkLeaderBoardOptions): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  try {
    const payload: Record<string, unknown> = {}
    if (opts?.user_result != null && Number.isFinite(opts.user_result)) {
      payload.user_result = Math.max(0, Math.min(2_000_000_000, Math.trunc(opts.user_result)))
    }
    if (opts?.global === 0 || opts?.global === 1) payload.global = opts.global
    if (opts?.app_id != null && Number.isFinite(opts.app_id)) payload.app_id = Math.trunc(opts.app_id)
    const raw = await b.send("VKWebAppShowLeaderBoardBox", payload)
    if (raw == null || typeof raw !== "object") return false
    const o = raw as Record<string, unknown>
    if (o.success === true) return true
    const d = o.data
    if (d && typeof d === "object" && (d as { success?: boolean }).success === true) return true
    return false
  } catch (e) {
    console.warn("[VK] VKWebAppShowLeaderBoardBox", e)
    return false
  }
}

const VK_TRANSLATE_MAX_LINES = 10
const VK_TRANSLATE_MAX_CHARS = 1024

/**
 * Перевод строк через VK (лимиты: ≤10 строк, ≤1024 символов на строку; не чаще ~10 раз/мин).
 * @see https://dev.vk.com/ru/bridge/VKWebAppTranslate
 */
export async function translateVkTexts(
  texts: string[],
  translationLanguage: string,
): Promise<{ texts: string[]; source_lang?: string } | null> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return null
  const lang = translationLanguage.trim().slice(0, 32)
  if (!lang) return null
  const sanitized = texts
    .slice(0, VK_TRANSLATE_MAX_LINES)
    .map((t) => (typeof t === "string" ? t.slice(0, VK_TRANSLATE_MAX_CHARS) : ""))
  if (sanitized.length === 0) return null
  try {
    const raw = await b.send("VKWebAppTranslate", {
      texts: sanitized,
      translation_language: lang,
    })
    if (raw == null || typeof raw !== "object") return null
    const o = raw as Record<string, unknown>
    const out = o.texts ?? (o.result && typeof o.result === "object" ? (o.result as Record<string, unknown>).texts : null)
    const arr = Array.isArray(out) ? out.map((x) => (typeof x === "string" ? x : "")) : null
    if (!arr) return null
    const source_lang = typeof o.source_lang === "string" ? o.source_lang : undefined
    return { texts: arr, source_lang }
  } catch (e) {
    console.warn("[VK] VKWebAppTranslate", e)
    return null
  }
}

/**
 * Подписка на сообщество из мини-приложения.
 * @see https://dev.vk.com/bridge/VKWebAppJoinGroup
 */
export async function joinVkCommunityGroup(): Promise<{ ok: boolean }> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return { ok: false }
  try {
    const raw = await b.send("VKWebAppJoinGroup", { group_id: VK_COMMUNITY_GROUP_ID })
    const data = raw as { result?: boolean } | null
    if (data && typeof data === "object" && data.result === false) return { ok: false }
    return { ok: true }
  } catch (e) {
    console.warn("[VK] VKWebAppJoinGroup", e)
    return { ok: false }
  }
}

/**
 * Открыть ссылку (во встроенном браузере ВК или в новой вкладке).
 * @see https://dev.vk.com/bridge/VKWebAppOpenURL
 */
export async function openVkUrl(url: string): Promise<boolean> {
  const u = url.trim()
  if (!u) return false
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) {
    if (typeof window !== "undefined") window.open(u, "_blank", "noopener,noreferrer")
    return true
  }
  try {
    const raw = await b.send("VKWebAppOpenURL", { url: u })
    const data = raw as { result?: boolean } | null
    return data?.result !== false
  } catch (e) {
    console.warn("[VK] VKWebAppOpenURL", e)
    if (typeof window !== "undefined") window.open(u, "_blank", "noopener,noreferrer")
    return true
  }
}

/**
 * Публикация «на стену» из мини-приложения по документации VK:
 * - основной путь — {@link https://dev.vk.com/ru/bridge/VKWebAppShowWallPostBox VKWebAppShowWallPostBox}
 *   (окно подтверждения; это не прямой вызов API `wall.post` с фронта).
 * - при недоступности стены — {@link https://dev.vk.com/ru/bridge/VKWebAppShare VKWebAppShare} (ЛС); буфер только если шаринг не открылся.
 */
export type VkWallPostOutcome = {
  ok: boolean
  /** Сработал шаринг в ЛС вместо стены. */
  usedShareFallback?: boolean
  /** Текст удалось положить только в буфер — VKWebAppShare не сработал. */
  usedClipboardFallback?: boolean
}

function isVkBridgeErrorShape(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false
  const o = raw as Record<string, unknown>
  if (typeof o.error_type === "string" && o.error_type.length > 0) return true
  if (typeof o.error_code === "number") return true
  const ed = o.error_data
  if (ed && typeof ed === "object") {
    const reason = (ed as Record<string, unknown>).error_reason
    if (typeof reason === "string" && reason.length > 0) return true
  }
  const detail = o.detail
  if (detail && typeof detail === "object") return isVkBridgeErrorShape(detail)
  return false
}

/** Абсолютный https/http URL для вложений VK (стена / шаринг), относительные пути — через appPath и origin. */
function resolvePublicUrlForVkAttachment(pathOrUrl: string | undefined): string | null {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null
  const t = pathOrUrl.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t.slice(0, 800)
  const path = t.startsWith("/") ? t : `/${t}`
  const resolved = appPath(path)
  if (/^https?:\/\//i.test(resolved)) return resolved.slice(0, 800)
  if (typeof window !== "undefined" && window.location?.origin?.startsWith("http")) {
    return `${window.location.origin}${resolved}`.slice(0, 800)
  }
  return null
}

/** Явный отказ окна поста (в т.ч. «приложению недоступно создание постов»). */
function wallPostBoxResponseFailed(raw: unknown): boolean {
  if (raw == null) return false
  if (typeof raw !== "object") return false
  const o = raw as Record<string, unknown>
  if (isVkBridgeErrorShape(o)) return true
  if (o.result === false) return true
  return false
}

/** Полный текст для ЛС: пост + при необходимости прямая ссылка на картинку (вложение photo… через Bridge в шаринг не передать). */
function buildLmMessageBody(postText: string, rawImagePath?: string): string {
  const base = postText.trim()
  const imgAbs = resolvePublicUrlForVkAttachment(rawImagePath)
  if (!imgAbs || base.includes(imgAbs)) return base.slice(0, 12000)
  return `${base}\n\n${imgAbs}`.slice(0, 12000)
}

/** Ограничение длины подписи к VKWebAppShare (неофициальный `text`). */
const LM_SHARE_TEXT_MAX = 3500

/**
 * ЛС без предварительного буфера: сначала VKWebAppShare с link + text (часть клиентов подставляет text в поле сообщения).
 * Вложение-картинку как photo123_456 Bridge из мини-приложения не передаёт — только ссылка на файл в тексте.
 * CopyText — только если шаринг выбросил ошибку.
 */
async function vkWallPostShareFallback(
  b: Bridge,
  postText: string,
  preferredLink: string,
  rawImagePath?: string,
): Promise<{ ok: boolean; clipboardOnly: boolean }> {
  const link = preferredLink.trim() || getVkMiniAppPageUrl() || ""
  const messageBody = buildLmMessageBody(postText, rawImagePath).slice(0, LM_SHARE_TEXT_MAX)

  if (link) {
    try {
      await b.send(
        "VKWebAppShare" as never,
        { link, text: messageBody } as never,
      )
      return { ok: true, clipboardOnly: false }
    } catch (e) {
      console.warn("[VK] VKWebAppShare (wall fallback)", e)
    }
  }

  try {
    await b.send("VKWebAppCopyText", { text: messageBody })
    return { ok: true, clipboardOnly: true }
  } catch (e) {
    console.warn("[VK] VKWebAppCopyText (wall fallback)", e)
  }
  return { ok: false, clipboardOnly: false }
}

export async function showVkWallPostConfirm(
  payload: string | { message: string; imageUrl?: string; gameUrl?: string },
): Promise<VkWallPostOutcome> {
  const message = typeof payload === "string" ? payload : payload.message
  const text = message.trim()
  if (!text) return { ok: false }
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return { ok: false }
  const gameUrl = typeof payload !== "string" && typeof payload.gameUrl === "string" ? payload.gameUrl.trim() : ""
  const rawImageUrl = typeof payload !== "string" && typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : ""

  const tryWallBoxUploadPhoto = async (): Promise<boolean> => {
    const imgAbs = resolvePublicUrlForVkAttachment(rawImageUrl)
    if (!imgAbs) return false
    try {
      const linkAbs = resolvePublicUrlForVkAttachment(gameUrl) ?? gameUrl
      const parts: string[] = []
      if (linkAbs) parts.push(linkAbs)
      const req: Record<string, unknown> = {
        message: text,
        upload_attachments: [{ type: "photo", link: imgAbs }],
      }
      if (parts.length > 0) req.attachments = parts.join(",")
      const raw = await b.send("VKWebAppShowWallPostBox" as never, req as never)
      if (wallPostBoxResponseFailed(raw)) return false
      const data = raw as { result?: boolean; post_id?: number } | null
      if (data && typeof data === "object") {
        if (data.result === false) return false
        const pid = data.post_id
        if (typeof pid === "number" && pid > 0) return true
        if (typeof pid === "string" && /^\d+$/.test(pid) && Number(pid) > 0) return true
      }
      return true
    } catch (e) {
      console.warn("[VK] VKWebAppShowWallPostBox upload_attachments", e)
      return false
    }
  }

  const tryWallBox = async (withAttachments: boolean): Promise<boolean> => {
    try {
      const attachments: string[] = []
      if (withAttachments && typeof payload !== "string") {
        const link = resolvePublicUrlForVkAttachment(gameUrl) ?? gameUrl
        // Прямой URL картинки в `attachments` нельзя: клиент VK часто дублирует его в тексте поста
        // поверх уже встроенного превью. Картинку передаём только через upload_attachments.
        if (link) attachments.push(link)
      }
      const raw = await b.send("VKWebAppShowWallPostBox" as never, {
        message: text,
        ...(attachments.length > 0 ? { attachments: attachments.join(",") } : {}),
      } as never)
      if (wallPostBoxResponseFailed(raw)) return false
      const data = raw as { result?: boolean; post_id?: number } | null
      if (data && typeof data === "object") {
        if (data.result === false) return false
        const pid = data.post_id
        if (typeof pid === "number" && pid > 0) return true
        if (typeof pid === "string" && /^\d+$/.test(pid) && Number(pid) > 0) return true
      }
      return true
    } catch (e) {
      console.warn("[VK] VKWebAppShowWallPostBox", e)
      return false
    }
  }

  // При наличии картинки сначала upload_attachments — фото без «голого» URL в тексте.
  // Затем текст + ссылка на приложение в attachments (не URL изображения — см. tryWallBox).
  let wallOk = await tryWallBoxUploadPhoto()
  if (!wallOk) wallOk = await tryWallBox(true)
  if (!wallOk) wallOk = await tryWallBox(false)
  if (wallOk) return { ok: true }

  const fb = await vkWallPostShareFallback(b, text, gameUrl, rawImageUrl || undefined)
  return {
    ok: fb.ok,
    usedShareFallback: fb.ok,
    usedClipboardFallback: fb.clipboardOnly,
  }
}

export async function showVkStoryBox(input: {
  imageUrl: string
  attachmentText?: string
  attachmentUrl?: string
  locked?: boolean
}): Promise<boolean> {
  const b = await getBridgeAsync()
  if (!b || !(await isVkRuntimeEnvironment())) return false
  const imageUrl = resolvePublicUrlForVkAttachment(input.imageUrl)
  if (!imageUrl) return false
  const attachmentUrl = resolvePublicUrlForVkAttachment(input.attachmentUrl) ?? input.attachmentUrl?.trim() ?? ""
  try {
    await b.send("VKWebAppShowStoryBox" as never, {
      background_type: "image",
      url: imageUrl,
      locked: input.locked === true,
      ...(attachmentUrl
        ? {
            attachment: {
              type: "url",
              text: (input.attachmentText?.trim() || "Открыть игру").slice(0, 80),
              url: attachmentUrl,
            },
          }
        : {}),
    } as never)
    return true
  } catch (e) {
    console.warn("[VK] VKWebAppShowStoryBox", e)
    return false
  }
}

export const vkBridge = {
  getUserInfo,
  showPaymentWall,
  buyHeartsPack,
  buyVip,
  inviteFriends,
  getFriends,
  recommendApp,
  shareGameInvite,
  checkVkNativeAd,
  showVkNativeAd,
  showVkBannerAdCompact,
  showVkBannerAdBottomCompact,
  showVkBannerAdHorizontalPersistent,
  hideVkBannerAd,
  refreshVkPersistentHorizontalBanner,
  showVkBannerAdOverlayRightVertical,
  initVk,
  initVkResilient,
  isVkMiniApp,
  isVkRuntimeEnvironment,
  ensureVkLaunchSearch,
  ensureVkLaunchSearchResilient,
  getVkLaunchSearchFromLocation,
  subscribeVkViewportResize,
  requestVkExpand,
  requestVkAllowNotifications,
  requestVkDenyNotifications,
  joinVkCommunityGroup,
  openVkUrl,
  showVkWallPostConfirm,
  showVkStoryBox,
  readVkUserIdFromClientLocation,
  readVkLaunchParamValue,
  readVkIsRecommendedFromLocation,
  isVkAndroidClientFromLocation,
  addVkAppToFavorites,
  getVkAddToHomeScreenInfo,
  addVkAppToHomeScreen,
  openVkWallPost,
  showVkLeaderBoardBox,
  translateVkTexts,
  VK_COMMUNITY_GROUP_ID,
  VK_COMMUNITY_PUBLIC_URL,
  VK_ITEM_IDS,
}
