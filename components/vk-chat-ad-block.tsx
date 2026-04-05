"use client"

import { useCallback, useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { useGame } from "@/lib/game-context"
import type { InlineToastType } from "@/hooks/use-inline-toast"
import {
  checkVkNativeAd,
  isVkMiniApp,
  showVkBannerAdBottomCompact,
  showVkNativeAd,
} from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

const VK_REWARD_HEARTS = 5

/**
 * Слот под баннерную рекламу VK над чатом (до 20% высоты стека) + кнопка reward-рекламы за сердца.
 */
export function VkChatAdBlock({
  className,
  onNotify,
}: {
  className?: string
  onNotify?: (message: string, type?: InlineToastType) => void
}) {
  const { dispatch } = useGame()
  const [rewardOk, setRewardOk] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isVkMiniApp()) return
    void (async () => {
      setRewardOk(await checkVkNativeAd("reward"))
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

  const handleRewardAd = useCallback(async () => {
    if (!isVkMiniApp() || busy) return
    setBusy(true)
    try {
      if (!(await checkVkNativeAd("reward"))) {
        setRewardOk(false)
        onNotify?.("Сейчас нет рекламы с наградой", "info")
        return
      }
      const ok = await showVkNativeAd("reward")
      if (ok) {
        dispatch({ type: "ADD_VOICES", amount: VK_REWARD_HEARTS })
        onNotify?.(`+${VK_REWARD_HEARTS} сердец за просмотр`, "success")
      } else {
        onNotify?.("Награда не начислена — досмотрите рекламу до конца", "info")
      }
    } finally {
      setBusy(false)
    }
  }, [busy, dispatch, onNotify])

  if (!isVkMiniApp()) return null

  return (
    <div className={cn("max-h-full w-full min-w-0", className)} aria-label="Реклама ВКонтакте">
      <div
        className="flex max-h-full min-h-0 w-full flex-row items-stretch gap-1.5 overflow-hidden rounded-xl border border-cyan-500/25 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(2,6,23,0.65) 0%, rgba(15,23,42,0.45) 50%, rgba(2,6,23,0.55) 100%)",
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden">
          <div
            className="h-4 w-full max-h-full shrink-0 rounded-md opacity-[0.35]"
            style={{
              background:
                "repeating-linear-gradient(-45deg, rgba(34,211,238,0.12), rgba(34,211,238,0.12) 6px, transparent 6px, transparent 12px)",
            }}
            aria-hidden
          />
          <p className="shrink-0 pt-0.5 text-center text-[8px] font-semibold uppercase tracking-widest text-slate-500">
            Реклама
          </p>
        </div>
        {rewardOk && (
          <button
            type="button"
            onClick={() => void handleRewardAd()}
            disabled={busy}
            className="flex shrink-0 flex-col items-center justify-center gap-0 rounded-lg border border-rose-400/40 bg-rose-950/50 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-rose-100 transition-colors hover:bg-rose-900/55 disabled:opacity-40"
            aria-label={`Реклама за ${VK_REWARD_HEARTS} сердец`}
          >
            <span className="flex items-center gap-0.5 whitespace-nowrap">
              <span className="tabular-nums">+{VK_REWARD_HEARTS}</span>
              <Heart className="h-2.5 w-2.5 fill-rose-400 text-rose-400" aria-hidden />
            </span>
            <span className="text-[7px] font-semibold uppercase tracking-tight text-rose-200/80">
              {busy ? "…" : "Видео"}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
