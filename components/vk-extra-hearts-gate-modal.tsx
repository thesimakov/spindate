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
  readVkIsFavoriteFromVkLaunch,
  readVkIsCommunityMemberFromVkLaunch,
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
  const [checkingStatuses, setCheckingStatuses] = useState(false)
  const [groupMembership, setGroupMembership] = useState<boolean | null>(null)

  useEffect(() => {
    if (!currentUser) return
    setProgress(readVkExtraHeartsGateProgress(currentUser.id))
  }, [currentUser?.id])

  const checkVkGroupMembership = useCallback(async (): Promise<{
    member: boolean | null
    source: "server" | "launch" | "unknown"
    reason?: string
    error?: string
  }> => {
    if (!currentUser) return { member: null, source: "unknown" }
    const vkUserId = currentUser.vkUserId ?? null
    const launchMembership = await readVkIsCommunityMemberFromVkLaunch().catch(() => null)
    const endpoint = vkUserId != null ? `/api/vk/group-membership?vk_user_id=${encodeURIComponent(String(vkUserId))}` : "/api/vk/group-membership"
    let result:
      | { member: boolean | null; source: "server" | "launch" | "unknown"; reason?: string; error?: string }
      | null = null
    try {
      // Для VK-пользователей явно передаём vk_user_id: в mini app cookie-сессия может отсутствовать.
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; isMember?: boolean; reason?: string; error?: string }
        | null
      if (res.ok && data?.ok === true && typeof data.isMember === "boolean") {
        result = { member: data.isMember, source: "server" }
      } else if (typeof launchMembership === "boolean") {
        result = { member: launchMembership, source: "launch", reason: data?.reason }
      } else {
        result = { member: null, source: "unknown", reason: data?.reason, error: data?.error }
      }
    } catch {
      if (typeof launchMembership === "boolean") {
        result = { member: launchMembership, source: "launch", reason: "fetch_failed" }
      } else {
        result = { member: null, source: "unknown", reason: "fetch_failed", error: "Сервер не отвечает" }
      }
    }
    return result
  }, [currentUser?.id, currentUser?.vkUserId])

  const unlockRowsIfNeeded = useCallback(async () => {
    if (!currentUser) return
    const startedAt = Date.now()
    setCheckingStatuses(true)
    const p = readVkExtraHeartsGateProgress(currentUser.id)
    try {
      let changed = false
      const next = { ...p }

      const groupCheck = await checkVkGroupMembership()
      setGroupMembership(groupCheck.member)
      if (p.group && groupCheck.member === false) {
        next.group = false
        changed = true
      }

      const runtime = await isVkRuntimeEnvironment()
      if (!runtime) {
        if (changed) {
          setProgress(next)
          writeVkExtraHeartsGateProgress(currentUser.id, next)
        }
        return
      }

      if (p.notify) {
        const enabled = await readVkAreNotificationsEnabledFromVkLaunch()
        if (enabled === false) {
          next.notify = false
          changed = true
        }
      }
      if (p.fav) {
        const favorite = await readVkIsFavoriteFromVkLaunch()
        if (favorite === false) {
          next.fav = false
          changed = true
        }
      }
      if (!changed) return
      setProgress(next)
      writeVkExtraHeartsGateProgress(currentUser.id, next)
    } finally {
      const minVisibleMs = 250
      const elapsed = Date.now() - startedAt
      if (elapsed < minVisibleMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, minVisibleMs - elapsed))
      }
      setCheckingStatuses(false)
    }
  }, [currentUser?.id, checkVkGroupMembership])

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
    void unlockRowsIfNeeded()
  }, [open, currentUser?.id, unlockRowsIfNeeded])

  useEffect(() => {
    if (!open || !currentUser) return
    const onRefocus = () => {
      void unlockRowsIfNeeded()
    }
    window.addEventListener("focus", onRefocus)
    document.addEventListener("visibilitychange", onRefocus)
    return () => {
      window.removeEventListener("focus", onRefocus)
      document.removeEventListener("visibilitychange", onRefocus)
    }
  }, [open, currentUser?.id, unlockRowsIfNeeded])

  const completedCount = useMemo(
    () => (progress.fav ? 1 : 0) + (progress.group ? 1 : 0) + (progress.notify ? 1 : 0),
    [progress],
  )
  const groupNeedsResubscribe = progress.group && groupMembership !== true
  const groupTaskDone = progress.group && !groupNeedsResubscribe

  const grantRewardForAction = useCallback(async (
    action: VkExtraHeartsGateAction,
    _actionTitle: string,
  ) => {
    if (!currentUser) return
    if (progress[action]) return

    const nextProgress: VkExtraHeartsGateProgress = { ...progress, [action]: true }
    setProgress(nextProgress)
    writeVkExtraHeartsGateProgress(currentUser.id, nextProgress)

    const nextVoice = state.voiceBalance + VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION
    dispatch({ type: "PAY_VOICES", amount: -VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION })

    const persisted = await persistUserGameState(currentUser, nextVoice, state.inventory)
    if (!persisted) {
      showToast("Награда начислена, но сервер пока недоступен. Синхронизируем позже.", "info")
    }

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
    if (groupTaskDone) return
    setRowBusy("group")
    try {
      const freshCheck = await checkVkGroupMembership()
      setGroupMembership(freshCheck.member)
      /** Автозачёт только при серверном подтверждении подписки. launch fallback может быть устаревшим. */
      if (freshCheck.member === true && freshCheck.source === "server") {
        await grantRewardForAction("group", "Вступить в группу игры")
        return
      }
      await initVkResilient()
      const runtime = await isVkRuntimeEnvironment()
      if (runtime) {
        const { ok } = await joinVkCommunityGroup()
        if (!ok) {
          showToast("Не удалось открыть окно ВК", "info")
          return
        }
        /** Успех VKWebAppJoinGroup: серверный API и launch params часто не обновляются сразу — начисляем по факту bridge. */
        setGroupMembership(true)
        await grantRewardForAction("group", "Вступить в группу игры")
      } else {
        const opened = await openVkUrl(VK_COMMUNITY_PUBLIC_URL)
        if (!opened) {
          showToast("Не удалось открыть ссылку", "info")
          return
        }
        showToast("После вступления вернитесь в игру. Мы автоматически проверим статус подписки.", "info")
      }
    } finally {
      setRowBusy(null)
    }
  }, [checkVkGroupMembership, grantRewardForAction, groupTaskDone, showToast])

  useEffect(() => {
    if (!open || !currentUser) return
    const intervalId = window.setInterval(() => {
      void unlockRowsIfNeeded()
    }, 15000)
    return () => window.clearInterval(intervalId)
  }, [open, currentUser?.id, unlockRowsIfNeeded])

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
            {checkingStatuses ? (
              <p className="mt-2 text-center text-[12px] font-semibold text-slate-500">Проверка статусов...</p>
            ) : null}
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
                label={groupMembership === true && !progress.group ? "Группа игры" : "Вступить в группу игры"}
                actionLabel={groupMembership === true && !progress.group ? `Забрать +${VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION}❤` : "Вступить"}
                busy={rowBusy === "group"}
                done={groupTaskDone}
                disabled={groupTaskDone || (rowBusy !== null && rowBusy !== "group")}
                statusText={
                  groupNeedsResubscribe
                    ? "Статус: не подписан"
                    : groupTaskDone
                      ? "Награда получена"
                      : groupMembership === true
                      ? "Статус: подписан, можно забрать награду"
                      : groupMembership === false
                        ? "Статус: не подписан"
                        : undefined
                }
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
  statusText,
}: {
  label: string
  actionLabel: string
  onClick: () => void
  busy: boolean
  disabled: boolean
  done: boolean
  statusText?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <div className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug text-slate-800">{label}</span>
        {statusText ? <span className="mt-1 block text-[11px] font-medium leading-snug text-slate-500">{statusText}</span> : null}
      </div>
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
