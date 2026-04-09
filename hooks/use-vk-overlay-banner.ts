"use client"

import { useEffect } from "react"
import { useGame } from "@/lib/game-context"
import { hideVkBannerAd, refreshVkPersistentHorizontalBanner } from "@/lib/vk-bridge"

/**
 * Горизонтальный overlay-баннер VK (compact, top): при маунте и при возврате вкладки.
 * Не вызываем HideBannerAd при модалках — баннер остаётся статичным.
 */
export function useVkMiniAppPersistentHorizontalBanner() {
  const { state } = useGame()
  const currentUser = state.currentUser
  const vipActive =
    !!currentUser?.isVip && (currentUser.vipUntilTs == null || currentUser.vipUntilTs > Date.now())

  useEffect(() => {
    if (vipActive) {
      void hideVkBannerAd().catch(() => {})
      return
    }

    let cancelled = false
    let running = false
    const HEARTBEAT_MS = 45_000
    let heartbeat: number | null = null
    let t1: number | null = null
    let t2: number | null = null

    const run = () => {
      if (cancelled || running) return
      running = true
      void refreshVkPersistentHorizontalBanner().finally(() => {
        running = false
      })
    }

    run()
    // Дополнительные попытки после старта: bridge в VK WebView может инициализироваться с задержкой.
    t1 = window.setTimeout(run, 1800)
    t2 = window.setTimeout(run, 6500)

    const onVisibility = () => {
      if (cancelled || typeof document === "undefined") return
      if (document.visibilityState === "visible") run()
    }
    const onFocus = () => {
      if (cancelled) return
      run()
    }
    const onPageShow = () => {
      if (cancelled) return
      run()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    heartbeat = window.setInterval(run, HEARTBEAT_MS)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
      if (t1 !== null) window.clearTimeout(t1)
      if (t2 !== null) window.clearTimeout(t2)
      if (heartbeat !== null) window.clearInterval(heartbeat)
    }
  }, [vipActive, currentUser?.id])
}

/** @deprecated Используйте {@link useVkMiniAppPersistentHorizontalBanner}; имя сохранено для GameRoom. */
export const useVkOverlayBannerInGameRoom = useVkMiniAppPersistentHorizontalBanner
