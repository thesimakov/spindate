"use client"

import { useEffect } from "react"
import { isVkMiniApp, showVkBannerAdBottomCompact } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

/**
 * Слот под баннерную рекламу VK над чатом: ширина как у чата; высота не больше 20% общего блока (задаётся родителем).
 * Реальный баннер VK отрисовывается клиентом внизу окна (VKWebAppShowBannerAd + resize).
 */
export function VkChatAdBlock({ className }: { className?: string }) {
  useEffect(() => {
    if (!isVkMiniApp()) return
    if (typeof sessionStorage === "undefined") return
    const k = "spindate_vk_room_banner_once"
    if (sessionStorage.getItem(k) === "1") return
    sessionStorage.setItem(k, "1")
    void showVkBannerAdBottomCompact()
  }, [])

  if (!isVkMiniApp()) return null

  return (
    <div className={cn("max-h-full w-full min-w-0", className)} aria-label="Реклама ВКонтакте">
      <div
        className="flex max-h-full min-h-0 w-full flex-col justify-center overflow-hidden rounded-xl border border-cyan-500/25 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(2,6,23,0.65) 0%, rgba(15,23,42,0.45) 50%, rgba(2,6,23,0.55) 100%)",
        }}
      >
        <div
          className="mx-auto h-6 w-full max-h-[min(100%,3rem)] shrink-0 rounded-md opacity-[0.35]"
          style={{
            background:
              "repeating-linear-gradient(-45deg, rgba(34,211,238,0.12), rgba(34,211,238,0.12) 6px, transparent 6px, transparent 12px)",
          }}
          aria-hidden
        />
        <p className="shrink-0 pt-1 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-500">
          Реклама
        </p>
      </div>
    </div>
  )
}
