"use client"

import { useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import {
  checkVkNativeAd,
  isVkMiniApp,
  showVkBannerAdBottomCompact,
  showVkNativeAd,
} from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

type NativeMode = "reward" | "interstitial"

/**
 * Слот рекламы VK над чатом комнаты: баннер снизу окна при входе + кнопка нативной рекламы (reward или interstitial).
 */
export function VkChatAdBlock({ className }: { className?: string }) {
  const [nativeMode, setNativeMode] = useState<NativeMode | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isVkMiniApp()) return
    void (async () => {
      if (await checkVkNativeAd("reward")) setNativeMode("reward")
      else if (await checkVkNativeAd("interstitial")) setNativeMode("interstitial")
    })()
  }, [])

  useEffect(() => {
    if (!isVkMiniApp()) return
    if (typeof sessionStorage === "undefined") return
    const k = "spindate_vk_room_banner_once"
    if (sessionStorage.getItem(k) === "1") return
    sessionStorage.setItem(k, "1")
    void showVkBannerAdBottomCompact()
  }, [])

  if (!isVkMiniApp()) return null

  const handleShowNative = async () => {
    if (!nativeMode || busy) return
    setBusy(true)
    try {
      if (!(await checkVkNativeAd(nativeMode))) {
        setNativeMode(null)
        return
      }
      await showVkNativeAd(nativeMode)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-xl border border-cyan-500/25 bg-slate-900/55 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      style={{ background: "rgba(2,6,23,0.5)" }}
      aria-label="Реклама ВКонтакте"
    >
      <Megaphone className="h-4 w-4 shrink-0 text-cyan-400/80" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Реклама</p>
        <p className="truncate text-[11px] leading-tight text-slate-400">
          {nativeMode ? "Короткий ролик от партнёров VK" : "Баннер может отображаться внизу экрана"}
        </p>
      </div>
      {nativeMode && (
        <button
          type="button"
          onClick={() => void handleShowNative()}
          disabled={busy}
          className="shrink-0 rounded-lg border border-cyan-400/35 bg-cyan-600/90 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-cyan-500 disabled:opacity-40"
        >
          {busy ? "…" : "Смотреть"}
        </button>
      )}
    </div>
  )
}
