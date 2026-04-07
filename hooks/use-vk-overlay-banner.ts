"use client"

import { useEffect } from "react"
import {
  isVkMiniApp,
  refreshVkPersistentBannerIfNotSuppressed,
  setVkPersistentBannerSuppressedForOverlay,
} from "@/lib/vk-bridge"

/**
 * Горизонтальный баннер VK: при `suppressForModals` скрывается через `VKWebAppHideBannerAd`,
 * чтобы нативный overlay не перекрывал модалки WebView. Иначе — снова показывается.
 * Повторный показ при возврате на вкладку, если никто не держит подавление.
 */
export function useVkOverlayBannerInGameRoom(suppressForModals: boolean) {
  useEffect(() => {
    setVkPersistentBannerSuppressedForOverlay("game-room-modals", suppressForModals)
    return () => setVkPersistentBannerSuppressedForOverlay("game-room-modals", false)
  }, [suppressForModals])

  useEffect(() => {
    if (!isVkMiniApp()) return

    const onVisibility = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState !== "visible") return
      void refreshVkPersistentBannerIfNotSuppressed()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])
}
