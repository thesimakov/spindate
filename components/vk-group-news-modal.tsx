"use client"

import { useCallback, useState } from "react"
import { Heart, X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { publicUrl } from "@/lib/assets"
import { apiFetch } from "@/lib/api-fetch"
import { useGameState } from "@/lib/game-context"
import type { InlineToastType } from "@/hooks/use-inline-toast"
import {
  buildVkGroupSubscribeRewardUrl,
  markVkGroupBellAnimationOff,
} from "@/lib/vk-group-news-bell"
import { VK_GROUP_SUBSCRIBE_BONUS_HEARTS } from "@/lib/vk-group-subscribe-constants"
import { initVkResilient, joinVkCommunityGroup } from "@/lib/vk-bridge"
import { cn } from "@/lib/utils"

const PROMO_IMAGE = publicUrl("/assets/vk-group-promo.png")

type VkGroupNewsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Тосты при успехе/ошибке подписки */
  onNotify?: (message: string, type?: InlineToastType) => void
}

export function VkGroupNewsModal({ open, onOpenChange, onNotify }: VkGroupNewsModalProps) {
  const state = useGameState()
  const currentUser = state.currentUser
  const [busy, setBusy] = useState(false)

  const handleSubscribe = useCallback(async () => {
    setBusy(true)
    try {
      await initVkResilient()
      /** Подписка только через VK Bridge (без открытия браузера) */
      const joined = await joinVkCommunityGroup()
      if (joined.ok) {
        markVkGroupBellAnimationOff()
        onNotify?.("Вы подписались на сообщество", "success")
        onOpenChange(false)
        return
      }
      if (currentUser && (currentUser.authProvider === "vk" || typeof currentUser.vkUserId === "number")) {
        const url = buildVkGroupSubscribeRewardUrl(currentUser)
        const res = await apiFetch(url, { method: "POST", credentials: "include" })
        const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
        if (data?.ok === true) {
          markVkGroupBellAnimationOff()
          onNotify?.("Вы уже в сообществе", "success")
          onOpenChange(false)
          return
        }
      }
      onNotify?.(
        "Подписка одним нажатием доступна в мини-приложении ВК. В обычном браузере вступите в сообщество вручную (ссылка в профиле или vk.com/spinndate).",
        "info",
      )
    } finally {
      setBusy(false)
    }
  }, [currentUser, onNotify, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50 backdrop-blur-[3px]"
        className={cn(
          "gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none",
          "w-[min(20.5rem,calc(100vw-max(1.25rem,env(safe-area-inset-left))-max(1.25rem,env(safe-area-inset-right))))]",
          "max-h-[min(94dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem))]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        )}
      >
        <DialogTitle className="sr-only">Группа ВКонтакте — новости</DialogTitle>

        <div
          className={cn(
            "relative mx-auto box-border w-full max-w-[20.5rem]",
            "px-[max(0.25rem,env(safe-area-inset-left,0px))]",
            "pr-[max(0.25rem,env(safe-area-inset-right,0px))]",
            "pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
            "pt-[max(0.75rem,env(safe-area-inset-top,0px))]",
          )}
        >
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-[1.75rem]",
              "border border-sky-200/50 shadow-[0_24px_56px_rgba(15,23,42,0.5),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
            )}
          >
            {/* Крестик — только справа сверху, привязка к карточке */}
            <DialogClose
              className={cn(
                "absolute right-2.5 top-2.5 z-30 flex h-9 w-9 items-center justify-center rounded-full sm:right-3 sm:top-3 sm:h-10 sm:w-10",
                "border-2 border-emerald-500 bg-white text-slate-800 shadow-[0_4px_14px_rgba(0,0,0,0.18)]",
                "transition hover:bg-emerald-50/90 active:scale-95",
                "left-auto",
              )}
              aria-label="Закрыть"
            >
              <X className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2.5} />
            </DialogClose>

            <div className="relative w-full">
              <img
                src={PROMO_IMAGE}
                alt=""
                width={314}
                height={314}
                className="mx-auto block h-auto w-full max-w-full object-contain object-top select-none max-h-[min(72dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-5rem))]"
                draggable={false}
              />
              {/* Светлый блок макета: текст и кнопка по центру по вертикали и горизонтали */}
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 top-[30%] flex flex-col items-center justify-center gap-4 px-4 py-5 text-center",
                  "sm:gap-5 sm:px-5 sm:py-6",
                )}
              >
                <p
                  className={cn(
                    "mx-auto max-w-[18rem] text-balance text-[16px] font-bold leading-snug tracking-tight text-slate-900",
                    "sm:text-[17px] sm:leading-snug",
                    "min-[400px]:text-[18px]",
                  )}
                >
                  У нас есть ВК группа, куда мы сообщаем о новостях
                </p>
                <p className="mx-auto max-w-[17rem] text-[13px] font-medium leading-snug text-slate-700 sm:text-sm">
                  {"При подписке в банк эмоций начисляется "}
                  <span className="whitespace-nowrap font-bold text-slate-900">
                    +{VK_GROUP_SUBSCRIBE_BONUS_HEARTS} ❤
                  </span>
                  {" (один раз)."}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSubscribe()}
                  className={cn(
                    "mx-auto flex w-full max-w-[15rem] shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold text-white",
                    "bg-gradient-to-b from-[#4ade80] via-[#22c55e] to-[#15803d]",
                    "shadow-[0_6px_0_rgba(21,128,61,0.4),0_10px_24px_rgba(22,163,74,0.32)]",
                    "transition active:translate-y-0.5 active:shadow-[0_3px_0_rgba(21,128,61,0.45)]",
                    "disabled:pointer-events-none disabled:opacity-60",
                  )}
                >
                  {busy ? (
                    "…"
                  ) : (
                    <>
                      <Heart className="h-4 w-4 shrink-0 fill-white/25" aria-hidden />
                      <span>Подписаться</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
