"use client"

import { useEffect } from "react"
import { isVkMiniApp, refreshVkPersistentHorizontalBanner } from "@/lib/vk-bridge"

/**
 * Горизонтальный overlay-баннер VK (compact, top): при маунте и при возврате вкладки.
 * Не вызываем HideBannerAd при модалках — баннер остаётся статичным.
 */
export function useVkMiniAppPersistentHorizontalBanner() {
  useEffect(() => {
    if (!isVkMiniApp()) return

    let cancelled = false

    const run = () => {
      if (cancelled) return
      void refreshVkPersistentHorizontalBanner()
    }

    run()

    const onVisibility = () => {
      if (cancelled || typeof document === "undefined") return
      if (document.visibilityState === "visible") run()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])
}

/** @deprecated Используйте {@link useVkMiniAppPersistentHorizontalBanner}; имя сохранено для GameRoom. */
export const useVkOverlayBannerInGameRoom = useVkMiniAppPersistentHorizontalBanner
