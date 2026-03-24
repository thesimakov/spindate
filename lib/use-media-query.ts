"use client"

import { useState, useEffect } from "react"

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
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    let desktop = false

    const params = new URLSearchParams(window.location.search)
    const vkPlatform = params.get("vk_platform")
    if (vkPlatform === "desktop_web") {
      desktop = true
    }

    if (!desktop && window.self !== window.top) {
      const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      if (!isMobileUA) desktop = true
    }

    if (!desktop && window.self === window.top) {
      const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      if (!isMobileUA && window.innerWidth >= 1024) desktop = true
    }

    setIsDesktop(desktop)
  }, [])

  return isDesktop
}
