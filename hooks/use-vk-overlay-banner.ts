"use client"

import { useEffect } from "react"
import { useGame } from "@/lib/game-context"
import { hideVkBannerAd, isVkRuntimeEnvironment, refreshVkPersistentHorizontalBanner } from "@/lib/vk-bridge"

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
    const HEARTBEAT_MS = 120_000
    let heartbeat: number | null = null

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

    void (async () => {
      const vkRuntime = await isVkRuntimeEnvironment()
      if (cancelled || !vkRuntime) return

      run()
      document.addEventListener("visibilitychange", onVisibility)
      window.addEventListener("focus", onFocus)
      window.addEventListener("pageshow", onPageShow)
      heartbeat = window.setInterval(run, HEARTBEAT_MS)
    })()

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
      if (heartbeat !== null) window.clearInterval(heartbeat)
    }
  }, [vipActive])
}

/** @deprecated Используйте {@link useVkMiniAppPersistentHorizontalBanner}; имя сохранено для GameRoom. */
export const useVkOverlayBannerInGameRoom = useVkMiniAppPersistentHorizontalBanner
