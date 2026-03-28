"use client"

import { useState, useEffect } from "react"

/**
 * vk_platform в мини-приложении ВК часто в hash (#/…?vk_platform=…), а не в location.search.
 */
function readVkPlatformFromLocation(): string | null {
  if (typeof window === "undefined") return null
  const fromSearch = new URLSearchParams(window.location.search).get("vk_platform")
  if (fromSearch) return fromSearch
  const hash = window.location.hash
  const qi = hash.indexOf("?")
  if (qi >= 0) {
    const v = new URLSearchParams(hash.slice(qi + 1)).get("vk_platform")
    if (v) return v
  }
  const m = hash.match(/[#&]vk_platform=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function computeIsDesktopUser(): boolean {
  if (typeof window === "undefined") return false

  const vkPlatform = readVkPlatformFromLocation()
  if (vkPlatform === "desktop_web") {
    return true
  }
  if (vkPlatform && /^desktop_/i.test(vkPlatform)) {
    return true
  }

  if (window.self !== window.top) {
    const ua = navigator.userAgent
    const isMobileUA =
      /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    if (!isMobileUA) return true
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
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    if (!isMobileUA && window.innerWidth >= 1024) return true
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

/**
 * Режим вёрстки игры: узкий «телефонный» вид только на реальном телефоне;
 * в узком iframe ВК на ПК — ПК-раскладка. Один вызов `useIsDesktopUser` на компонент.
 */
export function useGameLayoutMode(): {
  /** Компактный UI как на телефоне */
  layoutMobile: boolean
  /** ПК / десктопный клиент ВК (стол на 10, широкая логика) */
  isDesktopUser: boolean
} {
  const narrowViewport = useMediaQuery("(max-width: 767px)")
  const isDesktopUser = useIsDesktopUser()
  return {
    layoutMobile: narrowViewport && !isDesktopUser,
    isDesktopUser,
  }
}

/** Визуально планшетный layout: 768–1023px */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
}

/**
 * Пользователь на ПК (десктоп), даже если viewport узкий (VK iframe ~550px).
 * Определяет по vk_platform URL-параметру или по User-Agent в iframe.
 * Используется для ИГРОВОЙ логики (10 игроков вместо 6), не для визуальной верстки.
 */
export function useIsDesktopUser(): boolean {
  const [isDesktop, setIsDesktop] = useState(computeIsDesktopUser)

  useEffect(() => {
    setIsDesktop(computeIsDesktopUser())
  }, [])

  return isDesktop
}
