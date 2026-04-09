"use client"

import { useEffect } from "react"
import { isVkMiniApp, refreshVkPersistentHorizontalBanner } from "@/lib/vk-bridge"

/**
 * Горизонтальный overlay-баннер VK (compact, top): при маунте и при возврате вкладки.
 * Не вызываем HideBannerAd при модалках — баннер остаётся статичным.
 */
export function useVkMiniAppPersistentHorizontalBanner() {
  useEffect(() => {
    const vkMini = isVkMiniApp()
    if (!vkMini) return

    let cancelled = false
    let running = false
    const HEARTBEAT_MS = 120_000

    const run = () => {
      if (cancelled || running) return
      running = true
      void refreshVkPersistentHorizontalBanner().finally(() => {
        running = false
      })
    }

    run()

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
    const heartbeat = window.setInterval(run, HEARTBEAT_MS)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
      window.clearInterval(heartbeat)
    }
  }, [])
}

/** @deprecated Используйте {@link useVkMiniAppPersistentHorizontalBanner}; имя сохранено для GameRoom. */
export const useVkOverlayBannerInGameRoom = useVkMiniAppPersistentHorizontalBanner
