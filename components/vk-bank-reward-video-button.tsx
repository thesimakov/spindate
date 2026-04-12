"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Video } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGame } from "@/lib/game-context"
import type { InlineToastType } from "@/hooks/use-inline-toast"
import { apiFetch } from "@/lib/api-fetch"
import type { InventoryItem } from "@/lib/game-types"
import { vkAdRewardPostUrl } from "@/lib/persist-user-game-state"
import { isVkRuntimeEnvironment, showVkNativeAd } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

const VK_REWARD_HEARTS = 25
/** Временно `false`: сразу открывается ролик спонсора ВК без белого диалога с таймером. Вернуть `true`, чтобы снова показать предэкран. */
const REWARD_GATE_ENABLED = false
/** Длительность предэкрана при REWARD_GATE_ENABLED. */
const REWARD_GATE_SECONDS = 5

const btnShellStyle: CSSProperties = {
  border: "1px solid rgba(244, 63, 94, 0.45)",
  color: "#fecdd3",
  background: "linear-gradient(180deg, rgba(244, 63, 94, 0.22) 0%, rgba(136, 19, 55, 0.28) 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
}

/**
 * Кнопка reward от спонсоров VK: только иконка видео, подсказка при наведении.
 * Рядом с кнопкой «+» в строке «Ваш банк».
 * При REWARD_GATE_ENABLED: перед VK — диалог с таймером.
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
  const vipActive =
    !!currentUser?.isVip && (currentUser.vipUntilTs == null || currentUser.vipUntilTs > Date.now())
  const [busy, setBusy] = useState(false)
  const [vkEnv, setVkEnv] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)
  const [gateSecondsLeft, setGateSecondsLeft] = useState(REWARD_GATE_SECONDS)

  useEffect(() => {
    let cancelled = false
    void isVkRuntimeEnvironment().then((ok) => {
      if (!cancelled && ok) setVkEnv(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!REWARD_GATE_ENABLED || !gateOpen) return
    setGateSecondsLeft(REWARD_GATE_SECONDS)
    let left = REWARD_GATE_SECONDS
    const id = window.setInterval(() => {
      left -= 1
      setGateSecondsLeft(Math.max(0, left))
      if (left <= 0) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [gateOpen])

  const gateReady = gateSecondsLeft <= 0

  const runAdAndClaim = useCallback(async () => {
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
            `+${g} сердец — награда с сервера (спонсоры недоступны или тестовый режим)`,
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

  const openGate = useCallback(async () => {
    if (busy) return
    if (!(await isVkRuntimeEnvironment())) return
    if (!currentUser || currentUser.authProvider !== "vk") {
      onNotify?.("Войдите через ВКонтакте", "info")
      return
    }
    if (!REWARD_GATE_ENABLED) {
      void runAdAndClaim()
      return
    }
    setGateOpen(true)
  }, [busy, currentUser, onNotify, runAdAndClaim])

  if (!vkEnv || !currentUser || currentUser.authProvider !== "vk" || vipActive) return null

  return (
    <>
      {REWARD_GATE_ENABLED && (
        <Dialog
          open={gateOpen}
          onOpenChange={(o) => {
            if (!o && !gateReady) return
            setGateOpen(o)
          }}
        >
          <DialogContent
            showCloseButton={false}
            className={cn(
              "max-w-[min(calc(100vw-1.5rem),20rem)] gap-5 rounded-2xl border-0 bg-white p-6 text-center shadow-xl",
              "text-slate-900 sm:max-w-sm",
            )}
            overlayClassName="bg-black/60"
            onPointerDownOutside={(e) => {
              if (!gateReady) e.preventDefault()
            }}
            onEscapeKeyDown={(e) => {
              if (!gateReady) e.preventDefault()
            }}
          >
            <DialogHeader className="gap-2 text-center">
              <DialogTitle className="sr-only">Просмотр спонсорского ролика</DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-600">
                Посмотрите ролик — награда начислится на баланс. Через пару секунд откроется окно ВКонтакте.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={!gateReady || busy}
                className={cn(
                  "w-full rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45",
                  "bg-[#0077ff] hover:enabled:bg-[#0066dd]",
                )}
                onClick={() => {
                  if (!gateReady || busy) return
                  setGateOpen(false)
                  void runAdAndClaim()
                }}
              >
                {gateReady ? "Продолжить просмотр" : `Продолжить просмотр (${gateSecondsLeft} с)`}
              </button>
              <button
                type="button"
                disabled={!gateReady || busy}
                className={cn(
                  "text-center text-sm text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-40",
                  gateReady && "hover:text-slate-700",
                )}
                onClick={() => {
                  if (!gateReady || busy) return
                  setGateOpen(false)
                }}
              >
                Отказаться от награды
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void openGate()}
            disabled={busy}
            className={cn(
              "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40",
              className,
            )}
            style={btnShellStyle}
            aria-label={`Спонсорское видео, до ${VK_REWARD_HEARTS} сердец`}
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
            Спонсорское видео: до{" "}
            <span className="font-black tabular-nums text-cyan-300">+{VK_REWARD_HEARTS}</span> ❤ на баланс
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void openGate()
            }}
            className="mt-2 w-full rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-2 py-1.5 text-center text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {busy ? "…" : "Посмотреть"}
          </button>
        </TooltipContent>
      </Tooltip>
    </>
  )
}
