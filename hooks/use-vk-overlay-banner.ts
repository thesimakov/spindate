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
    fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H1',location:'hooks/use-vk-overlay-banner.ts:13',message:'banner hook mount check',data:{vkMini,visibility:typeof document!=='undefined'?document.visibilityState:'no-document'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!vkMini) return

    let cancelled = false

    const run = () => {
      if (cancelled) return
      // #region agent log
      fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H2',location:'hooks/use-vk-overlay-banner.ts:21',message:'banner hook run refresh',data:{cancelled},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      void refreshVkPersistentHorizontalBanner()
    }

    run()

    const onVisibility = () => {
      if (cancelled || typeof document === "undefined") return
      // #region agent log
      fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H1',location:'hooks/use-vk-overlay-banner.ts:30',message:'visibilitychange observed',data:{visibilityState:document.visibilityState,cancelled},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
