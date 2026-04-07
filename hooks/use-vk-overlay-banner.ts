"use client"

import { useEffect } from "react"
import { initVkResilient, isVkMiniApp, showVkBannerAdOverlayRightVertical } from "@/lib/vk-bridge"

const SESSION_KEY = "spindate_vk_overlay_banner_session_ok"

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Один показ баннера VK: overlay справа, vertical (см. документацию баннеров). */
export function useVkOverlayBannerInGameRoom() {
  useEffect(() => {
    if (!isVkMiniApp()) return
    if (typeof sessionStorage === "undefined") return
    if (sessionStorage.getItem(SESSION_KEY) === "1") return

    let cancelled = false

    ;(async () => {
      await initVkResilient()
      if (cancelled) return

      let ok = false
      for (let i = 0; i < 3 && !cancelled && !ok; i++) {
        ok = await showVkBannerAdOverlayRightVertical()
        if (ok) break
        await delay(400 + i * 250)
      }

      if (ok && !cancelled) sessionStorage.setItem(SESSION_KEY, "1")
    })()

    return () => {
      cancelled = true
    }
  }, [])
}
