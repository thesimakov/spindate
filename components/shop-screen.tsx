"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  Crown,
  Flower2,
  Gem,
  Heart,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineToast } from "@/components/ui/inline-toast"
import { generateLogId, useGame } from "@/lib/game-context"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { listVotesForPack, payVotesForPack } from "@/lib/heart-shop-pricing"
import { apiFetch } from "@/lib/api-fetch"
import { vkBridge } from "@/lib/vk-bridge"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"

type ShopScreenProps = {
  variant?: "page" | "panel"
  onClose?: () => void
}

export function ShopScreen({ variant = "page", onClose }: ShopScreenProps = {}) {
  const { state, dispatch } = useGame()
  const { currentUser, voiceBalance, players, inventory, tableId } = state
  const { toast, showToast } = useInlineToast(1700)
  const rosesCount = inventory.filter((i) => i.type === "rose").length
  const [exchangeTab, setExchangeTab] = useState<"voices-to-roses" | "roses-to-voices">("voices-to-roses")
  const heartOffers = (
    [
      { hearts: 5, itemId: vkBridge.VK_ITEM_IDS.hearts_5 },
      { hearts: 50, itemId: vkBridge.VK_ITEM_IDS.hearts_50 },
      { hearts: 150, itemId: vkBridge.VK_ITEM_IDS.hearts_150 },
      { hearts: 500, itemId: vkBridge.VK_ITEM_IDS.hearts_500 },
      { hearts: 1000, itemId: vkBridge.VK_ITEM_IDS.hearts_1000 },
      { hearts: 5000, itemId: vkBridge.VK_ITEM_IDS.hearts_5000 },
    ] as const
  ).map((o) => {
    const listVotes = listVotesForPack(o.hearts)
    const votes = payVotesForPack(o.hearts)
    return { ...o, votes, listVotes }
  })
  const sectionCardClass =
    "rounded-2xl border border-white/[0.07] bg-slate-900/75 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-sm"
  const sectionLabelClass = "text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500"
  const subtleTextClass = "text-xs sm:text-sm text-slate-300"
  const ctaPrimaryClass =
    "h-10 w-full rounded-xl border border-cyan-200/70 text-sm font-semibold text-slate-950 shadow-[0_8px_20px_rgba(56,189,248,0.5)] disabled:opacity-60"
  const ctaSecondaryClass =
    "h-10 rounded-xl border border-cyan-300/55 bg-slate-900 text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:border-cyan-200/80"

  /** Обводка как у Material Symbols Outlined (~24dp, weight 400) */
  const mdIconStroke = 2

  const SHOP_PARTICLE_EASE = [
    "cubic-bezier(0.45, 0.02, 0.29, 0.98)",
    "cubic-bezier(0.33, 0.12, 0.53, 0.94)",
    "cubic-bezier(0.52, 0.01, 0.19, 0.99)",
    "cubic-bezier(0.4, 0.18, 0.32, 0.92)",
    "cubic-bezier(0.28, 0.09, 0.46, 1)",
    "cubic-bezier(0.55, 0.05, 0.15, 0.95)",
  ] as const

  const shopParticles = useMemo(() => {
    let s = 0x5b0b5 % 233280
    s = (s * 9301 + 49297) % 233280
    const count = 10 + (s % 30)
    const list: {
      x: number
      y: number
      duration: number
      delay: number
      isPink: boolean
      isYellow: boolean
      reverse: boolean
      chaos: number
      ease: string
      dustOpacity: number
      dustSize: string
    }[] = []
    for (let i = 0; i < count; i++) {
      s = (s * 9301 + 49297) % 233280
      const x = 1 + (s / 233280) * 97
      s = (s * 9301 + 49297) % 233280
      const y = 5 + (s / 233280) * 90
      s = (s * 9301 + 49297) % 233280
      const chaos = s % 6
      s = (s * 9301 + 49297) % 233280
      const dustSize = `${(2 + (s / 233280) * 2.9).toFixed(2)}px`
      const dustOpacity = 0.4 + (s / 233280) * 0.5
      list.push({
        x,
        y,
        duration: 16 + (s % 26),
        delay: (s % 36) * 0.3,
        isPink: i % 3 === 1,
        isYellow: i % 3 === 2,
        reverse: (s + i * 3) % 2 === 1,
        chaos,
        ease: SHOP_PARTICLE_EASE[(s + chaos) % SHOP_PARTICLE_EASE.length],
        dustOpacity,
        dustSize,
      })
    }
    return list
  }, [])

  if (!currentUser) return null

  const isPanel = variant === "panel"
  /** Узкая колонка боковой панели: всё идёт сверху вниз без сетки 2–4 колонки */
  const layoutDense = isPanel

  const currentPlayer = players.find((p) => p.id === currentUser.id)
  const vipUntilTs = currentPlayer?.vipUntilTs
  const isVip = !!currentPlayer?.isVip && (vipUntilTs == null || vipUntilTs > Date.now())
  const vipLeftDays = vipUntilTs ? Math.max(0, Math.ceil((vipUntilTs - Date.now()) / (24 * 60 * 60 * 1000))) : null
  const vipTrialKey = `spindate_vip_trial_used_${currentUser.id}`
  const [vipTrialUsed, setVipTrialUsed] = useState(false)

  useEffect(() => {
    try {
      setVipTrialUsed(localStorage.getItem(vipTrialKey) === "1")
    } catch {
      setVipTrialUsed(false)
    }
  }, [vipTrialKey])

  const runLiveKeepAlive = async (user: typeof currentUser, ms: number) => {
    if (!user) return () => {}
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        await apiFetch("/api/table/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode: "sync",
            user,
            tableId,
          }),
        })
      } catch {
        // ignore
      }
    }
    await tick()
    const t = setInterval(() => void tick(), ms)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }

  const handleActivateVip = async ({
    days,
    cost,
    itemId,
    isTrial,
  }: {
    days: number
    cost: number
    itemId?: string
    isTrial?: boolean
  }) => {
    if (isVip) {
      showToast(vipLeftDays ? `VIP уже активен: ещё ${vipLeftDays} дн.` : "VIP уже активен", "info")
      return
    }
    if (isTrial && vipTrialUsed) {
      showToast("Пробный VIP уже использован", "info")
      return
    }
    if (cost > 0 && voiceBalance < cost) {
      showToast("Недостаточно сердец для VIP", "error")
      return
    }

    if (cost > 0) {
      const stopKeepAlive = await runLiveKeepAlive(currentUser, 12_000)
      const ok = await vkBridge.showPaymentWall(cost, itemId)
      stopKeepAlive()
      if (!ok) {
        showToast("Активация VIP отменена", "error")
        return
      }
    }

    if (cost > 0) dispatch({ type: "PAY_VOICES", amount: cost })
    const until = Date.now() + days * 24 * 60 * 60 * 1000
    dispatch({ type: "SET_VIP_STATUS", playerId: currentUser.id, isVip: true, vipUntilTs: until })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} купил(а) VIP на ${days} дн.`,
        timestamp: Date.now(),
      },
    })
    if (isTrial) {
      try {
        localStorage.setItem(vipTrialKey, "1")
      } catch {
        // ignore
      }
      setVipTrialUsed(true)
    }
    showToast(`VIP активирован на ${days} дн.`, "success")
  }

  const handleTopUp = async (amount: number, votes: number, itemId: string) => {
    const stopKeepAlive = await runLiveKeepAlive(currentUser, 12_000)
    const ok = await vkBridge.showPaymentWall(votes, itemId)
    stopKeepAlive()
    if (!ok) {
      showToast("Пополнение отменено", "error")
      return
    }
    dispatch({ type: "PAY_VOICES", amount: -amount })
    showToast(`Баланс пополнен на ${amount} ❤`, "success")
  }

  const handleInviteFriends = async () => {
    const ok = await vkBridge.inviteFriends()
    if (ok) {
      // Можно добавить бонус за приглашение (например, +50 сердец)
      // dispatch({ type: "PAY_VOICES", amount: -50 })
      showToast("Приглашение отправлено", "info")
    } else {
      showToast("Не удалось отправить приглашение", "error")
    }
  }

  const backToTable = () => {
    if (isPanel && onClose) onClose()
    else dispatch({ type: "SET_SCREEN", screen: "game" })
  }

  const shopInnerCard = (
    <div
      className={
        "w-full shrink-0 space-y-6 rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-b from-slate-900/[0.98] via-[#0a1020]/[0.97] to-slate-950/95 shadow-[0_28px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] backdrop-blur-md " +
        (isPanel ? "max-w-full space-y-5 px-4 py-5 sm:px-5" : "max-w-2xl space-y-7 px-5 py-7 sm:px-8 sm:py-9")
      }
    >
        {!isPanel && (
          <header className="space-y-2 text-center sm:text-left">
            <p className={sectionLabelClass}>Стол и валюта</p>
            <h1 className="bg-gradient-to-r from-slate-50 via-white to-slate-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
              Магазин
            </h1>
            <p className="text-sm leading-relaxed text-slate-400 sm:text-base">
              Пополнение сердец, VIP и обмен — всё в одном месте.
            </p>
          </header>
        )}

        {/* Баланс */}
        <div
          className={`relative overflow-hidden ${sectionCardClass} ${
            layoutDense ? "p-4" : "p-5 sm:p-6"
          }`}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-rose-500/[0.12] blur-3xl"
            aria-hidden
          />
          <div className="pointer-events-none absolute -bottom-8 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-cyan-500/[0.06] blur-2xl" aria-hidden />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={sectionLabelClass}>Баланс</p>
              <p className={`mt-1 font-medium text-slate-300 ${layoutDense ? "text-xs" : "text-sm"}`}>
                Сердечки на столе
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              <div
                className={`flex items-center justify-center rounded-2xl bg-rose-500/15 ring-1 ring-rose-400/25 ${
                  layoutDense ? "h-11 w-11" : "h-12 w-12 sm:h-14 sm:w-14"
                }`}
              >
                <Heart
                  className={`shrink-0 text-rose-300 ${layoutDense ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7"}`}
                  strokeWidth={mdIconStroke}
                  fill="none"
                  aria-hidden
                />
              </div>
              <span
                className={`font-black tabular-nums tracking-tight text-white ${
                  layoutDense ? "text-2xl" : "text-3xl sm:text-4xl"
                }`}
              >
                {voiceBalance}
              </span>
            </div>
          </div>
        </div>

        {/* Пополнение сердечек (оплата через VK по пакетам) */}
        {layoutDense ? (
          <div className="border-t border-slate-600/35 pt-5">
            <p className={sectionLabelClass}>Пополнение</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-100">Пакеты сердец</p>
            <p className="mt-0.5 text-xs text-slate-500">Оплата голосами VK</p>
          </div>
        ) : (
          <div className="space-y-1 px-0.5">
            <p className={sectionLabelClass}>Пополнение</p>
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Пакеты сердец</h2>
            <p className="text-xs text-slate-500 sm:text-sm">Оплата голосами VK · скидки на крупные пакеты</p>
          </div>
        )}
        <div
          className={
            layoutDense ? "grid grid-cols-3 gap-2 sm:gap-3" : "grid grid-cols-3 gap-3 sm:gap-3.5"
          }
        >
          {heartOffers.map((offer) => {
            const hasDiscount = offer.listVotes > offer.votes
            const discountPercent = hasDiscount ? Math.round((1 - offer.votes / offer.listVotes) * 100) : 0
            const isPopular = offer.hearts === 500
            const isBest = offer.hearts === 5000
            const iconConfig: {
              bg: string
              ring: string
              fg: string
              Icon: LucideIcon
              filled?: boolean
            } =
              offer.hearts >= 5000
                ? {
                    bg: "bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400",
                    ring: "ring-amber-300/80",
                    fg: "text-amber-800",
                    Icon: Crown,
                  }
                : offer.hearts >= 1000
                  ? {
                      bg: "bg-gradient-to-br from-sky-200 via-indigo-300 to-sky-400",
                      ring: "ring-sky-200/80",
                      fg: "text-sky-900",
                      Icon: Gem,
                    }
                  : offer.hearts >= 150
                    ? {
                        bg: "bg-gradient-to-br from-rose-200 via-pink-300 to-rose-400",
                        ring: "ring-rose-200/80",
                        fg: "text-rose-800",
                        Icon: Heart,
                        filled: true,
                      }
                    : {
                        bg: "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300",
                        ring: "ring-slate-200/80",
                        fg: "text-sky-700",
                        Icon: Heart,
                        filled: false,
                      }
            const cardAccent =
              isBest
                ? "border-amber-400/45 bg-gradient-to-b from-amber-500/[0.14] via-slate-950/75 to-[#060a12] shadow-[0_12px_40px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
                : offer.hearts >= 1000
                  ? "border-indigo-400/35 bg-gradient-to-b from-indigo-500/[0.12] via-slate-950/80 to-[#060a12] shadow-[0_12px_40px_rgba(99,102,241,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : hasDiscount
                    ? "border-rose-500/40 bg-gradient-to-b from-rose-500/[0.11] via-slate-950/80 to-[#060a12] shadow-[0_12px_40px_rgba(244,63,94,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]"
                    : "border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.08] via-slate-950/85 to-[#060a12] shadow-[0_12px_36px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]"

            const iconWellStyle =
              offer.hearts >= 5000
                ? { background: "radial-gradient(circle at 30% 25%, rgba(254,243,199,0.95) 0%, rgba(251,191,36,0.55) 42%, rgba(180,83,9,0.35) 100%)" }
                : offer.hearts >= 1000
                  ? { background: "radial-gradient(circle at 30% 25%, rgba(224,231,255,0.9) 0%, rgba(129,140,248,0.5) 45%, rgba(67,56,202,0.4) 100%)" }
                  : offer.hearts >= 150
                    ? { background: "radial-gradient(circle at 30% 25%, rgba(254,205,211,0.95) 0%, rgba(251,113,133,0.45) 48%, rgba(190,18,60,0.35) 100%)" }
                    : { background: "radial-gradient(circle at 30% 25%, rgba(248,250,252,0.95) 0%, rgba(148,163,184,0.45) 50%, rgba(71,85,105,0.35) 100%)" }

            const badgeSm = layoutDense ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px] sm:text-xs"

            return (
              <div
                key={offer.hearts}
                className={`group relative flex h-full min-h-[11rem] flex-col overflow-hidden rounded-[1.25rem] border text-slate-50 backdrop-blur-md transition-all duration-300 sm:rounded-[1.35rem] sm:min-h-[12.5rem] ${cardAccent} hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.45)]`}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-80"
                  aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-6 top-8 h-16 rounded-full bg-cyan-400/10 blur-2xl" aria-hidden />

                <div
                  className={`relative flex min-h-0 flex-1 flex-col items-center px-2 pb-2 pt-3 sm:px-3 sm:pb-3 sm:pt-4 ${layoutDense ? "pt-2.5" : ""}`}
                >
                  {(isPopular || isBest) && (
                    <span
                      className={`absolute left-1.5 top-1.5 z-[1] rounded-full font-bold uppercase tracking-wider shadow-md sm:left-2 sm:top-2 ${badgeSm} ${
                        isBest
                          ? "bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950 ring-1 ring-amber-200/60"
                          : "bg-gradient-to-r from-cyan-400 to-sky-400 text-cyan-950 ring-1 ring-cyan-100/50"
                      }`}
                    >
                      {isBest ? "Топ" : "Хит"}
                    </span>
                  )}
                  {hasDiscount && (
                    <span
                      className={`absolute right-1.5 top-1.5 z-[1] rounded-full bg-gradient-to-r from-rose-600 to-rose-500 font-bold uppercase tracking-wide text-white shadow-[0_4px_14px_rgba(244,63,94,0.55)] ring-1 ring-rose-300/40 sm:right-2 sm:top-2 ${badgeSm}`}
                    >
                      −{discountPercent}%
                    </span>
                  )}

                  <div
                    className={`relative mb-2 flex shrink-0 items-center justify-center rounded-full shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-2 ring-white/15 ${iconConfig.ring} ${layoutDense ? "h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14" : "h-14 w-14 sm:h-16 sm:w-16"}`}
                    style={iconWellStyle}
                  >
                    <iconConfig.Icon
                      className={`${layoutDense ? "h-[1.35rem] w-[1.35rem] sm:h-7 sm:w-7" : "h-7 w-7 sm:h-8 sm:w-8"} ${iconConfig.fg} drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]`}
                      strokeWidth={iconConfig.filled ? 0 : mdIconStroke}
                      fill={iconConfig.filled ? "currentColor" : "none"}
                      aria-hidden
                    />
                  </div>

                  <div className="mt-auto flex w-full flex-col items-center justify-end pb-0.5 text-center">
                    <div
                      className={`flex items-center justify-center gap-0.5 font-black tabular-nums tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)] sm:gap-1 ${
                        layoutDense ? "text-base sm:text-lg" : "text-lg sm:text-2xl"
                      }`}
                    >
                      <span>{offer.hearts}</span>
                      <Heart
                        className="h-[1em] w-[1em] shrink-0 text-rose-400"
                        strokeWidth={mdIconStroke}
                        fill="none"
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>

                <Button
                  size="lg"
                  className={`mt-auto min-h-[2.75rem] w-full shrink-0 rounded-none rounded-b-[1.25rem] border-0 border-t border-white/10 px-2 py-2.5 font-bold shadow-none transition hover:brightness-105 active:brightness-95 sm:min-h-12 sm:rounded-b-[1.35rem] ${layoutDense ? "text-[10px] leading-tight sm:text-xs" : "text-xs sm:text-sm"}`}
                  style={{
                    background: "linear-gradient(90deg, #6ee7f7 0%, #7dd3fc 35%, #818cf8 70%, #6366f1 100%)",
                    color: "#0f172a",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                  }}
                  onClick={() => handleTopUp(offer.hearts, offer.votes, offer.itemId)}
                >
                  <span className="tabular-nums">{offer.votes}</span> гол.
                </Button>
              </div>
            )
          })}
        </div>

        {/* VIP-статус: единый модуль + три карточки в один ряд */}
        <div className="space-y-3">
          <div className="px-0.5">
            <p className={sectionLabelClass}>Премиум</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">VIP за столом</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Рамка, значок и приоритет в списке игроков</p>
          </div>
        <div
          className={`overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/[0.15] via-[#0a0f18] to-[#06090f] shadow-[0_24px_56px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ${
            layoutDense ? "" : ""
          }`}
        >
          <div className="border-b border-amber-500/10 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14"
                style={{
                  background: "linear-gradient(145deg, #fcd34d 0%, #f59e0b 45%, #d97706 100%)",
                  boxShadow: "0 0 28px rgba(251,191,36,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                <Crown className="h-6 w-6 text-amber-950 sm:h-7 sm:w-7" strokeWidth={mdIconStroke} aria-hidden />
              </div>
              <div className="min-w-0 flex flex-col gap-2 pt-0.5">
                <p className="text-base font-semibold leading-snug text-white sm:text-lg">
                  Золотая рамка и корона на аватаре
                </p>
                <p className="text-sm leading-relaxed text-slate-400">
                  Заметный статус и приоритетное место за столом.
                </p>
                {isVip && vipLeftDays != null && (
                  <span className="inline-flex w-fit items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30">
                    Активен ещё {vipLeftDays} дн.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-3 pb-4 pt-2 sm:gap-4 sm:px-4 sm:pb-5 sm:pt-2">
            {/* Проба */}
            <div className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border-2 border-amber-400/55 bg-gradient-to-b from-amber-500/[0.1] via-slate-950/92 to-[#070b12] shadow-[0_0_32px_rgba(245,158,11,0.1)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" aria-hidden />
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
                <div className="mb-2 flex items-center gap-2 sm:mb-3">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-400 sm:h-5 sm:w-5" strokeWidth={mdIconStroke} aria-hidden />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-300 sm:text-xs">
                    Проба
                  </span>
                </div>
                <p className="text-2xl font-black tracking-tight text-white sm:text-3xl sm:leading-none">3 дня</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Полный доступ бесплатно — один раз на аккаунт.
                </p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || vipTrialUsed}
                className="mt-auto min-h-12 shrink-0 rounded-none rounded-b-xl border-0 border-t border-amber-400/20 px-4 py-3 text-sm font-bold disabled:!opacity-100"
                style={
                  !!isVip || vipTrialUsed
                    ? {
                        background: "linear-gradient(180deg, #334155 0%, #1e293b 100%)",
                        color: "#cbd5e1",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                      }
                    : {
                        background: "linear-gradient(90deg, #6ee7f7 0%, #7dd3fc 35%, #818cf8 72%, #6366f1 100%)",
                        color: "#0f172a",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                      }
                }
                onClick={() => handleActivateVip({ days: 3, cost: 0, isTrial: true })}
              >
                {isVip ? (
                  "Уже VIP"
                ) : vipTrialUsed ? (
                  "Проба уже использована"
                ) : (
                  "Попробовать бесплатно"
                )}
              </Button>
            </div>

            {/* 7 дней */}
            <div className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-600/70 bg-slate-950/85 backdrop-blur-[2px]">
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
                <div className="mb-2 flex items-center gap-2 text-slate-500 sm:mb-3">
                  <CalendarDays className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={mdIconStroke} aria-hidden />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] sm:text-xs">
                    Тариф
                  </span>
                </div>
                <p className="text-2xl font-black tracking-tight text-white sm:text-3xl sm:leading-none">7 дней</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Списание с баланса сердечек в приложении.
                </p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || voiceBalance < 20}
                className="mt-auto min-h-12 shrink-0 rounded-none rounded-b-xl border-0 border-t border-slate-600/50 px-4 py-3 text-sm font-bold disabled:!opacity-100"
                style={
                  !!isVip || voiceBalance < 20
                    ? {
                        background: "linear-gradient(180deg, #334155 0%, #1e293b 100%)",
                        color: "#cbd5e1",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                      }
                    : {
                        background: "linear-gradient(90deg, #6ee7f7 0%, #7dd3fc 35%, #818cf8 72%, #6366f1 100%)",
                        color: "#0f172a",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                      }
                }
                onClick={() => handleActivateVip({ days: 7, cost: 20, itemId: vkBridge.VK_ITEM_IDS.vip_7d })}
              >
                {isVip ? (
                  "Уже VIP"
                ) : voiceBalance < 20 ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Не хватает 20
                    <Heart className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 tabular-nums">
                    20
                    <Heart className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                )}
              </Button>
            </div>

            {/* 30 дней */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-cyan-500/40 bg-gradient-to-b from-cyan-500/[0.07] via-slate-950/90 to-[#070b12] shadow-[0_0_24px_rgba(34,211,238,0.08)]">
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
                <div className="mb-2 flex items-center gap-2 sm:mb-3">
                  <CalendarDays className="h-4 w-4 shrink-0 text-cyan-400 sm:h-5 sm:w-5" strokeWidth={mdIconStroke} aria-hidden />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-400 sm:text-xs">
                    Выгодно
                  </span>
                </div>
                <p className="text-2xl font-black tracking-tight text-white sm:text-3xl sm:leading-none">30 дней</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Максимум преимуществ на месяц вперёд.
                </p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || voiceBalance < 70}
                className="mt-auto min-h-12 shrink-0 rounded-none rounded-b-xl border-0 border-t border-cyan-500/25 px-4 py-3 text-sm font-bold disabled:!opacity-100"
                style={
                  !!isVip || voiceBalance < 70
                    ? {
                        background: "linear-gradient(180deg, #334155 0%, #1e293b 100%)",
                        color: "#cbd5e1",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                      }
                    : {
                        background: "linear-gradient(90deg, #6ee7f7 0%, #7dd3fc 35%, #818cf8 72%, #6366f1 100%)",
                        color: "#0f172a",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                      }
                }
                onClick={() => handleActivateVip({ days: 30, cost: 70, itemId: vkBridge.VK_ITEM_IDS.vip_30d })}
              >
                {isVip ? (
                  "Уже VIP"
                ) : voiceBalance < 70 ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Не хватает 70
                    <Heart className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 tabular-nums">
                    70
                    <Heart className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
        </div>

        {/* Обмен валюты: Сердца ↔ Розы */}
        <div className="space-y-3">
          <div className="px-0.5">
            <p className={sectionLabelClass}>Обмен</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">Сердца и розы</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Мгновенная конвертация по фиксированному курсу</p>
          </div>
        <div
          className={`overflow-hidden p-0 ${sectionCardClass} ${
            layoutDense ? "" : ""
          }`}
        >
          <div
            className={`border-b border-cyan-400/10 px-4 py-3.5 ${
              layoutDense ? "flex flex-col items-stretch gap-3" : "flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/25">
                <ArrowRightLeft className="h-5 w-5 text-cyan-300" strokeWidth={mdIconStroke} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-300">Курс обмена</p>
                <p className="text-[11px] text-slate-500 sm:text-xs">Выберите направление ниже</p>
              </div>
            </div>
            <div
              className={
                layoutDense
                  ? "flex flex-wrap items-center gap-2"
                  : "ml-auto flex shrink-0 flex-nowrap items-center gap-2"
              }
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/35 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:px-3 sm:py-1.5 sm:text-xs">
                <span className="tabular-nums text-cyan-200">5</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/15 ring-1 ring-cyan-400/30 sm:h-6 sm:w-6">
                  <Heart className="h-3 w-3 text-cyan-200 sm:h-3.5 sm:w-3.5" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                </span>
                <span className="text-slate-500">=</span>
                <span className="tabular-nums text-fuchsia-100">1</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-fuchsia-500/20 ring-1 ring-fuchsia-400/35 sm:h-6 sm:w-6">
                  <Flower2 className="h-3 w-3 text-fuchsia-200 sm:h-3.5 sm:w-3.5" strokeWidth={mdIconStroke} aria-hidden />
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/55 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-3 sm:py-1.5 sm:text-xs">
                <span className="tabular-nums">1</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-fuchsia-500/20 ring-1 ring-fuchsia-400/30 sm:h-6 sm:w-6">
                  <Flower2 className="h-3 w-3 text-fuchsia-200 sm:h-3.5 sm:w-3.5" strokeWidth={mdIconStroke} aria-hidden />
                </span>
                <span className="text-slate-500">=</span>
                <span className="tabular-nums text-slate-200">5</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/15 ring-1 ring-cyan-400/25 sm:h-6 sm:w-6">
                  <Heart className="h-3 w-3 text-cyan-200 sm:h-3.5 sm:w-3.5" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                </span>
              </span>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <p className="text-[11px] leading-snug text-slate-400 sm:text-xs">
                Курс: <span className="tabular-nums text-cyan-300">5 ❤</span> ↔{" "}
                <span className="tabular-nums text-fuchsia-300">1 🌹</span>. Выберите вкладку и сумму.
              </p>
              <div
                role="tablist"
                aria-label="Выбор направления: сердца на розы или розы на сердца"
                className="flex w-full flex-row gap-2 rounded-2xl bg-slate-950/95 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-slate-600/65"
              >
                <button
                  type="button"
                  role="tab"
                  id="exchange-tab-hearts"
                  aria-selected={exchangeTab === "voices-to-roses"}
                  aria-controls="exchange-panel"
                  tabIndex={0}
                  onClick={() => setExchangeTab("voices-to-roses")}
                  className={`flex min-h-[3rem] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition-all sm:gap-2 sm:px-3 ${
                    exchangeTab === "voices-to-roses"
                      ? "bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-500 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_28px_rgba(34,211,238,0.35)]"
                      : "border border-slate-600/90 bg-slate-900/95 text-slate-200 hover:border-cyan-500/45 hover:bg-slate-800/90 active:scale-[0.98]"
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "voices-to-roses" ? "text-slate-900" : "text-cyan-400"}`}
                    strokeWidth={mdIconStroke}
                    fill="none"
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-center text-[10px] font-bold leading-tight sm:text-sm">
                    Сердца → Розы
                  </span>
                  <Flower2
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "voices-to-roses" ? "text-slate-900" : "text-fuchsia-400"}`}
                    strokeWidth={mdIconStroke}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  role="tab"
                  id="exchange-tab-roses"
                  aria-selected={exchangeTab === "roses-to-voices"}
                  aria-controls="exchange-panel"
                  tabIndex={0}
                  onClick={() => setExchangeTab("roses-to-voices")}
                  className={`flex min-h-[3rem] flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition-all sm:gap-2 sm:px-3 ${
                    exchangeTab === "roses-to-voices"
                      ? "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-fuchsia-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_rgba(217,70,239,0.35)]"
                      : "border border-slate-600/90 bg-slate-900/95 text-slate-200 hover:border-fuchsia-500/40 hover:bg-slate-800/90 active:scale-[0.98]"
                  }`}
                >
                  <Flower2
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "roses-to-voices" ? "text-white" : "text-fuchsia-400"}`}
                    strokeWidth={mdIconStroke}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate text-center text-[10px] font-bold leading-tight sm:text-sm">
                    Розы → Сердца
                  </span>
                  <Heart
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "roses-to-voices" ? "text-white" : "text-cyan-400"}`}
                    strokeWidth={mdIconStroke}
                    fill="none"
                    aria-hidden
                  />
                </button>
              </div>
            </div>

            <div id="exchange-panel" role="tabpanel" aria-labelledby={exchangeTab === "voices-to-roses" ? "exchange-tab-hearts" : "exchange-tab-roses"}>

            {exchangeTab === "voices-to-roses" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-600/45 bg-slate-950/55 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Баланс</span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-100">
                    <span className="tabular-nums text-lg">{voiceBalance}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-400/30">
                      <Heart className="h-4 w-4 text-cyan-200" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                    </span>
                  </span>
                </div>
                <div
                  className={
                    layoutDense ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                  }
                >
                  {(
                    [
                      { roses: 1, cost: 5 },
                      { roses: 5, cost: 25 },
                      { roses: 10, cost: 50 },
                    ] as const
                  ).map(({ roses, cost }) => (
                    <Button
                      key={roses}
                      type="button"
                      variant="outline"
                      disabled={voiceBalance < cost}
                      className="flex h-auto min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-2xl border-cyan-400/35 bg-slate-950/55 px-3 py-3.5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-cyan-300/50 hover:bg-slate-800/45 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] disabled:!opacity-100 disabled:border-slate-700/70 disabled:bg-slate-950/40 disabled:text-slate-500"
                      onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: roses })}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/[0.22] ring-1 ring-fuchsia-400/40 shadow-[0_0_16px_rgba(232,121,249,0.12)]">
                          <Flower2 className="h-5 w-5 text-fuchsia-100" strokeWidth={mdIconStroke} aria-hidden />
                        </span>
                        <span className="text-lg font-black tabular-nums tracking-tight text-fuchsia-100">+{roses}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/70 px-2.5 py-1 text-[11px] font-bold text-slate-400 ring-1 ring-slate-600/50">
                        <span className="tabular-nums text-slate-200">{cost}</span>
                        <Heart className="h-3.5 w-3.5 text-cyan-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-600/45 bg-slate-950/55 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Роз в инвентаре</span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-100">
                    <span className="tabular-nums text-lg">{rosesCount}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/20 ring-1 ring-fuchsia-400/35">
                      <Flower2 className="h-4 w-4 text-fuchsia-100" strokeWidth={mdIconStroke} aria-hidden />
                    </span>
                  </span>
                </div>
                <div
                  className={
                    layoutDense ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rosesCount < 1}
                    className="flex h-auto min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-2xl border-cyan-400/35 bg-slate-950/55 px-3 py-3.5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-cyan-300/50 hover:bg-slate-800/45 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] disabled:!opacity-100 disabled:border-slate-700/70 disabled:bg-slate-950/40 disabled:text-slate-500"
                    onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 1 })}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/[0.22] ring-1 ring-fuchsia-400/40">
                        <Flower2 className="h-5 w-5 text-fuchsia-100" strokeWidth={mdIconStroke} aria-hidden />
                      </span>
                      <span className="text-sm font-black text-fuchsia-100">1 роза</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/70 px-2.5 py-1 text-[11px] font-bold text-slate-400 ring-1 ring-slate-600/50">
                      <span className="tabular-nums text-cyan-200">+5</span>
                      <Heart className="h-3.5 w-3.5 text-cyan-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rosesCount < 5}
                    className="flex h-auto min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-2xl border-cyan-400/35 bg-slate-950/55 px-3 py-3.5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-cyan-300/50 hover:bg-slate-800/45 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] disabled:!opacity-100 disabled:border-slate-700/70 disabled:bg-slate-950/40 disabled:text-slate-500"
                    onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 5 })}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/[0.22] ring-1 ring-fuchsia-400/40">
                        <Flower2 className="h-5 w-5 text-fuchsia-100" strokeWidth={mdIconStroke} aria-hidden />
                      </span>
                      <span className="text-sm font-black text-fuchsia-100">5 роз</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/70 px-2.5 py-1 text-[11px] font-bold text-slate-400 ring-1 ring-slate-600/50">
                      <span className="tabular-nums text-cyan-200">+25</span>
                      <Heart className="h-3.5 w-3.5 text-cyan-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rosesCount < 1}
                    className="flex h-auto min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-2xl border-violet-400/40 bg-gradient-to-b from-violet-500/[0.14] via-slate-950/60 to-slate-950/80 px-3 py-3.5 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-violet-300/55 hover:from-violet-500/[0.2] hover:shadow-[0_0_26px_rgba(167,139,250,0.15)] disabled:!opacity-100 disabled:border-slate-700/70 disabled:from-transparent disabled:to-slate-950/40 disabled:text-slate-500"
                    onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: rosesCount })}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/25 ring-1 ring-violet-400/45">
                        <Flower2 className="h-5 w-5 text-violet-100" strokeWidth={mdIconStroke} aria-hidden />
                      </span>
                      <span className="text-sm font-black text-violet-100">Все розы</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/70 px-2.5 py-1 text-[11px] font-bold text-slate-400 ring-1 ring-slate-600/50">
                      <span className="tabular-nums text-cyan-200">+{rosesCount * 5}</span>
                      <Heart className="h-3.5 w-3.5 text-cyan-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                    </span>
                  </Button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
        </div>

        {/* Добавить друзей */}
        <div className="space-y-2">
          <p className={`${sectionLabelClass} px-0.5`}>Сообщество</p>
        <div
          className={`rounded-2xl px-4 py-4 ${sectionCardClass} ${
            layoutDense ? "flex flex-col items-stretch gap-4" : "flex items-center justify-between gap-4"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600/80 to-slate-800/90 ring-1 ring-white/10"
              aria-hidden
            >
              <Users className="h-5 w-5 text-slate-200" strokeWidth={mdIconStroke} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-100">Добавить друзей</span>
              <span className={subtleTextClass}>Пригласите в игру — веселее вместе</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className={`${ctaSecondaryClass} h-10 shrink-0 px-5 ${layoutDense ? "w-full" : ""}`}
            onClick={handleInviteFriends}
          >
            Пригласить
          </Button>
        </div>
        </div>

        <footer className="rounded-2xl border border-slate-700/40 bg-slate-950/50 px-4 py-3 text-center sm:text-left">
          <p className="text-[11px] leading-relaxed text-slate-500 sm:text-xs">
            Сердечки — виртуальная игровая валюта, не обмениваются на реальные деньги. П. 2.3.8{" "}
            <a
              href="https://dev.vk.com/ru/mini-apps-rules"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-400 underline decoration-slate-600 underline-offset-2 transition hover:text-slate-300"
            >
              правил VK Mini Apps
            </a>
            .
          </p>
        </footer>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            className={`${ctaSecondaryClass} inline-flex items-center justify-center gap-2`}
            onClick={backToTable}
          >
            <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" strokeWidth={mdIconStroke} aria-hidden />
            Назад к столу
          </Button>
        </div>
    </div>
  )

  if (isPanel) {
    return (
      <>
        {toast && <InlineToast toast={toast} />}
        <GameSidePanelShell
          title="Магазин"
          subtitle="Баланс, пакеты, VIP и обмен в одном месте."
          onClose={onClose!}
        >
          {shopInnerCard}
        </GameSidePanelShell>
      </>
    )
  }

  return (
    <div className="relative flex h-app min-h-app max-h-app flex-col overflow-hidden entry-bg-animated">
      {toast && <InlineToast toast={toast} />}
      <div className="game-particles game-particles--dust" aria-hidden="true">
        {shopParticles.map((d, idx) => {
          const anim = d.reverse ? `particleChaosRev${d.chaos + 1}` : `particleChaos${d.chaos + 1}`
          return (
            <span
              key={idx}
              className="pointer-events-none absolute"
              style={{ left: `${d.x}%`, top: `${d.y}%`, opacity: d.dustOpacity }}
            >
              <span
                className={`game-particles__dot ${d.isPink ? "game-particles__dot--pink" : ""} ${d.isYellow ? "game-particles__dot--yellow" : ""}`}
                style={
                  {
                    position: "relative",
                    left: 0,
                    top: 0,
                    ["--particle-anim"]: anim,
                    ["--particle-dur"]: `${d.duration}s`,
                    ["--particle-delay"]: `${d.delay}s`,
                    ["--particle-ease"]: d.ease,
                    ["--dust-size"]: d.dustSize,
                  } as CSSProperties
                }
              />
            </span>
          )
        })}
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:py-10">
        {shopInnerCard}
      </div>
    </div>
  )
}

