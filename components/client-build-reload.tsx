"use client"

import { useEffect } from "react"
import { apiFetch } from "@/lib/api-fetch"

/** Вшивается в бандл при `next build` (см. `next.config.mjs`). */
const CLIENT_BUILD = (process.env.NEXT_PUBLIC_BUILD_ID ?? "").trim()

const DEFAULT_POLL_MS = 45_000

/**
 * Периодически спрашивает сервер актуальную сборку; если на сервере другая — полная перезагрузка страницы.
 * Так все игроки подтягивают новый JS/CSS после деплоя без ручного «выйти и зайти».
 */
export function ClientBuildReload() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (process.env.NODE_ENV === "development") return
    if (!CLIENT_BUILD || CLIENT_BUILD === "unknown") return

    let cancelled = false
    const pollMs = DEFAULT_POLL_MS

    const check = async () => {
      if (cancelled) return
      try {
        // #region agent log
        fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H1',location:'components/client-build-reload.tsx:28',message:'client-build check start',data:{clientBuild:CLIENT_BUILD,url:window.location.href},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const res = await apiFetch("/api/client-build", {
          cache: "no-store",
        })
        if (!res.ok) {
          // #region agent log
          fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H2',location:'components/client-build-reload.tsx:33',message:'client-build response not ok',data:{status:res.status,statusText:res.statusText},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          return
        }
        const data = (await res.json().catch(() => null)) as { buildId?: string } | null
        const serverBuild = typeof data?.buildId === "string" ? data.buildId.trim() : ""
        if (!serverBuild || serverBuild === "unknown") return
        if (serverBuild !== CLIENT_BUILD) {
          // #region agent log
          fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H1',location:'components/client-build-reload.tsx:41',message:'client-build mismatch reload',data:{clientBuild:CLIENT_BUILD,serverBuild},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          window.location.reload()
        }
      } catch {
        // #region agent log
        fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec43d5'},body:JSON.stringify({sessionId:'ec43d5',runId:'pre-fix',hypothesisId:'H2',location:'components/client-build-reload.tsx:46',message:'client-build check threw',data:{},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        /* офлайн / статический экспорт без API — не трогаем */
      }
    }

    const interval = window.setInterval(() => void check(), pollMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)
    queueMicrotask(() => void check())
    const t0 = window.setTimeout(() => void check(), 12_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearTimeout(t0)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return null
}
