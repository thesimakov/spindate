"use client"

import { useEffect, useMemo, useState } from "react"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineToast } from "@/components/ui/inline-toast"
import { useGame } from "@/lib/game-context"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { vkBridge } from "@/lib/vk-bridge"

export function ShopScreen() {
  const { state, dispatch } = useGame()
  const { currentUser, voiceBalance, players, inventory } = state
  const { toast, showToast } = useInlineToast(1700)
  const rosesCount = inventory.filter((i) => i.type === "rose").length
  const [exchangeTab, setExchangeTab] = useState<"voices-to-roses" | "roses-to-voices">("voices-to-roses")

  const heartOffers = [
    { hearts: 5, votes: 1, priceRub: undefined as number | undefined, baseRub: undefined as number | undefined },
    { hearts: 50, votes: 3, priceRub: undefined as number | undefined, baseRub: undefined as number | undefined },
    { hearts: 150, votes: 9, priceRub: undefined as number | undefined, baseRub: undefined as number | undefined },
    { hearts: 500, votes: 25, priceRub: undefined as number | undefined, baseRub: undefined as number | undefined },
    { hearts: 1000, votes: 60, priceRub: 50, baseRub: 60 },
    { hearts: 5000, votes: 300, priceRub: 270, baseRub: 300 },
  ] as const
  const sectionCardClass =
    "rounded-2xl border border-cyan-300/25 bg-slate-900/90 shadow-[0_12px_30px_rgba(15,23,42,0.55)]"
  const subtleTextClass = "text-xs sm:text-sm text-slate-300"
  const ctaPrimaryClass =
    "h-10 w-full rounded-xl border border-cyan-200/70 text-sm font-semibold text-slate-950 shadow-[0_8px_20px_rgba(56,189,248,0.5)] disabled:opacity-60"
  const ctaSecondaryClass =
    "h-10 rounded-xl border border-cyan-300/55 bg-slate-900 text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:border-cyan-200/80"

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
  const vipTrialKey = `spindate_vip_trial_used_${currentUser.id}`
  const [vipTrialUsed, setVipTrialUsed] = useState(false)

  useEffect(() => {
    try {
      setVipTrialUsed(localStorage.getItem(vipTrialKey) === "1")
    } catch {
      setVipTrialUsed(false)
    }
  }, [vipTrialKey])

  const handleActivateVip = async ({
    days,
    cost,
    isTrial,
  }: {
    days: number
    cost: number
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

    const ok = await vkBridge.buyVip()
    if (!ok) {
      showToast("Активация VIP отменена", "error")
      return
    }

    if (cost > 0) dispatch({ type: "PAY_VOICES", amount: cost })
    const until = Date.now() + days * 24 * 60 * 60 * 1000
    dispatch({ type: "SET_VIP_STATUS", playerId: currentUser.id, isVip: true, vipUntilTs: until })
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

  const handleTopUp = async (amount: number) => {
    const ok = await vkBridge.showPaymentWall(amount)
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
            <span className="text-base sm:text-lg text-rose-400">{"❤"}</span>
            <span className="text-base sm:text-lg font-bold text-slate-100">{voiceBalance}</span>
          </div>
        </div>
        {/* Пополнение сердечек (оплата через VK по пакетам) */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {heartOffers.map((offer) => {
            const hasDiscount =
              typeof offer.priceRub === "number" &&
              typeof offer.baseRub === "number" &&
              offer.baseRub > offer.priceRub
            const discountPercent = hasDiscount
              ? Math.round((1 - offer.priceRub! / offer.baseRub!) * 100)
              : 0
            const isPopular = offer.hearts === 500
            const isBest = offer.hearts === 5000
            const votesLabel = `${offer.votes} ${offer.votes === 1 ? "голос" : "голосов"}`
            const iconConfig =
              offer.hearts >= 5000
                ? {
                    bg: "bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400",
                    ring: "ring-amber-300/80",
                    fg: "text-amber-700",
                    symbol: "👑",
                  }
                : offer.hearts >= 1000
                  ? {
                      bg: "bg-gradient-to-br from-sky-200 via-indigo-300 to-sky-400",
                      ring: "ring-sky-200/80",
                      fg: "text-sky-800",
                      symbol: "💎",
                    }
                  : offer.hearts >= 150
                    ? {
                        bg: "bg-gradient-to-br from-rose-200 via-pink-300 to-rose-400",
                        ring: "ring-rose-200/80",
                        fg: "text-rose-800",
                        symbol: "💖",
                      }
                    : {
                        bg: "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300",
                        ring: "ring-slate-200/80",
                        fg: "text-sky-600",
                        symbol: "❤",
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
                    <span className={`text-2xl drop-shadow sm:text-3xl ${iconConfig.fg}`}>{iconConfig.symbol}</span>
                  </div>
                  <div className="text-center leading-tight">
                    <div className="text-xl font-bold text-rose-300 sm:text-2xl">
                      {offer.hearts} {" ❤"}
                    </div>
                    <div className="mt-1 text-sm text-slate-200">
                      {votesLabel}
                    </div>
                    {typeof offer.priceRub === "number" && (
                      <div className={subtleTextClass}>
                        {offer.priceRub} {"₽"}
                        {typeof offer.baseRub === "number" && offer.baseRub > offer.priceRub && (
                          <span className="ml-1 line-through opacity-70">{offer.baseRub}{" ₽"}</span>
                        )}
                      </div>
                    )}
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
                  onClick={() => handleTopUp(offer.hearts)}
                >
                  {"Купить за "}{offer.votes}{" гол."}
                </Button>
              </div>
            )
          })}
        </div>

        {/* VIP-статус + покупка */}
        <div className={`flex flex-col gap-4 px-4 py-4 ${sectionCardClass}`}>
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                background: "radial-gradient(circle at 30% 0%,#facc15,#f97316 70%,#b45309)",
                boxShadow: "0 0 14px rgba(245,158,11,0.9)",
              }}
            >
              <span className="text-[13px] font-extrabold text-slate-900">VIP</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold text-slate-100">{"VIP-статус"}</span>
              <span className={subtleTextClass}>
                {"Золотая рамка и значок на аватаре, приоритетное место за столом."}
              </span>
              {isVip && vipLeftDays != null && (
                <span className="text-xs text-amber-300/90">{"Активен ещё: "}{vipLeftDays}{" дн."}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col justify-between rounded-2xl border border-amber-400/70 bg-slate-900/95 px-3 py-3 text-xs sm:text-sm">
              <div className="mb-2">
                <span className="text-sm font-semibold text-amber-300">{"3 дня"}</span>
                <p className={subtleTextClass}>{"Пробный период бесплатно"}</p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || vipTrialUsed}
                className={ctaPrimaryClass}
                style={{
                  background: "linear-gradient(135deg,#22d3ee,#6366f1)",
                }}
                onClick={() => handleActivateVip({ days: 3, cost: 0, isTrial: true })}
              >
                {isVip ? "Уже VIP" : vipTrialUsed ? "Проба использована" : "Попробовать"}
              </Button>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-slate-600/80 bg-slate-900/95 px-3 py-3 text-xs sm:text-sm">
              <div className="mb-2">
                <span className="text-sm font-semibold text-slate-100">{"7 дней"}</span>
                <p className={subtleTextClass}>{"30 ❤"}</p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || voiceBalance < 30}
                className={ctaPrimaryClass}
                style={{
                  background: "linear-gradient(135deg,#38bdf8,#6366f1)",
                }}
                onClick={() => handleActivateVip({ days: 7, cost: 30 })}
              >
                {isVip ? "Уже VIP" : voiceBalance < 30 ? "Не хватает" : "Купить"}
              </Button>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-slate-600/80 bg-slate-900/95 px-3 py-3 text-xs sm:text-sm">
              <div className="mb-2">
                <span className="text-sm font-semibold text-slate-100">{"30 дней"}</span>
                <p className={subtleTextClass}>{"100 ❤"}</p>
              </div>
              <Button
                size="lg"
                disabled={!!isVip || voiceBalance < 100}
                className={ctaPrimaryClass}
                style={{
                  background: "linear-gradient(135deg,#22d3ee,#6366f1)",
                }}
                onClick={() => handleActivateVip({ days: 30, cost: 100 })}
              >
                {isVip ? "Уже VIP" : voiceBalance < 100 ? "Не хватает" : "Купить"}
              </Button>
            </div>
          </div>
        </div>

        {/* Обмен валюты: табы Сердца ↔ Розы */}
        <div className={`px-3 py-3 ${sectionCardClass}`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">{"Конвертация"}</h2>
          </div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-slate-800/90 p-1">
              <button
                type="button"
                onClick={() => setExchangeTab("voices-to-roses")}
                className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  exchangeTab === "voices-to-roses"
                    ? "bg-cyan-400 text-slate-900"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {"Сердца → Розы"}
              </button>
              <button
                type="button"
                onClick={() => setExchangeTab("roses-to-voices")}
                className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                  exchangeTab === "roses-to-voices"
                    ? "bg-cyan-400 text-slate-900"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {"Розы → Сердца"}
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
              <span>{"5 ❤ = 1 🌹"}</span>
              <span>{"1 🌹 = 5 ❤"}</span>
            </div>
          </div>

          {exchangeTab === "voices-to-roses" ? (
            <div>
              <p className={`mb-2 ${subtleTextClass}`}>
                {"Баланс: "}
                <span className="font-semibold text-slate-200">{voiceBalance}</span>
                {" ❤"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={`${ctaSecondaryClass} h-9 rounded-full px-4 py-0.5`}
                  disabled={voiceBalance < 5}
                  onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: 1 })}
                >
                  {"1 🌹 — 5 ❤"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`${ctaSecondaryClass} h-9 rounded-full px-4 py-0.5`}
                  disabled={voiceBalance < 25}
                  onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: 5 })}
                >
                  {"5 🌹 — 25 ❤"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`${ctaSecondaryClass} h-9 rounded-full px-4 py-0.5`}
                  disabled={voiceBalance < 50}
                  onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: 10 })}
                >
                  {"10 🌹 — 50 ❤"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className={`mb-2 ${subtleTextClass}`}>
                {"У вас: "}
                <span className="font-semibold text-slate-200">{rosesCount}</span>
                {" 🌹"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={`${ctaSecondaryClass} h-9 rounded-full px-4 py-0.5`}
                  disabled={rosesCount < 1}
                  onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 1 })}
                >
                  {"Обменять 1 → 5 ❤"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`${ctaSecondaryClass} h-9 rounded-full px-4 py-0.5`}
                  disabled={rosesCount < 5}
                  onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 5 })}
                >
                  {"Обменять 5 → 25 ❤"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`${ctaSecondaryClass} h-9 rounded-full px-4 py-0.5`}
                  disabled={rosesCount < 1}
                  onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: rosesCount })}
                >
                  {"Все → "}{rosesCount * 5}{" ❤"}
                </Button>
              </div>
            </div>
          )}
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

