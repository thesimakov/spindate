"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { generateLogId } from "@/lib/game-context"
import type { GameAction, Player } from "@/lib/game-types"
import {
  FORTUNE_WHEEL_SEGMENTS,
  FORTUNE_WHEEL_SPIN_COST_HEARTS,
  fortuneWheelAdSpinStorageKey,
  getLocalDateKey,
  resolveFortuneWheelSpin,
} from "@/lib/fortune-wheel"
import { isVkRuntimeEnvironment, showVkNativeAd } from "@/lib/vk-bridge"

type UseFortuneWheelParams = {
  currentUser: Player | null
  dispatch: (action: GameAction) => void
  voiceBalance: number
  showToast: (message: string, variant: "success" | "error" | "info") => void
}

export function useFortuneWheel({ currentUser, dispatch, voiceBalance, showToast }: UseFortuneWheelParams) {
  const [wheelRotationDeg, setWheelRotationDeg] = useState(0)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelLastRewardText, setWheelLastRewardText] = useState<string | null>(null)
  const [adSpinUsedToday, setAdSpinUsedToday] = useState(false)
  const [nowTick, setNowTick] = useState(0)
  const wheelSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNowTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setAdSpinUsedToday(false)
      return
    }
    try {
      const k = fortuneWheelAdSpinStorageKey(currentUser.id, getLocalDateKey())
      setAdSpinUsedToday(localStorage.getItem(k) === "1")
    } catch {
      setAdSpinUsedToday(false)
    }
  }, [currentUser?.id, nowTick])

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
    },
    [currentUser, dispatch, showToast],
  )

  const startSpinAnimation = useCallback(() => {
    if (!currentUser) return
    setWheelSpinning(true)
    setWheelLastRewardText(null)

    setWheelRotationDeg((prevDeg) => {
      const { idx, nextRotation } = resolveFortuneWheelSpin(prevDeg, FORTUNE_WHEEL_SEGMENTS.length)
      if (wheelSpinTimeoutRef.current) clearTimeout(wheelSpinTimeoutRef.current)
      wheelSpinTimeoutRef.current = setTimeout(() => {
        grantFortuneWheelReward(FORTUNE_WHEEL_SEGMENTS[idx])
        setWheelSpinning(false)
      }, 4800)
      return nextRotation
    })
  }, [currentUser, grantFortuneWheelReward])

  const handleSpinWithHearts = useCallback(() => {
    if (!currentUser) return
    if (wheelSpinning) return
    if (voiceBalance < FORTUNE_WHEEL_SPIN_COST_HEARTS) {
      showToast("Недостаточно сердец", "error")
      return
    }
    dispatch({ type: "PAY_VOICES", amount: FORTUNE_WHEEL_SPIN_COST_HEARTS })
    startSpinAnimation()
  }, [currentUser, dispatch, voiceBalance, wheelSpinning, showToast, startSpinAnimation])

  const handleSpinWithAd = useCallback(async () => {
    if (!currentUser) return
    if (wheelSpinning) return
    if (adSpinUsedToday) {
      showToast("Сегодня бесплатный спин по рекламе уже использован", "info")
      return
    }
    if (!(await isVkRuntimeEnvironment())) {
      showToast("Реклама для бесплатного спина доступна в приложении ВКонтакте", "info")
      return
    }
    let shown = false
    try {
      shown = await showVkNativeAd("reward")
    } catch {
      return
    }
    if (!shown) return
    try {
      localStorage.setItem(fortuneWheelAdSpinStorageKey(currentUser.id, getLocalDateKey()), "1")
    } catch {
      // ignore
    }
    setAdSpinUsedToday(true)
    startSpinAnimation()
  }, [adSpinUsedToday, currentUser, showToast, startSpinAnimation, wheelSpinning])

  const canAffordSpin = useMemo(
    () => voiceBalance >= FORTUNE_WHEEL_SPIN_COST_HEARTS,
    [voiceBalance],
  )

  return {
    wheelRotationDeg,
    wheelSpinning,
    wheelLastRewardText,
    adSpinUsedToday,
    canAffordSpin,
    spinCostHearts: FORTUNE_WHEEL_SPIN_COST_HEARTS,
    handleSpinWithHearts,
    handleSpinWithAd,
  }
}
