"use client"

import { useState, useEffect, useLayoutEffect } from "react"

/**
 * vk_platform в мини-приложении ВК часто в hash (#/…?vk_platform=…), а не в location.search.
 */
function readVkPlatformFromLocation(): string | null {
  if (typeof window === "undefined") return null
  // Проверяем search (редко, но бывает)
  const fromSearch = new URLSearchParams(window.location.search).get("vk_platform")
  if (fromSearch) return fromSearch
  
  // Проверяем hash (основной способ VK)
  const hash = window.location.hash
  const qi = hash.indexOf("?")
  if (qi >= 0) {
    const v = new URLSearchParams(hash.slice(qi + 1)).get("vk_platform")
    if (v) return v
  }
  // Прямое совпадение в hash без ?
  const m = hash.match(/[#&]vk_platform=([^&]+)/)
  if (m) return decodeURIComponent(m[1])
  
  // Проверяем location.search ещё раз для случаев когда VK передает весь hash как search
  const fullSearch = window.location.search + window.location.hash
  const match2 = fullSearch.match(/[?&#]vk_platform=([^&#]+)/)
  return match2 ? decodeURIComponent(match2[1]) : null
}

function isLikelyRealMobileDevice(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent || ""
  const uaMobile =
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches
  const maxTouchPoints = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0
  const screenW = Math.max(window.screen?.width ?? 0, window.screen?.availWidth ?? 0)
  const screenH = Math.max(window.screen?.height ?? 0, window.screen?.availHeight ?? 0)
  const shortestSide = Math.min(screenW || 0, screenH || 0)

  // Реальные телефоны/планшеты: mobile UA или touch+coarse на сравнительно небольшом экране.
  if (uaMobile) return true
  if (coarsePointer && maxTouchPoints > 0 && shortestSide > 0 && shortestSide <= 1100) return true
  return false
}

function computeIsDesktopUser(): boolean {
  if (typeof window === "undefined") return false

  const vkPlatform = readVkPlatformFromLocation()
  
  // Явный desktop_web - всегда десктоп
  if (vkPlatform === "desktop_web") {
    return true
  }
  // Любой desktop_ префикс
  if (vkPlatform && /^desktop_/i.test(vkPlatform)) {
    return true
  }
  
  // Явный mobile или tablet - проверяем реальное устройство
  if (vkPlatform && /^(mobile_|android_|iphone_|ipad_|tablet_)/i.test(vkPlatform)) {
    // Если это реальное мобильное устройство - не десктоп
    const realMobile = isLikelyRealMobileDevice()
    if (realMobile) return false
    // Если открыто в iframe VK на ПК - это десктоп (VK просто передаёт mobile_web по умолчанию)
    if (window.self !== window.top) return true
    // Иначе верим VK
    return false
  }

  const realMobile = isLikelyRealMobileDevice()

  if (window.self !== window.top) {
    if (!realMobile) return true
    const ua = navigator.userAgent
    // WebView клиента ВК на Windows/macOS/Linux иногда содержит «Mobile», но это не телефон
    if (
      /Mobile/i.test(ua) &&
      /Windows NT|Macintosh|Mac OS X|Win64|WOW64|Linux x86_64|X11; Linux x86_64/i.test(ua) &&
      !/Android|iPhone|iPad|iPod/i.test(ua)
    ) {
      return true
    }
  }

  if (window.self === window.top) {
    // Внешний браузер VK (top-level): если это не реальное мобильное устройство,
    // всегда считаем десктопом, даже при узком viewport.
    if (!realMobile) return true
  }

  return false
}

/** Одноразовая диагностика в консоли iframe: скопируйте вывод и смотрите, что держит «планшет». */
export function getLayoutConstraintDebug(): Record<string, string | number | boolean | null> {
  if (typeof window === "undefined") {
    return { error: "no window" }
  }
  return {
    innerWidth: window.innerWidth,
    visualViewportWidth: window.visualViewport?.width ?? null,
    outerWidth: window.outerWidth,
    screenWidth: window.screen?.width ?? null,
    screenAvailWidth: window.screen?.availWidth ?? null,
    pointerCoarse:
      typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : null,
    maxTouchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null,
    inIframe: window.self !== window.top,
    vk_platform: readVkPlatformFromLocation(),
    uaLooksMobile:
      /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    mqMobile: window.matchMedia("(max-width: 767px)").matches,
    mqTablet: window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches,
    computeIsDesktopUser: computeIsDesktopUser(),
    search: window.location.search.slice(0, 120),
    hashPrefix: window.location.hash.slice(0, 120),
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const m = window.matchMedia(query)
    setMatches(m.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    m.addEventListener("change", handler)
    return () => m.removeEventListener("change", handler)
  }, [query])

  return matches
}

/** Визуально мобильный layout (по ширине viewport) */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)")
}

type DesktopUserDetect =
  | { resolved: false }
  | { resolved: true; desktop: boolean }

/**
 * Пока нет `window` / до commit layout — не показываем «мобильную блокировку» десктопу:
 * считаем клиент условно ПК (как в узком iframe ВК). После `useLayoutEffect` — фактическое устройство.
 */
function useDesktopUserDetect(): {
  /** ПК для игровой логики и вёрстки; до `resolved` — всегда true */
  isDesktopUser: boolean
  /** После первого layout на клиенте */
  deviceClassResolved: boolean
} {
  const [detect, setDetect] = useState<DesktopUserDetect>({ resolved: false })

  useLayoutEffect(() => {
    setDetect({ resolved: true, desktop: computeIsDesktopUser() })
  }, [])

  if (!detect.resolved) {
    return { isDesktopUser: true, deviceClassResolved: false }
  }
  return { isDesktopUser: detect.desktop, deviceClassResolved: true }
}

/**
 * Режим вёрстки игры: узкий «телефонный» вид только на реальном телефоне;
 * в узком iframe ВК на ПК — ПК-раскладка.
 */
export function useGameLayoutMode(): {
  /** Компактный UI как на телефоне */
  layoutMobile: boolean
  /** ПК / десктопный клиент ВК (стол на 10, широкая логика) */
  isDesktopUser: boolean
  /** Можно безопасно решать «мобильный клиент vs ПК» (экран блокировки только при resolved && !isDesktopUser) */
  deviceClassResolved: boolean
} {
  const narrowViewport = useMediaQuery("(max-width: 767px)")
  const { isDesktopUser, deviceClassResolved } = useDesktopUserDetect()
  return {
    layoutMobile: narrowViewport && !isDesktopUser,
    isDesktopUser,
    deviceClassResolved,
  }
}

/** @deprecated Игровой UI сведён к телефону и ПК; оставлено для отладки/внешних экранов */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
}

/**
 * Пользователь на ПК (десктоп), даже если viewport узкий (VK iframe ~550px).
 * Определяет по vk_platform URL-параметру или по User-Agent в iframe.
 * Используется для ИГРОВОЙ логики (10 игроков вместо 6), не для визуальной верстки.
 */
export function useIsDesktopUser(): boolean {
  return useGameLayoutMode().isDesktopUser
}
