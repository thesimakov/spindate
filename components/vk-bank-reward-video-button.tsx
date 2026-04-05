"use client"

import { useCallback, useState, type CSSProperties } from "react"
import { Heart, Video } from "lucide-react"
import { useGame } from "@/lib/game-context"
import type { InlineToastType } from "@/hooks/use-inline-toast"
import { checkVkNativeAd, isVkMiniApp, showVkNativeAd } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

const VK_REWARD_HEARTS = 5

const btnShellStyle: CSSProperties = {
  border: "1px solid rgba(244, 63, 94, 0.45)",
  color: "#fecdd3",
  background: "linear-gradient(180deg, rgba(244, 63, 94, 0.22) 0%, rgba(136, 19, 55, 0.28) 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
}

/**
 * Компактная кнопка reward-рекламы VK: +5 ❤, иконка видео, подпись «Видео».
 * Рядом с кнопкой «+» в строке «Ваш банк».
 */
export function VkBankRewardVideoButton({
  className,
  onNotify,
}: {
  className?: string
  onNotify?: (message: string, type?: InlineToastType) => void
}) {
  const { dispatch } = useGame()
  const [busy, setBusy] = useState(false)

  const handleClick = useCallback(async () => {
    if (!isVkMiniApp() || busy) return
    setBusy(true)
    try {
      if (!(await checkVkNativeAd("reward"))) {
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
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className={cn(
        "flex h-8 min-w-[2.75rem] shrink-0 items-center gap-1 rounded-full px-1.5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40",
        className,
      )}
      style={btnShellStyle}
      title={`Видеореклама — +${VK_REWARD_HEARTS} сердец`}
      aria-label={`Смотреть видео за ${VK_REWARD_HEARTS} сердец`}
    >
      <Video className="h-3.5 w-3.5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
      <span className="flex min-w-0 flex-col items-start justify-center leading-none">
        <span className="flex items-center gap-px">
          <span className="text-[9px] font-black tabular-nums text-white">+{VK_REWARD_HEARTS}</span>
          <Heart className="h-2.5 w-2.5 shrink-0 fill-rose-400 text-rose-400" aria-hidden />
        </span>
        <span className="text-[6px] font-bold uppercase tracking-tight text-rose-100/90">
          {busy ? "…" : "Видео"}
        </span>
      </span>
    </button>
  )
}
