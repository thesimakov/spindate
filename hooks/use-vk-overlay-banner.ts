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
    // #region agent log
    fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'banner-rootcause-1',hypothesisId:'H2',location:'hooks/use-vk-overlay-banner.ts:13',message:'vk banner hook evaluated',data:{vkMini},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!vkMini) return

    let cancelled = false
    let running = false
    const HEARTBEAT_MS = 120_000

    const run = () => {
      if (cancelled || running) return
      // #region agent log
      fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'banner-rootcause-1',hypothesisId:'H2',location:'hooks/use-vk-overlay-banner.ts:22',message:'vk banner run invoked',data:{cancelled,running,visibility:typeof document!=='undefined'?document.visibilityState:'na'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
