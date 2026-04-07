"use client"

import { useEffect } from "react"
import { initVkResilient, isVkMiniApp, showVkBannerAdHorizontalPersistent } from "@/lib/vk-bridge"

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function tryShowVkHorizontalBanner(): Promise<void> {
  await initVkResilient()
  for (let i = 0; i < 3; i++) {
    const ok = await showVkBannerAdHorizontalPersistent()
    if (ok) break
    await delay(400 + i * 250)
  }
}

/**
 * Горизонтальный баннер VK (`layout_type: overlay`, `can_close: false`).
 * Без лимита «раз за сессию»; повторный запрос при возврате на вкладку, если WebView свернули.
 */
export function useVkOverlayBannerInGameRoom() {
  useEffect(() => {
    if (!isVkMiniApp()) return

    let cancelled = false

    const run = () => {
      if (cancelled) return
      void tryShowVkHorizontalBanner()
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
