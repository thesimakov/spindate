"use client"

import { useEffect } from "react"
import { initVkResilient, isVkMiniApp, showVkBannerAdCompact } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

const BANNER_ONCE_KEY = "spindate_vk_room_banner_once"

/** Параметры показа: нативный баннер у края WebView, `resize` — область приложения сжимается под полосу. */
const BANNER_OPTS = {
  layout_type: "resize" as const,
  height_type: "compact" as const,
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Один вызов цепочки VKWebAppShowBannerAd на монтирование GameRoom (не дублировать в двух колонках).
 */
export function useVkRoomBannerAd() {
  useEffect(() => {
    if (!isVkMiniApp()) return
    if (typeof sessionStorage === "undefined") return
    if (sessionStorage.getItem(BANNER_ONCE_KEY) === "1") return

    let cancelled = false

    ;(async () => {
      await initVkResilient()
      if (cancelled) return

      const tryShow = async (loc: "top" | "bottom"): Promise<boolean> => {
        return showVkBannerAdCompact({ banner_location: loc, ...BANNER_OPTS })
      }

      let ok = false
      for (let i = 0; i < 4 && !cancelled; i++) {
        ok = await tryShow("top")
        if (ok) break
        await delay(500 + i * 350)
      }
      if (!ok && !cancelled) {
        for (let i = 0; i < 3 && !cancelled; i++) {
          ok = await tryShow("bottom")
          if (ok) break
          await delay(450 + i * 300)
        }
      }

      if (ok && !cancelled) sessionStorage.setItem(BANNER_ONCE_KEY, "1")
    })()

    return () => {
      cancelled = true
    }
  }, [])
}

/**
 * Визуальный слот «Спонсоры» над чатом (без побочных эффектов моста).
 * Нативный креатив VK не встраивается в div.
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
          "relative z-[1] flex w-full min-h-[3rem] max-h-[min(7rem,22vh)] flex-col justify-center rounded-lg border border-slate-600/45",
          "bg-slate-950/55 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-[2px]",
          "sm:min-h-[3.25rem]",
        )}
      >
        <p className="text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Спонсоры</p>
        <p className="mt-1 max-w-full text-center text-[10px] leading-snug text-slate-500/90">
          Рекламная полоса открывается клиентом ВК у верхнего или нижнего края окна приложения, не внутри этой
          рамки.
        </p>
        <p className="sr-only">Спонсоры: нативный баннер у края WebView после VKWebAppShowBannerAd.</p>
      </div>
    </div>
  )
}

/** Слот + эффект в одном компоненте (для редких мест вне GameRoom). */
export function VkChatAdBlock({ className }: { className?: string }) {
  useVkRoomBannerAd()
  return <VkChatAdSlot className={className} />
}
