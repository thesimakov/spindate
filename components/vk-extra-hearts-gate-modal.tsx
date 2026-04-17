"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { InlineToast } from "@/components/ui/inline-toast"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { useGame } from "@/lib/game-context"
import { persistUserGameState } from "@/lib/persist-user-game-state"
import {
  emptyVkExtraHeartsGateProgress,
  readVkExtraHeartsGateProgress,
  VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION,
  type VkExtraHeartsGateAction,
  type VkExtraHeartsGateProgress,
  writeVkExtraHeartsGateProgress,
} from "@/lib/vk-extra-hearts-gate-constants"
import {
  addVkAppToFavorites,
  initVkResilient,
  isVkRuntimeEnvironment,
  joinVkCommunityGroup,
  openVkUrl,
  readVkAreNotificationsEnabledFromVkLaunch,
  requestVkAllowNotifications,
  SPINDATE_VK_EXTRA_HEARTS_NOTIFY_UNLOCK_EVENT,
  VK_COMMUNITY_PUBLIC_URL,
} from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

type VkExtraHeartsGateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VkExtraHeartsGateModal({ open, onOpenChange }: VkExtraHeartsGateModalProps) {
  const { state, dispatch } = useGame()
  const currentUser = state.currentUser
  const { toast, showToast } = useInlineToast(2200)
  const [rowBusy, setRowBusy] = useState<"fav" | "group" | "notify" | null>(null)
  const [progress, setProgress] = useState<VkExtraHeartsGateProgress>(emptyVkExtraHeartsGateProgress)

  useEffect(() => {
    if (!currentUser) return
    setProgress(readVkExtraHeartsGateProgress(currentUser.id))
  }, [currentUser?.id])

  const unlockNotifyRowIfNeeded = useCallback(async () => {
    if (!currentUser) return
    const p = readVkExtraHeartsGateProgress(currentUser.id)
    if (!p.notify) return
    if (!(await isVkRuntimeEnvironment())) return
    const enabled = await readVkAreNotificationsEnabledFromVkLaunch()
    if (enabled !== false) return
    const next = { ...p, notify: false }
    setProgress(next)
    writeVkExtraHeartsGateProgress(currentUser.id, next)
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser) return
    const onUnlockFromDeny = () => {
      const p = readVkExtraHeartsGateProgress(currentUser.id)
      if (!p.notify) return
      const next = { ...p, notify: false }
      setProgress(next)
      writeVkExtraHeartsGateProgress(currentUser.id, next)
    }
    window.addEventListener(SPINDATE_VK_EXTRA_HEARTS_NOTIFY_UNLOCK_EVENT, onUnlockFromDeny)
    return () => window.removeEventListener(SPINDATE_VK_EXTRA_HEARTS_NOTIFY_UNLOCK_EVENT, onUnlockFromDeny)
  }, [currentUser?.id])

  useEffect(() => {
    if (!open || !currentUser) return
    void unlockNotifyRowIfNeeded()
  }, [open, currentUser?.id, unlockNotifyRowIfNeeded])

  useEffect(() => {
    if (!open || !currentUser) return
    const onRefocus = () => {
      void unlockNotifyRowIfNeeded()
    }
    window.addEventListener("focus", onRefocus)
    document.addEventListener("visibilitychange", onRefocus)
    return () => {
      window.removeEventListener("focus", onRefocus)
      document.removeEventListener("visibilitychange", onRefocus)
    }
  }, [open, currentUser?.id, unlockNotifyRowIfNeeded])

  const completedCount = useMemo(
    () => (progress.fav ? 1 : 0) + (progress.group ? 1 : 0) + (progress.notify ? 1 : 0),
    [progress],
  )

  const grantRewardForAction = useCallback(async (
    action: VkExtraHeartsGateAction,
    actionTitle: string,
  ) => {
    if (!currentUser) return
    if (progress[action]) return

    const nextProgress: VkExtraHeartsGateProgress = { ...progress, [action]: true }
    setProgress(nextProgress)
    writeVkExtraHeartsGateProgress(currentUser.id, nextProgress)

    const nextVoice = state.voiceBalance + VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION
    dispatch({ type: "PAY_VOICES", amount: -VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION })

    void persistUserGameState(currentUser, nextVoice, state.inventory).catch(() => {
      showToast("Награда начислена, но сервер пока недоступен. Синхронизируем позже.", "info")
    })

    showToast(`Готово: +${VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION} ❤`, "success")
  }, [currentUser, dispatch, progress, showToast, state.inventory, state.voiceBalance])

  const handleAddFavorites = useCallback(async () => {
    if (progress.fav) return
    setRowBusy("fav")
    try {
      await initVkResilient()
      if (await isVkRuntimeEnvironment()) {
        const ok = await addVkAppToFavorites()
        if (!ok) {
          showToast("Не удалось открыть окно (нужна модерация приложения)", "info")
          return
        }
        await grantRewardForAction("fav", "Добавить игру в Избранное")
      } else {
        showToast("Вне VK мини-приложения шаг засчитан автоматически.", "info")
        await grantRewardForAction("fav", "Добавить игру в Избранное")
      }
    } finally {
      setRowBusy(null)
    }
  }, [grantRewardForAction, progress.fav, showToast])

  const handleJoinGroup = useCallback(async () => {
    if (progress.group) return
    setRowBusy("group")
    try {
      await initVkResilient()
      if (await isVkRuntimeEnvironment()) {
        const { ok } = await joinVkCommunityGroup()
        if (!ok) {
          showToast("Не удалось открыть окно ВК", "info")
          return
        }
        await grantRewardForAction("group", "Вступить в группу игры")
      } else {
        const opened = await openVkUrl(VK_COMMUNITY_PUBLIC_URL)
        if (!opened) {
          showToast("Не удалось открыть ссылку", "info")
          return
        }
        await grantRewardForAction("group", "Вступить в группу игры")
      }
    } finally {
      setRowBusy(null)
    }
  }, [grantRewardForAction, progress.group, showToast])

  const handleAllowNotifications = useCallback(async () => {
    if (progress.notify) return
    setRowBusy("notify")
    try {
      await initVkResilient()
      if (await isVkRuntimeEnvironment()) {
        const { ok } = await requestVkAllowNotifications()
        if (!ok) {
          showToast("Не удалось открыть запрос разрешения", "info")
          return
        }
        await grantRewardForAction("notify", "Подписаться на сообщения от игры")
      } else {
        showToast("Вне VK мини-приложения шаг засчитан автоматически.", "info")
        await grantRewardForAction("notify", "Подписаться на сообщения от игры")
      }
    } finally {
      setRowBusy(null)
    }
  }, [grantRewardForAction, progress.notify, showToast])

  return (
    <>
      {toast ? <InlineToast toast={toast} className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 z-[200] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2" /> : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/45 backdrop-blur-[2px]"
          className="max-w-[min(22rem,calc(100vw-1.5rem))] gap-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-0 shadow-2xl"
        >
          <DialogTitle className="sr-only">Дополнительные сердечки</DialogTitle>

          <div className="relative px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
            <DialogClose
              className={cn(
                "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-500 bg-white text-slate-800 shadow-md transition hover:bg-emerald-50 active:scale-95",
              )}
              aria-label="Закрыть"
            >
              <X className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.5} />
            </DialogClose>

            <h2 className="pr-10 text-center text-xl font-extrabold tracking-tight text-slate-900">
              Бесплатные сердечки!
            </h2>
            <div className="mt-2 flex justify-center">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                Прогресс: {completedCount}/3
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <TaskRow
                label="Добавить игру в Избранное"
                actionLabel="Добавить"
                busy={rowBusy === "fav"}
                done={progress.fav}
                disabled={progress.fav || (rowBusy !== null && rowBusy !== "fav")}
                onClick={() => void handleAddFavorites()}
              />
              <TaskRow
                label="Вступить в группу игры"
                actionLabel="Вступить"
                busy={rowBusy === "group"}
                done={progress.group}
                disabled={progress.group || (rowBusy !== null && rowBusy !== "group")}
                onClick={() => void handleJoinGroup()}
              />
              <TaskRow
                label="Подписаться на сообщения от игры"
                actionLabel="Подписаться"
                busy={rowBusy === "notify"}
                done={progress.notify}
                disabled={progress.notify || (rowBusy !== null && rowBusy !== "notify")}
                onClick={() => void handleAllowNotifications()}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TaskRow({
  label,
  actionLabel,
  onClick,
  busy,
  disabled,
  done,
}: {
  label: string
  actionLabel: string
  onClick: () => void
  busy: boolean
  disabled: boolean
  done: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-slate-800">{label}</span>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onClick}
        className={cn(
          "shrink-0 rounded-lg px-3 py-2 text-[13px] font-bold text-white shadow-sm transition",
          done
            ? "bg-slate-300 text-slate-600 shadow-none"
            : "bg-gradient-to-b from-[#4ade80] to-[#22c55e] hover:brightness-105 active:scale-[0.98]",
          (disabled || busy) && "pointer-events-none opacity-60",
        )}
      >
        {busy ? "…" : done ? "Получено +5❤" : actionLabel}
      </button>
    </div>
  )
}
