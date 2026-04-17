"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useGame, generateLogId } from "@/lib/game-context"
import { DailyStreakBonusDialog } from "@/components/daily-streak-bonus-dialog"
import { computeNextStreakDay, getDailyStreakReward } from "@/lib/daily-streak-rewards"
import { AppLoader } from "@/components/app-loader"
import { persistUserGameState } from "@/lib/persist-user-game-state"
import type { GameLogEntry, InventoryItem } from "@/lib/game-types"
import { isUiTourDone, UI_TOUR_ENABLED } from "@/lib/ui-tour-storage"
import { BetaWelcomeModal } from "@/components/beta-welcome-modal"
import { readBetaWelcomeAcknowledged, writeBetaWelcomeAcknowledged } from "@/lib/beta-welcome-session"

const WELCOME_GIFT_KEY = "spindate_welcome_gift_v1"

/**
 * После авторизации, до лобби: ежедневная серия наград (тот же диалог, что раньше был в GameRoom).
 */
export function DailyStreakGateScreen() {
  const { state, dispatch } = useGame()
  const currentUser = state.currentUser
  const voiceBalance = state.voiceBalance ?? 0
  const inventory = state.inventory

  const [hydrated, setHydrated] = useState(false)
  /** Сдвиг после записи welcome в LS — чтобы welcomeComplete пересчитался (логин +150 ❤). */
  const [welcomeLsBump, setWelcomeLsBump] = useState(0)
  const [welcomeClaimedForSession, setWelcomeClaimedForSession] = useState(false)
  const [showWelcomeGift, setShowWelcomeGift] = useState(false)
  const [dailyDay, setDailyDay] = useState(1)
  const [dailyClaimedToday, setDailyClaimedToday] = useState(false)

  /** Прочитали sessionStorage; пока нет — не уводим в лобби мимо бета-окна. */
  const [betaSessionChecked, setBetaSessionChecked] = useState(false)
  const [betaWelcomeDone, setBetaWelcomeDone] = useState(false)

  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const dailyBonusTodayKey = todayDate.toISOString().slice(0, 10)

  const yesterdayDate = new Date()
  yesterdayDate.setHours(0, 0, 0, 0)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const dailyBonusYesterdayKey = yesterdayDate.toISOString().slice(0, 10)

  const welcomeComplete = useMemo(() => {
    if (!currentUser) return false
    try {
      const raw = localStorage.getItem(WELCOME_GIFT_KEY)
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      return !!stored[String(currentUser.id)]
    } catch {
      return false
    }
  }, [currentUser?.id, welcomeClaimedForSession, welcomeLsBump])

  useEffect(() => {
    if (!currentUser) return
    try {
      const raw = localStorage.getItem(WELCOME_GIFT_KEY)
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      if (currentUser.authProvider === "login" && voiceBalance >= 150) {
        if (!stored[String(currentUser.id)]) {
          stored[String(currentUser.id)] = true
          localStorage.setItem(WELCOME_GIFT_KEY, JSON.stringify(stored))
          setWelcomeLsBump((n) => n + 1)
        }
        return
      }
      if (!stored[String(currentUser.id)]) {
        setShowWelcomeGift(true)
      }
    } catch {
      setShowWelcomeGift(true)
    }
  }, [currentUser?.id, currentUser?.authProvider, voiceBalance])

  useEffect(() => {
    setBetaWelcomeDone(readBetaWelcomeAcknowledged())
    setBetaSessionChecked(true)
  }, [])

  useEffect(() => {
    if (!currentUser) return
    try {
      const welcomeRaw = localStorage.getItem(WELCOME_GIFT_KEY)
      const welcomeStored = welcomeRaw ? (JSON.parse(welcomeRaw) as Record<string, boolean>) : {}
      if (!welcomeStored[String(currentUser.id)]) {
        setHydrated(true)
        return
      }

      const raw = localStorage.getItem("botl_daily_bonus_v1")
      const parsed = raw ? (JSON.parse(raw) as { lastClaimDate?: string; streakDay?: number }) : {}
      const last = parsed.lastClaimDate
      const streak = typeof parsed.streakDay === "number" ? parsed.streakDay : 0

      if (last === dailyBonusTodayKey) {
        setDailyDay(computeNextStreakDay(last, streak, dailyBonusTodayKey, dailyBonusYesterdayKey))
        setDailyClaimedToday(true)
        setHydrated(true)
        return
      }

      const nextDay = computeNextStreakDay(last, streak, dailyBonusTodayKey, dailyBonusYesterdayKey)
      setDailyDay(nextDay)
      setDailyClaimedToday(false)
      setHydrated(true)
    } catch {
      setDailyDay(1)
      setDailyClaimedToday(false)
      setHydrated(true)
    }
  }, [currentUser, dailyBonusTodayKey, dailyBonusYesterdayKey, welcomeClaimedForSession, welcomeLsBump])

  const goLobby = useCallback(() => {
    if (UI_TOUR_ENABLED && currentUser && !isUiTourDone(currentUser.id)) {
      dispatch({ type: "SET_SCREEN", screen: "ui-tour" })
    } else {
      dispatch({ type: "SET_SCREEN", screen: "lobby" })
    }
  }, [currentUser, dispatch])

  useEffect(() => {
    if (!currentUser) {
      dispatch({ type: "SET_SCREEN", screen: "registration" })
    }
  }, [currentUser, dispatch])

  useEffect(() => {
    if (!currentUser || !hydrated || !betaWelcomeDone) return
    if (dailyClaimedToday) {
      goLobby()
    }
  }, [currentUser, hydrated, dailyClaimedToday, goLobby, betaWelcomeDone])

  useEffect(() => {
    if (!betaWelcomeDone) return
    if (hydrated && !dailyClaimedToday && !showWelcomeGift && !welcomeComplete) {
      goLobby()
    }
  }, [hydrated, dailyClaimedToday, showWelcomeGift, welcomeComplete, goLobby, betaWelcomeDone])

  const handleClaimStreakBonus = useCallback(async () => {
    if (dailyClaimedToday || !currentUser) return
    const spec = getDailyStreakReward(dailyDay)
    if (!spec) return

    const vb = voiceBalance
    let nextVoice = vb
    let nextInventory: InventoryItem[] = inventory

    if (spec.kind === "hearts") {
      nextVoice = vb + spec.amount
      dispatch({ type: "PAY_VOICES", amount: -spec.amount })
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentUser,
          text: `${currentUser.name} получил(а) ежедневный бонус: +${spec.amount} сердец`,
          timestamp: Date.now(),
        } satisfies GameLogEntry,
      })
    } else if (spec.kind === "roses") {
      const base = Date.now()
      const newRoses: InventoryItem[] = Array.from({ length: spec.amount }, (_, i) => ({
        type: "rose" as const,
        fromPlayerId: 0,
        fromPlayerName: "Ежедневный бонус",
        timestamp: base + i,
      }))
      nextInventory = [...inventory, ...newRoses]
      for (const item of newRoses) {
        dispatch({ type: "ADD_INVENTORY_ITEM", item })
      }
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentUser,
          text: `${currentUser.name} получил(а) ежедневный бонус: +${spec.amount} роз`,
          timestamp: Date.now(),
        } satisfies GameLogEntry,
      })
    } else {
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentUser,
          text: `${currentUser.name} получил(а) ежедневный бонус: супер-рамка (награда будет начислена позже)`,
          timestamp: Date.now(),
        } satisfies GameLogEntry,
      })
    }

    try {
      const raw = localStorage.getItem(WELCOME_GIFT_KEY)
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      if (!stored[String(currentUser.id)]) {
        stored[String(currentUser.id)] = true
        localStorage.setItem(WELCOME_GIFT_KEY, JSON.stringify(stored))
      }
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(
        "botl_daily_bonus_v1",
        JSON.stringify({ lastClaimDate: dailyBonusTodayKey, streakDay: dailyDay }),
      )
    } catch {
      // ignore
    }

    await persistUserGameState(currentUser, nextVoice, nextInventory)

    setDailyClaimedToday(true)
    setShowWelcomeGift(false)
    setWelcomeClaimedForSession(true)
  }, [
    dailyClaimedToday,
    dailyDay,
    dailyBonusTodayKey,
    dispatch,
    currentUser,
    voiceBalance,
    inventory,
  ])

  const showStreakDialog =
    !!currentUser &&
    betaWelcomeDone &&
    hydrated &&
    !dailyClaimedToday &&
    (showWelcomeGift || welcomeComplete)

  if (!currentUser) {
    return (
      <AppLoader title="Вход…" subtitle="Перенаправление" hint="Крути и знакомься" />
    )
  }

  if (!betaSessionChecked) {
    return <AppLoader title="Загрузка…" subtitle="Почти готово" hint="Крути и знакомься" />
  }

  if (!betaWelcomeDone) {
    return (
      <BetaWelcomeModal
        open
        onContinue={() => {
          writeBetaWelcomeAcknowledged()
          setBetaWelcomeDone(true)
        }}
      />
    )
  }

  if (!hydrated || dailyClaimedToday) {
    return <AppLoader title="Загрузка…" subtitle="Почти готово" hint="Крути и знакомься" />
  }

  return (
    <div className="fixed inset-0 z-[40] bg-slate-950">
      <DailyStreakBonusDialog
        open={showStreakDialog}
        onOpenChange={() => {}}
        streakDay={dailyDay}
        onClaim={handleClaimStreakBonus}
      />
    </div>
  )
}
