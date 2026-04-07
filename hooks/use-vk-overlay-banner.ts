"use client"

import { useEffect } from "react"
import { isVkMiniApp, refreshVkPersistentHorizontalBanner } from "@/lib/vk-bridge"

/**
 * Горизонтальный баннер VK в игровой комнате: показ при монтировании и снова при возврате на вкладку.
 * Не вызываем HideBannerAd при модалках — баннер остаётся статичным (не моргает при открытии/закрытии окон).
 */
export function useVkOverlayBannerInGameRoom() {
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
