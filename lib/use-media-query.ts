"use client"

import { useState, useEffect } from "react"

/**
 * Определяет платформу VK по URL-параметру `vk_platform`.
 * Возвращает true, если пользователь заходит через десктопный VK.
 * В iframe VK на ПК ширина окна ~600px, но это не мобильное устройство.
 */
function isVkDesktop(): boolean {
  if (typeof window === "undefined") return false
  try {
    const params = new URLSearchParams(window.location.search)
    const platform = params.get("vk_platform")
    return platform === "desktop_web"
  } catch {
    return false
  }
}

/**
 * Дополнительная проверка: если нет vk_platform, смотрим на User-Agent.
 * Iframe VK на ПК имеет десктопный UA, мобильный VK — мобильный UA.
 */
function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
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

export function useIsMobile(): boolean {
  const mqMobile = useMediaQuery("(max-width: 767px)")
  const [vkDesktop, setVkDesktop] = useState(false)

  useEffect(() => {
    if (isVkDesktop() || (!isMobileUserAgent() && window.self !== window.top)) {
      setVkDesktop(true)
    }
  }, [])

  if (vkDesktop) return false
  return mqMobile
}

/** Планшет: от 768px до 1023px (md, но не lg) */
export function useIsTablet(): boolean {
  const mqTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)")
  const [vkDesktop, setVkDesktop] = useState(false)

  useEffect(() => {
    if (isVkDesktop() || (!isMobileUserAgent() && window.self !== window.top)) {
      setVkDesktop(true)
    }
  }, [])

  if (vkDesktop) return false
  return mqTablet
}
