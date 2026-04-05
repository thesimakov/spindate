"use client"

import { useEffect } from "react"
import { appPath } from "@/lib/app-path"

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
    if (!CLIENT_BUILD || CLIENT_BUILD === "unknown" || CLIENT_BUILD === "dev") return

    let cancelled = false
    const pollMs = DEFAULT_POLL_MS

    const check = async () => {
      if (cancelled) return
      try {
        const res = await fetch(appPath("/api/client-build"), {
          cache: "no-store",
          credentials: "same-origin",
        })
        if (!res.ok) return
        const data = (await res.json().catch(() => null)) as { buildId?: string } | null
        const serverBuild = typeof data?.buildId === "string" ? data.buildId.trim() : ""
        if (!serverBuild || serverBuild === "unknown") return
        if (serverBuild !== CLIENT_BUILD) {
          window.location.reload()
        }
      } catch {
        /* офлайн / статический экспорт без API — не трогаем */
      }
    }

    const interval = window.setInterval(() => void check(), pollMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)
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
