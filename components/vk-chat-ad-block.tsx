"use client"

import { useEffect } from "react"
import { initVkResilient, isVkMiniApp, showVkBannerAdCompact } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

const BANNER_ONCE_KEY = "spindate_vk_room_banner_once"

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Над чатом — визуальная метка; сам баннер ВК рисуется нативно по краю WebView (VKWebAppShowBannerAd).
 * Reward-видео за сердца — кнопка «Видео» в строке «Ваш банк» рядом с «+».
 */
export function VkChatAdBlock({ className }: { className?: string }) {
  useEffect(() => {
    if (!isVkMiniApp()) return
    if (typeof sessionStorage === "undefined") return
    if (sessionStorage.getItem(BANNER_ONCE_KEY) === "1") return

    let cancelled = false

    ;(async () => {
      await initVkResilient()
      if (cancelled) return

      const tryLocation = async (loc: "top" | "bottom"): Promise<boolean> => {
        return showVkBannerAdCompact({ banner_location: loc })
      }

      let ok = false
      for (let i = 0; i < 4 && !cancelled; i++) {
        ok = await tryLocation("top")
        if (ok) break
        await delay(500 + i * 350)
      }
      if (!ok && !cancelled) {
        for (let i = 0; i < 3 && !cancelled; i++) {
          ok = await tryLocation("bottom")
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

  if (!isVkMiniApp()) return null

  return (
    <div
      className={cn("max-h-full w-full min-w-0", className)}
      aria-label="Спонсоры ВКонтакте"
      title="Блок спонсоров: полоса показывается клиентом ВК у края окна (сверху или снизу), не внутри этой метки."
    >
      <div
        className="flex max-h-full min-h-0 w-full flex-col justify-center overflow-hidden rounded-xl border border-cyan-500/25 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(2,6,23,0.65) 0%, rgba(15,23,42,0.45) 50%, rgba(2,6,23,0.55) 100%)",
        }}
      >
        <div
          className="h-4 w-full max-h-full shrink-0 rounded-md opacity-[0.35]"
          style={{
            background:
              "repeating-linear-gradient(-45deg, rgba(34,211,238,0.12), rgba(34,211,238,0.12) 6px, transparent 6px, transparent 12px)",
          }}
          aria-hidden
        />
        <p className="shrink-0 pt-0.5 text-center text-[8px] font-semibold uppercase tracking-widest text-slate-500">
          Спонсоры
        </p>
      </div>
    </div>
  )
}
