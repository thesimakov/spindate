"use client"

import { useEffect } from "react"
import { initVkResilient, isVkMiniApp, showVkBannerAdCompact } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

/** Успешный первичный показ в этой вкладке — не дублировать цепочку при повторном входе в комнату. */
const BANNER_SESSION_OK_KEY = "spindate_vk_room_banner_initial_ok"

/** Нативная полоса у края WebView; `regular` — выше по высоте. */
const BANNER_OPTS = {
  layout_type: "resize" as const,
  height_type: "regular" as const,
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type VkBridgeEventDetail = { detail?: { type?: string } }

/**
 * Один экземпляр: первичный VKWebAppShowBannerAd (сначала bottom, затем top) + подписка на события баннера.
 */
export function useVkRoomBannerAd() {
  useEffect(() => {
    if (!isVkMiniApp()) return
    if (typeof sessionStorage === "undefined") return

    let cancelled = false
    let unsubscribe: (() => void) | null = null

    ;(async () => {
      await initVkResilient()
      if (cancelled) return

      try {
        const m = await import("@vkontakte/vk-bridge")
        const bridge = m.default
        if (bridge?.subscribe && bridge?.unsubscribe) {
          const handler = (event: VkBridgeEventDetail) => {
            const t = event?.detail?.type
            if (t === "VKWebAppBannerAdUpdated" || t === "VKWebAppBannerAdClosedByUser") {
              /* клиент VK обновил или закрыл полосу — без повторного Show */
            }
          }
          bridge.subscribe(handler)
          unsubscribe = () => bridge.unsubscribe(handler)
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return
      if (sessionStorage.getItem(BANNER_SESSION_OK_KEY) === "1") return

      const tryShow = async (loc: "top" | "bottom"): Promise<boolean> => {
        return showVkBannerAdCompact({ banner_location: loc, ...BANNER_OPTS })
      }

      let ok = false
      for (let i = 0; i < 4 && !cancelled; i++) {
        ok = await tryShow("bottom")
        if (ok) break
        await delay(500 + i * 350)
      }
      if (!ok && !cancelled) {
        for (let i = 0; i < 3 && !cancelled; i++) {
          ok = await tryShow("top")
          if (ok) break
          await delay(450 + i * 300)
        }
      }

      if (ok && !cancelled) sessionStorage.setItem(BANNER_SESSION_OK_KEY, "1")
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])
}

/**
 * Горизонтальный слот «Спонсоры»: широкая зона min 200px под визуальное совпадение с полосой VK (креатив рисует клиент).
 */
export function VkChatAdSlot({ className }: { className?: string }) {
  if (!isVkMiniApp()) return null

  return (
    <div
      className={cn("w-full min-w-0", className)}
      role="region"
      aria-label="Спонсоры ВКонтакте"
    >
      <div
        className={cn(
          "relative z-[1] flex w-full flex-col gap-2 rounded-lg border border-slate-600/45 p-2",
          "bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-[2px]",
        )}
      >
        <div className="flex w-full min-h-0 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Спонсоры</p>
          <p className="min-w-0 flex-1 text-right text-[10px] leading-snug text-slate-500/90">
            Реклама ВКонтакте — полоса у края окна; блок по ширине совпадает с зоной чата.
          </p>
        </div>

        <div
          className={cn(
            "flex min-h-[200px] w-full flex-col rounded-md border border-dashed border-slate-600/45",
            "bg-slate-900/40 px-2 py-2",
          )}
          aria-hidden
        />

        <p className="sr-only">
          Баннерная реклама VKWebAppShowBannerAd отображается нативным клиентом, не внутри этой вёрстки.
        </p>
      </div>
    </div>
  )
}

/** Слот + эффект в одном компоненте (для редких мест вне GameRoom). */
export function VkChatAdBlock({ className }: { className?: string }) {
  useVkRoomBannerAd()
  return <VkChatAdSlot className={className} />
}
