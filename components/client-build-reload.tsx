"use client"

import { useEffect } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { isVkMiniApp, refreshVkPersistentHorizontalBanner } from "@/lib/vk-bridge"

/** Вшивается в бандл при `next build` (см. `next.config.mjs`). */
const CLIENT_BUILD = (process.env.NEXT_PUBLIC_BUILD_ID ?? "").trim()

const DEFAULT_POLL_MS = 45_000
const RELOAD_GUARD_KEY = "spindate_reload_guard_v1"
const RELOAD_GUARD_WINDOW_MS = 2 * 60_000

/**
 * Периодически спрашивает сервер актуальную сборку; если на сервере другая — полная перезагрузка страницы.
 * Так все игроки подтягивают новый JS/CSS после деплоя без ручного «выйти и зайти».
 */
export function ClientBuildReload() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (process.env.NODE_ENV === "development") return
    if (!CLIENT_BUILD || CLIENT_BUILD === "unknown") return
    // GitHub Pages собирается отдельно от VPS, build-id почти всегда отличается.
    // Иначе получится бесконечный reload при сравнении с /api/client-build на боевом сервере.
    if (window.location.hostname.endsWith("github.io")) return

    let cancelled = false
    const pollMs = DEFAULT_POLL_MS
    let reloadInProgress = false

    const check = async () => {
      if (cancelled || reloadInProgress) return
      try {
        const res = await apiFetch("/api/client-build", {
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json().catch(() => null)) as { buildId?: string } | null
        const serverBuild = typeof data?.buildId === "string" ? data.buildId.trim() : ""
        if (!serverBuild || serverBuild === "unknown") return
        if (serverBuild !== CLIENT_BUILD) {
          const now = Date.now()
          try {
            const raw = sessionStorage.getItem(RELOAD_GUARD_KEY)
            if (raw) {
              const parsed = JSON.parse(raw) as {
                at?: number
                clientBuild?: string
                serverBuild?: string
              }
              const samePair =
                parsed.clientBuild === CLIENT_BUILD &&
                parsed.serverBuild === serverBuild
              if (samePair && typeof parsed.at === "number" && now - parsed.at < RELOAD_GUARD_WINDOW_MS) {
                return
              }
            }
          } catch {
            // ignore storage parse errors
          }

          reloadInProgress = true
          try {
            sessionStorage.setItem(
              RELOAD_GUARD_KEY,
              JSON.stringify({ at: now, clientBuild: CLIENT_BUILD, serverBuild }),
            )
          } catch {
            // ignore storage failures
          }

          if (isVkMiniApp()) {
            try {
              await refreshVkPersistentHorizontalBanner()
            } catch {
              // best-effort before reload
            }
          }
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
