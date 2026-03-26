"use client"

import { useEffect, useMemo, useState } from "react"
import {
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
import { vkBridge } from "@/lib/vk-bridge"

export function ShopScreen() {
  const { state, dispatch } = useGame()
  const { currentUser, voiceBalance, players, inventory, emotionDailyBoost, tableId } = state
  const { toast, showToast } = useInlineToast(1700)
  const rosesCount = inventory.filter((i) => i.type === "rose").length
  const [exchangeTab, setExchangeTab] = useState<"voices-to-roses" | "roses-to-voices">("voices-to-roses")
  const emotionPackCost = 5
  const emotionPackExtraPerType = 50

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
    "rounded-2xl border border-cyan-300/25 bg-slate-900/90 shadow-[0_12px_30px_rgba(15,23,42,0.55)]"
  const subtleTextClass = "text-xs sm:text-sm text-slate-300"
  const ctaPrimaryClass =
    "h-10 w-full rounded-xl border border-cyan-200/70 text-sm font-semibold text-slate-950 shadow-[0_8px_20px_rgba(56,189,248,0.5)] disabled:opacity-60"
  const ctaSecondaryClass =
    "h-10 rounded-xl border border-cyan-300/55 bg-slate-900 text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:border-cyan-200/80"

  /** Обводка как у Material Symbols Outlined (~24dp, weight 400) */
  const mdIconStroke = 2

  const shopParticles = useMemo(() => {
    const count = 16
    const list: { x: number; y: number; duration: number; delay: number; isPink: boolean; isYellow: boolean; reverse: boolean }[] = []
    let s = 54321
    for (let i = 0; i < count; i++) {
      s = (s * 9301 + 49297) % 233280
      const x = 5 + (s / 233280) * 90
      s = (s * 9301 + 49297) % 233280
      const y = 8 + (s / 233280) * 85
      s = (s * 9301 + 49297) % 233280
      list.push({
        x,
        y,
        duration: 19 + (s % 10),
        delay: (s % 18) / 2,
        isPink: i % 3 === 1,
        isYellow: i % 3 === 2,
        reverse: i % 2 === 1,
      })
    }
    return list
  }, [])

  if (!currentUser) return null

  const currentPlayer = players.find((p) => p.id === currentUser.id)
  const vipUntilTs = currentPlayer?.vipUntilTs
  const isVip = !!currentPlayer?.isVip && (vipUntilTs == null || vipUntilTs > Date.now())
  const vipLeftDays = vipUntilTs ? Math.max(0, Math.ceil((vipUntilTs - Date.now()) / (24 * 60 * 60 * 1000))) : null
  const todayKey = getTodayKey()
  const activeEmotionBoost = emotionDailyBoost?.dateKey === todayKey ? (emotionDailyBoost.extraPerType ?? 0) : 0
  const totalDailyLimitPerType = 50 + activeEmotionBoost
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
        await fetch("/api/table/live", {
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

  function getTodayKey() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const handleBuyEmotionPack = () => {
    if (voiceBalance < emotionPackCost) {
      showToast("Недостаточно сердец", "error")
      return
    }
    dispatch({
      type: "BUY_EMOTION_PACK",
      cost: emotionPackCost,
      extraPerType: emotionPackExtraPerType,
      dateKey: getTodayKey(),
    })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} купил(а) пакет эмоций (+${emotionPackExtraPerType})`,
        timestamp: Date.now(),
      },
    })
    showToast("Пакет эмоций активирован", "success")
  }

  return (
    <div className="relative flex h-dvh min-h-dvh max-h-dvh flex-col overflow-hidden entry-bg-animated">
      {toast && <InlineToast toast={toast} />}
      <div className="game-particles" aria-hidden="true">
        {shopParticles.map((d, idx) => (
          <span
            key={idx}
            className={`game-particles__dot ${d.isPink ? "game-particles__dot--pink" : ""} ${d.isYellow ? "game-particles__dot--yellow" : ""} ${d.reverse ? "game-particles__dot--reverse" : ""}`}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:py-10">
      <div className="w-full max-w-2xl shrink-0 space-y-6 rounded-3xl border border-slate-500/80 bg-slate-900/95 px-6 py-8 shadow-[0_28px_60px_rgba(0,0,0,0.75)] backdrop-blur-md">
        <h1 className="mb-2 text-center text-lg sm:text-2xl font-bold text-slate-50 tracking-wide">{"Магазин"}</h1>
        <p className="mb-2 text-center text-slate-300 text-sm sm:text-base">
          {"Здесь можно выделиться за столом и пополнить запас сердец."}
        </p>
        <p className="mb-5 text-center text-xs sm:text-sm text-slate-300/90">
          Сердечки — виртуальная игровая валюта, не обмениваются на реальные деньги. Соответствие п. 2.3.8{" "}
          <a href="https://dev.vk.com/ru/mini-apps-rules" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">правил VK Mini Apps</a>.
        </p>

        {/* Баланс */}
        <div className={`mb-3 flex items-center justify-between px-4 py-3 ${sectionCardClass}`}>
          <span className="text-sm sm:text-base font-semibold text-slate-100">{"Баланс сердец"}</span>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 shrink-0 text-rose-400 sm:h-5 sm:w-5" strokeWidth={mdIconStroke} fill="none" aria-hidden />
            <span className="text-base sm:text-lg font-bold text-slate-100">{voiceBalance}</span>
          </div>
        </div>
        {/* Пополнение сердечек (оплата через VK по пакетам) */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            return (
              <div
                key={offer.hearts}
                className={`relative flex h-full flex-col overflow-hidden rounded-3xl border text-slate-50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(34,211,238,0.22)] ${
                  isBest
                    ? "border-amber-300/70 bg-gradient-to-b from-amber-200/15 via-slate-900/95 to-slate-900"
                    : hasDiscount
                      ? "border-rose-400/70 bg-gradient-to-b from-rose-300/10 via-slate-900/95 to-slate-900"
                      : "border-slate-700/80 bg-gradient-to-b from-cyan-200/5 via-slate-900/95 to-slate-900"
                }`}
              >
                <div className="pointer-events-none absolute inset-x-4 top-0 h-14 rounded-b-full bg-cyan-300/12 blur-xl" />
                <div className="relative flex flex-1 flex-col items-center px-3 pt-3 pb-3 sm:px-4 sm:pt-4">
                  {(isPopular || isBest) && (
                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        isBest
                          ? "bg-amber-300/95 text-amber-900"
                          : "bg-cyan-300/95 text-cyan-950"
                      }`}
                    >
                      {isBest ? "топ" : "хит"}
                    </span>
                  )}
                  {hasDiscount && (
                    <span className="absolute right-2 top-2 rounded-full bg-rose-500/95 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_0_14px_rgba(248,113,113,0.9)]">
                      {"-"}{discountPercent}{"%"}
                    </span>
                  )}
                  <div className={`mb-2 flex h-14 w-14 items-center justify-center rounded-full ring-4 sm:mb-3 sm:h-16 sm:w-16 ${iconConfig.ring} ${iconConfig.bg} shadow-[0_0_22px_rgba(148,163,184,0.6)]`}>
                    <iconConfig.Icon
                      className={`h-[26px] w-[26px] sm:h-8 sm:w-8 ${iconConfig.fg}`}
                      strokeWidth={iconConfig.filled ? 0 : mdIconStroke}
                      fill={iconConfig.filled ? "currentColor" : "none"}
                      aria-hidden
                    />
                  </div>
                  <div className="text-center leading-tight">
                    <div className="flex items-center justify-center gap-1 text-xl font-bold text-rose-300 sm:text-2xl">
                      <span>{offer.hearts}</span>
                      <Heart
                        className="h-[1.1em] w-[1.1em] shrink-0 text-rose-400/95"
                        strokeWidth={mdIconStroke}
                        fill="none"
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
                <Button
                  size="lg"
                  className={`${ctaPrimaryClass} rounded-b-[1.4rem] rounded-t-none border-t`}
                  style={{
                    background: "linear-gradient(135deg,#22d3ee,#6366f1)",
                    color: "#0b1120",
                    borderRadius: "0 0 1.4rem 1.4rem",
                  }}
                  onClick={() => handleTopUp(offer.hearts, offer.votes, offer.itemId)}
                >
                  {"Купить за "}{offer.votes}{" гол."}
                </Button>
              </div>
            )
          })}
        </div>

        {/* VIP-статус + покупка */}
        <div className={`flex flex-col gap-5 px-4 py-5 ${sectionCardClass}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-600 shadow-[0_0_22px_rgba(251,191,36,0.45)] ring-2 ring-amber-300/50">
              <Crown className="h-5 w-5 text-amber-950" strokeWidth={mdIconStroke} aria-hidden />
            </div>
            <div className="min-w-0 flex flex-col gap-1">
              <span className="text-base font-bold tracking-tight text-slate-50 sm:text-lg">VIP-статус</span>
              <span className="text-sm leading-relaxed text-slate-400">
                Золотая рамка и значок на аватаре, приоритетное место за столом.
              </span>
              {isVip && vipLeftDays != null && (
                <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/35">
                  Активен ещё {vipLeftDays} дн.
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-stretch">
            {/* Пробный */}
            <div className="flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-amber-400/45 bg-gradient-to-b from-amber-500/[0.12] via-slate-950/85 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex flex-1 flex-col px-4 pt-4 pb-2">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" strokeWidth={mdIconStroke} aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400/95">Проба</span>
                </div>
                <p className="text-xl font-black tracking-tight text-amber-100">3 дня</p>
                <p className="mt-2 text-sm leading-snug text-slate-400">Полный доступ бесплатно — один раз на аккаунт.</p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || vipTrialUsed}
                className={`${ctaPrimaryClass} mt-auto h-12 shrink-0 rounded-none rounded-b-2xl border-x-0 border-b-0 border-t border-amber-400/25 disabled:!opacity-100`}
                style={
                  !!isVip || vipTrialUsed
                    ? {
                        background: "linear-gradient(180deg, rgba(71,85,105,0.95) 0%, rgba(51,65,85,0.98) 100%)",
                        color: "#e2e8f0",
                        borderColor: "rgba(148,163,184,0.35)",
                      }
                    : { background: "linear-gradient(135deg,#22d3ee,#6366f1)", color: "#0b1220" }
                }
                onClick={() => handleActivateVip({ days: 3, cost: 0, isTrial: true })}
              >
                {isVip ? "Уже VIP" : vipTrialUsed ? "Проба использована" : "Попробовать бесплатно"}
              </Button>
            </div>

            {/* 7 дней */}
            <div className="flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-slate-600/75 bg-slate-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex flex-1 flex-col px-4 pt-4 pb-2">
                <div className="mb-2 flex items-center gap-2 text-slate-500">
                  <CalendarDays className="h-4 w-4" strokeWidth={mdIconStroke} aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Тариф</span>
                </div>
                <p className="text-xl font-black tracking-tight text-slate-50">7 дней</p>
                <p className="mt-2 text-sm leading-snug text-slate-500">Списание с баланса сердечек в приложении.</p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || voiceBalance < 20}
                className={`${ctaPrimaryClass} mt-auto h-12 shrink-0 rounded-none rounded-b-2xl border-x-0 border-b-0 border-t border-slate-600/60 disabled:!opacity-100`}
                style={
                  !!isVip || voiceBalance < 20
                    ? {
                        background: "linear-gradient(180deg, rgba(71,85,105,0.95) 0%, rgba(51,65,85,0.98) 100%)",
                        color: "#e2e8f0",
                        borderColor: "rgba(148,163,184,0.35)",
                      }
                    : { background: "linear-gradient(135deg,#38bdf8,#6366f1)", color: "#0b1220" }
                }
                onClick={() => handleActivateVip({ days: 7, cost: 20, itemId: vkBridge.VK_ITEM_IDS.vip_7d })}
              >
                {isVip ? (
                  "Уже VIP"
                ) : voiceBalance < 20 ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Не хватает 20
                    <Heart className="h-4 w-4 shrink-0 text-rose-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Купить за 20
                    <Heart className="h-4 w-4 shrink-0 text-rose-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                )}
              </Button>
            </div>

            {/* 30 дней */}
            <div className="flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.07] via-slate-950/90 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex flex-1 flex-col px-4 pt-4 pb-2">
                <div className="mb-2 flex items-center gap-2 text-cyan-400/80">
                  <CalendarDays className="h-4 w-4" strokeWidth={mdIconStroke} aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Выгодно</span>
                </div>
                <p className="text-xl font-black tracking-tight text-slate-50">30 дней</p>
                <p className="mt-2 text-sm leading-snug text-slate-500">Максимум преимуществ на месяц вперёд.</p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || voiceBalance < 70}
                className={`${ctaPrimaryClass} mt-auto h-12 shrink-0 rounded-none rounded-b-2xl border-x-0 border-b-0 border-t border-cyan-500/25 disabled:!opacity-100`}
                style={
                  !!isVip || voiceBalance < 70
                    ? {
                        background: "linear-gradient(180deg, rgba(71,85,105,0.95) 0%, rgba(51,65,85,0.98) 100%)",
                        color: "#e2e8f0",
                        borderColor: "rgba(148,163,184,0.35)",
                      }
                    : { background: "linear-gradient(135deg,#22d3ee,#6366f1)", color: "#0b1220" }
                }
                onClick={() => handleActivateVip({ days: 30, cost: 70, itemId: vkBridge.VK_ITEM_IDS.vip_30d })}
              >
                {isVip ? (
                  "Уже VIP"
                ) : voiceBalance < 70 ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Не хватает 70
                    <Heart className="h-4 w-4 shrink-0 text-rose-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Купить за 70
                    <Heart className="h-4 w-4 shrink-0 text-rose-300" strokeWidth={mdIconStroke} fill="none" aria-hidden />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Пакет эмоций */}
        <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-4 ${sectionCardClass}`}>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm sm:text-base font-semibold text-slate-100">
              {"Эмоции: +50 каждого вида"}
            </span>
            <span className={subtleTextClass}>
              {"Добавляет +50 к дневному лимиту 💋 🍺 🍹 за 5 ❤"}
            </span>
            <span className="text-xs text-cyan-200/90">
              {"Текущий лимит на сегодня: "}{totalDailyLimitPerType}
            </span>
          </div>
          <Button
            size="sm"
            disabled={voiceBalance < emotionPackCost}
            className={`${ctaPrimaryClass} h-10 w-auto min-w-[146px] px-4`}
            style={{ background: "linear-gradient(135deg,#22d3ee,#6366f1)" }}
            onClick={handleBuyEmotionPack}
          >
            {voiceBalance < emotionPackCost ? "Не хватает ❤" : "Купить за 5 ❤"}
          </Button>
        </div>

        {/* Обмен валюты: Сердца ↔ Розы */}
        <div className={`overflow-hidden p-0 ${sectionCardClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-cyan-400/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/25">
                <ArrowRightLeft className="h-5 w-5 text-cyan-300" strokeWidth={mdIconStroke} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Обмен</p>
                <h2 className="text-base font-bold tracking-tight text-slate-50">Конвертация</h2>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
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
            <div className="flex w-full">
              <div className="flex w-full rounded-2xl bg-slate-950/95 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-slate-600/60">
                <button
                  type="button"
                  onClick={() => setExchangeTab("voices-to-roses")}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[0.65rem] px-3 py-2 text-sm font-bold transition-all sm:px-5 ${
                    exchangeTab === "voices-to-roses"
                      ? "bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-400 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_24px_rgba(34,211,238,0.28)]"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "voices-to-roses" ? "text-slate-900" : "text-cyan-400/90"}`}
                    strokeWidth={mdIconStroke}
                    fill="none"
                    aria-hidden
                  />
                  <span className="truncate">Сердца → Розы</span>
                  <Flower2
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "voices-to-roses" ? "text-slate-900" : "text-fuchsia-400"}`}
                    strokeWidth={mdIconStroke}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setExchangeTab("roses-to-voices")}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[0.65rem] px-3 py-2 text-sm font-bold transition-all sm:px-5 ${
                    exchangeTab === "roses-to-voices"
                      ? "bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-400 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_24px_rgba(34,211,238,0.28)]"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                  }`}
                >
                  <Flower2
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "roses-to-voices" ? "text-slate-900" : "text-fuchsia-400"}`}
                    strokeWidth={mdIconStroke}
                    aria-hidden
                  />
                  <span className="truncate">Розы → Сердца</span>
                  <Heart
                    className={`h-4 w-4 shrink-0 ${exchangeTab === "roses-to-voices" ? "text-slate-900" : "text-cyan-400/90"}`}
                    strokeWidth={mdIconStroke}
                    fill="none"
                    aria-hidden
                  />
                </button>
              </div>
            </div>

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
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
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

        {/* Добавить друзей */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-3 ${sectionCardClass}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/80">
              <Users className="h-5 w-5 text-slate-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100">{"Добавить друзей"}</span>
              <span className={subtleTextClass}>{"Пригласите друзей в игру — веселее вместе"}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className={`${ctaSecondaryClass} h-9 px-4`}
            onClick={handleInviteFriends}
          >
            {"Пригласить"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className={ctaSecondaryClass}
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "game" })}
          >
            {"Назад к столу"}
          </Button>
        </div>
      </div>
      </div>
    </div>
  )
}

