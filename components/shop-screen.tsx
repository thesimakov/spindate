"use client"

import { useMemo } from "react"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame } from "@/lib/game-context"
import { vkBridge } from "@/lib/vk-bridge"

export function ShopScreen() {
  const { state, dispatch } = useGame()
  const { currentUser, voiceBalance, players, inventory } = state
  const rosesCount = inventory.filter((i) => i.type === "rose").length

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

  const isVip = players.find((p) => p.id === currentUser.id)?.isVip

  const handleBuyVip = async () => {
    if (isVip) return
    if (voiceBalance < 100) return
    const ok = await vkBridge.buyVip()
    if (!ok) return
    dispatch({ type: "PAY_VOICES", amount: 100 })
    dispatch({ type: "SET_VIP_STATUS", playerId: currentUser.id, isVip: true })
  }

  const handleTopUp500 = async () => {
    const ok =
      typeof vkBridge.buyHearts500 === "function"
        ? await vkBridge.buyHearts500()
        : await vkBridge.showPaymentWall(1)
    if (!ok) return
    dispatch({ type: "PAY_VOICES", amount: -500 })
  }

  const handleTopUp1000 = async () => {
    const ok =
      typeof vkBridge.buyHearts1000 === "function"
        ? await vkBridge.buyHearts1000()
        : await vkBridge.showPaymentWall(2)
    if (!ok) return
    dispatch({ type: "PAY_VOICES", amount: -1000 })
  }

  const handleInviteFriends = async () => {
    const ok = await vkBridge.inviteFriends()
    if (ok) {
      // Можно добавить бонус за приглашение (например, +50 сердец)
      // dispatch({ type: "PAY_VOICES", amount: -50 })
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto entry-bg-animated px-4 py-6 sm:py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
      <div className="relative z-10 w-full flex flex-col items-center">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-600/80 bg-slate-900/95 px-6 py-7 shadow-[0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-slate-100">{"Магазин"}</h1>
        <p className="mb-4 text-center text-xs text-slate-400">
          {"Здесь можно выделиться за столом и пополнить запас сердец."}
        </p>

        {/* Баланс */}
        <div className="mb-1 flex items-center justify-between rounded-xl border border-slate-600/70 bg-slate-800/90 px-3 py-2">
          <span className="text-xs font-semibold text-slate-200">{"Баланс сердец"}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-rose-400">{"❤"}</span>
            <span className="text-sm font-bold text-slate-100">{voiceBalance}</span>
          </div>
        </div>
        {/* Пополнение за голоса VK (товары для платёжных уведомлений) */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="text-[11px]" onClick={handleTopUp500}>
            {"500 ❤ — 1 голос"}
          </Button>
          <Button size="sm" variant="outline" className="text-[11px]" onClick={handleTopUp1000}>
            {"1000 ❤ — 2 голоса"}
          </Button>
        </div>

        {/* VIP-статус + покупка */}
        <div className="flex items-center justify-between rounded-xl border border-slate-600/80 bg-slate-800/95 px-3 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                background: "linear-gradient(135deg,#facc15,#f97316)",
                boxShadow: "0 0 8px rgba(250,204,21,0.8)",
              }}
            >
              <span className="text-[11px] font-extrabold text-slate-900">VIP</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100">{"VIP-статус"}</span>
              <span className="text-[11px] text-slate-400">{"Золотая рамка и значок на аватаре"}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-bold text-amber-300">{"100 сердец"}</span>
            <Button
              size="sm"
              onClick={handleBuyVip}
              disabled={!!isVip || voiceBalance < 100}
              className="h-7 px-3 text-[11px] font-semibold disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,#facc15,#f97316)",
                color: "#111827",
                border: "1px solid #a15c10",
              }}
            >
              {isVip ? "Уже VIP" : voiceBalance < 100 ? "Не хватает" : "Купить VIP"}
            </Button>
          </div>
        </div>

        {/* Обмен монет (сердечек) на розы: 5 сердец = 1 роза */}
        <div className="rounded-xl border border-slate-600/80 bg-slate-800/95 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">{"Обменять монеты на розы"}</span>
            <span className="text-xs text-slate-400">{"5 ❤ = 1 🌹"}</span>
          </div>
          <p className="mb-2 text-[11px] text-slate-400">
            {"Баланс: "}
            <span className="font-semibold text-slate-200">{voiceBalance}</span>
            {" ❤"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={voiceBalance < 5}
              onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: 1 })}
            >
              {"1 🌹 — 5 ❤"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={voiceBalance < 25}
              onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: 5 })}
            >
              {"5 🌹 — 25 ❤"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={voiceBalance < 50}
              onClick={() => dispatch({ type: "EXCHANGE_VOICES_FOR_ROSES", amount: 10 })}
            >
              {"10 🌹 — 50 ❤"}
            </Button>
          </div>
        </div>

        {/* Обмен роз на голоса: 1 роза = 5 сердец */}
        <div className="rounded-xl border border-slate-600/80 bg-slate-800/95 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">{"Обменять розы на голоса"}</span>
            <span className="text-xs text-slate-400">{"1 🌹 = 5 ❤"}</span>
          </div>
          <p className="mb-2 text-[11px] text-slate-400">
            {"У вас: "}
            <span className="font-semibold text-slate-200">{rosesCount}</span>
            {" 🌹"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={rosesCount < 1}
              onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 1 })}
            >
              {"Обменять 1 → 5 ❤"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={rosesCount < 5}
              onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: 5 })}
            >
              {"Обменять 5 → 25 ❤"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={rosesCount < 1}
              onClick={() => dispatch({ type: "EXCHANGE_ROSES_FOR_VOICES", amount: rosesCount })}
            >
              {"Все → "}{rosesCount * 5}{" ❤"}
            </Button>
          </div>
        </div>

        {/* Добавить друзей */}
        <div className="flex items-center justify-between rounded-xl border border-slate-600/80 bg-slate-800/95 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/80">
              <Users className="h-5 w-5 text-slate-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-100">{"Добавить друзей"}</span>
              <span className="text-[11px] text-slate-400">{"Пригласите друзей в игру — веселее вместе"}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-medium"
            onClick={handleInviteFriends}
          >
            {"Пригласить"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full rounded-xl text-sm border-slate-500 text-slate-200 hover:bg-slate-700/50"
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

