"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { generateLogId } from "@/lib/game-context"
import type { GameAction, Player } from "@/lib/game-types"
import { FORTUNE_WHEEL_SEGMENTS, fortuneWheelTicketsStorageKey, resolveFortuneWheelSpin } from "@/lib/fortune-wheel"

const FREE_CHANCE_INTERVAL_MS = 5 * 60 * 60 * 1000

function freeChanceKey(playerId: number): string {
  return `spindate_fortune_wheel_free_chance_v1_${playerId}`
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

type UseFortuneWheelParams = {
  currentUser: Player | null
  dispatch: (action: GameAction) => void
  voiceBalance: number
  showToast: (message: string, variant: "success" | "error" | "info") => void
}

export function useFortuneWheel({ currentUser, dispatch, voiceBalance, showToast }: UseFortuneWheelParams) {
  const [wheelTickets, setWheelTickets] = useState(3)
  const [wheelRotationDeg, setWheelRotationDeg] = useState(0)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelLastRewardText, setWheelLastRewardText] = useState<string | null>(null)
  const [nextFreeChanceTs, setNextFreeChanceTs] = useState<number>(Date.now())
  const [nowTs, setNowTs] = useState<number>(Date.now())
  const wheelSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setWheelTickets(3)
      setNextFreeChanceTs(Date.now())
      return
    }
    try {
      const rawTickets = localStorage.getItem(fortuneWheelTicketsStorageKey(currentUser.id))
      const parsedTickets = rawTickets ? Number.parseInt(rawTickets, 10) : 3
      setWheelTickets(Number.isFinite(parsedTickets) ? Math.max(0, parsedTickets) : 3)

      const rawFreeTs = localStorage.getItem(freeChanceKey(currentUser.id))
      const parsedFreeTs = rawFreeTs ? Number.parseInt(rawFreeTs, 10) : Date.now()
      setNextFreeChanceTs(Number.isFinite(parsedFreeTs) ? parsedFreeTs : Date.now())
    } catch {
      setWheelTickets(3)
      setNextFreeChanceTs(Date.now())
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser) return
    try {
      localStorage.setItem(fortuneWheelTicketsStorageKey(currentUser.id), String(Math.max(0, wheelTickets)))
    } catch {
      // ignore
    }
  }, [currentUser?.id, wheelTickets])

  useEffect(() => {
    if (!currentUser) return
    try {
      localStorage.setItem(freeChanceKey(currentUser.id), String(nextFreeChanceTs))
    } catch {
      // ignore
    }
  }, [currentUser?.id, nextFreeChanceTs])

  useEffect(() => {
    return () => {
      if (wheelSpinTimeoutRef.current) clearTimeout(wheelSpinTimeoutRef.current)
    }
  }, [])

  const grantFortuneWheelReward = useCallback(
    (segment: (typeof FORTUNE_WHEEL_SEGMENTS)[number]) => {
      if (!currentUser) return

      if (segment.kind === "hearts") {
        dispatch({ type: "PAY_VOICES", amount: -segment.amount })
        setWheelLastRewardText(`+${segment.amount} ❤`)
        dispatch({
          type: "ADD_LOG",
          entry: {
            id: generateLogId(),
            type: "system",
            fromPlayer: currentUser,
            text: `${currentUser.name} выиграл(а) в Колесе фортуны: +${segment.amount} сердец`,
            timestamp: Date.now(),
          },
        })
        showToast(`Выигрыш: +${segment.amount} сердец`, "success")
        return
      }

      if (segment.kind === "roses") {
        const base = Date.now()
        for (let i = 0; i < segment.amount; i++) {
          dispatch({
            type: "ADD_INVENTORY_ITEM",
            item: {
              type: "rose",
              fromPlayerId: 0,
              fromPlayerName: "Колесо фортуны",
              timestamp: base + i,
            },
          })
        }
        setWheelLastRewardText(`+${segment.amount} 🌹`)
        dispatch({
          type: "ADD_LOG",
          entry: {
            id: generateLogId(),
            type: "system",
            fromPlayer: currentUser,
            text: `${currentUser.name} выиграл(а) в Колесе фортуны: +${segment.amount} роз`,
            timestamp: Date.now(),
          },
        })
        showToast(`Выигрыш: +${segment.amount} роз`, "success")
        return
      }

      setWheelTickets((v) => v + segment.amount)
      setWheelLastRewardText(`+${segment.amount} 🎡`)
      showToast(`Выигрыш: +${segment.amount} бил.${segment.amount > 1 ? "ета" : "ет"}`, "success")
    },
    [currentUser, dispatch, showToast],
  )

  const spinFortuneWheel = useCallback(
    (consumeTicket: boolean) => {
      if (!currentUser) return
      if (wheelSpinning) return
      if (consumeTicket && wheelTickets <= 0) {
        showToast("Нет билетов для прокрутки", "info")
        return
      }
      if (!consumeTicket && Date.now() < nextFreeChanceTs) return

      if (consumeTicket) setWheelTickets((v) => Math.max(0, v - 1))
      else setNextFreeChanceTs(Date.now() + FREE_CHANCE_INTERVAL_MS)

      setWheelSpinning(true)
      setWheelLastRewardText(null)

      const { idx, nextRotation } = resolveFortuneWheelSpin(wheelRotationDeg, FORTUNE_WHEEL_SEGMENTS.length)
      setWheelRotationDeg(nextRotation)

      if (wheelSpinTimeoutRef.current) clearTimeout(wheelSpinTimeoutRef.current)
      wheelSpinTimeoutRef.current = setTimeout(() => {
        grantFortuneWheelReward(FORTUNE_WHEEL_SEGMENTS[idx])
        setWheelSpinning(false)
      }, 4800)
    },
    [currentUser, wheelSpinning, wheelTickets, nextFreeChanceTs, wheelRotationDeg, grantFortuneWheelReward, showToast],
  )

  const handleSpinFortuneWheel = useCallback(() => spinFortuneWheel(true), [spinFortuneWheel])
  const handleSpinFreeChance = useCallback(() => spinFortuneWheel(false), [spinFortuneWheel])

  const handleBuyWheelTickets = useCallback(
    (count: number, cost: number) => {
      if (!currentUser) return
      if (voiceBalance < cost) {
        showToast("Недостаточно сердец", "error")
        return
      }
      dispatch({ type: "PAY_VOICES", amount: cost })
      setWheelTickets((v) => v + count)
      showToast(`Куплено билетов: +${count}`, "success")
    },
    [currentUser, dispatch, showToast, voiceBalance],
  )

  const freeChanceReady = nowTs >= nextFreeChanceTs
  const freeChanceTimeLeftMs = Math.max(0, nextFreeChanceTs - nowTs)
  const freeChanceCountdown = useMemo(
    () => (freeChanceReady ? "готово" : formatCountdown(freeChanceTimeLeftMs)),
    [freeChanceReady, freeChanceTimeLeftMs],
  )

  return {
    wheelTickets,
    wheelRotationDeg,
    wheelSpinning,
    wheelLastRewardText,
    freeChanceReady,
    freeChanceCountdown,
    handleSpinFortuneWheel,
    handleSpinFreeChance,
    handleBuyWheelTickets,
  }
}
