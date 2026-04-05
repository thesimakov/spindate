"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Video } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
 * Кнопка reward-рекламы VK: только иконка видео, подсказка при наведении.
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
  const { currentUser, voiceBalance } = state
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={busy}
          className={cn(
            "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40",
            className,
          )}
          style={btnShellStyle}
          aria-label={`Видеореклама, до ${VK_REWARD_HEARTS} сердец`}
        >
          <Video className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[18rem] border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 shadow-xl"
      >
        <p className="text-[11px] font-semibold tabular-nums text-white">
          Точный баланс: {voiceBalance.toLocaleString("ru-RU")} ❤
        </p>
        <p className="mt-1.5 text-xs font-medium leading-snug">
          Видеореклама: до{" "}
          <span className="font-black tabular-nums text-cyan-300">+{VK_REWARD_HEARTS}</span> ❤ на баланс
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void handleClick()
          }}
          className="mt-2 w-full rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-2 py-1.5 text-center text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-50"
        >
          {busy ? "…" : "Посмотреть"}
        </button>
      </TooltipContent>
    </Tooltip>
  )
}
