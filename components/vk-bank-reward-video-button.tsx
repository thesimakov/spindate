"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Heart, Video } from "lucide-react"
import { useGame } from "@/lib/game-context"
import type { InlineToastType } from "@/hooks/use-inline-toast"
import { apiFetch } from "@/lib/api-fetch"
import type { InventoryItem } from "@/lib/game-types"
import { vkAdRewardPostUrl } from "@/lib/persist-user-game-state"
import { isVkRuntimeEnvironment, showVkNativeAd } from "@/lib/vk-bridge"
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
 * При нажатии всегда запрашиваем показ; если ролик недоступен / тест / ошибка — всё равно начисляем обещанные сердца.
 */
export function VkBankRewardVideoButton({
  className,
  onNotify,
}: {
  className?: string
  onNotify?: (message: string, type?: InlineToastType) => void
}) {
  const { dispatch, state } = useGame()
  const { currentUser } = state
  const [busy, setBusy] = useState(false)
  const [vkEnv, setVkEnv] = useState(false)

  useEffect(() => {
    let cancelled = false
    void isVkRuntimeEnvironment().then((ok) => {
      if (!cancelled && ok) setVkEnv(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleClick = useCallback(async () => {
    if (busy) return
    if (!(await isVkRuntimeEnvironment())) return
    if (!currentUser || currentUser.authProvider !== "vk") {
      onNotify?.("Войдите через ВКонтакте", "info")
      return
    }
    const postUrl = vkAdRewardPostUrl(currentUser)
    if (!postUrl) {
      onNotify?.("Не удалось определить профиль ВК", "info")
      return
    }
    setBusy(true)
    try {
      let shownOk = false
      try {
        shownOk = await showVkNativeAd("reward")
      } catch {
        shownOk = false
      }
      const res = await apiFetch(postUrl, { method: "POST", credentials: "include" })
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        voiceBalance?: number
        inventory?: unknown[]
        error?: string
        granted?: number
      } | null
      if (res.ok && data?.ok === true && typeof data.voiceBalance === "number") {
        dispatch({
          type: "RESTORE_GAME_STATE",
          voiceBalance: data.voiceBalance,
          inventory: Array.isArray(data.inventory) ? (data.inventory as InventoryItem[]) : [],
        })
        const g = typeof data.granted === "number" ? data.granted : VK_REWARD_HEARTS
        if (shownOk) {
          onNotify?.(`+${g} сердец за просмотр`, "success")
        } else {
          onNotify?.(
            `+${g} сердец — награда с сервера (реклама недоступна или тестовый режим)`,
            "success",
          )
        }
      } else if (res.status === 429 && data?.error) {
        onNotify?.(data.error, "info")
      } else {
        onNotify?.(data?.error ?? "Не удалось начислить награду", "info")
      }
    } finally {
      setBusy(false)
    }
  }, [busy, currentUser, dispatch, onNotify])

  if (!vkEnv || !currentUser || currentUser.authProvider !== "vk") return null

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
