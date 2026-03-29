"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { generateLogId } from "@/lib/game-context"
import type { Player, GameAction } from "@/lib/game-types"

const TURN_MS = 15_000
const RESULT_AUTO_ADVANCE_MS = 8000
const RESULT_TICK_MS = 1000
const TURN_TICK_MS = 250
const STEAM_FOG_TICK_MS = 400
const PREDICTION_DURATION = 10
const AFK_SKIP_MS = 18_000

export interface AvatarSteamFog {
  until: number
  level: number
}

export interface UseGameTimersParams {
  tableId: number
  roundNumber: number
  currentTurnIndex: number
  currentTurnPlayer: Player | undefined
  currentUser: Player | null
  isSpinning: boolean
  showResult: boolean
  countdown: number | null
  predictionPhase: boolean
  dispatch: (action: GameAction) => void
  handleSpin: () => void
  playersRef: React.RefObject<Player[]>
  casualMode: boolean
  /** Пока true — все таймеры заблокированы (стол ещё загружается). */
  tableLoading?: boolean
}

export interface UseGameTimersResult {
  turnTimer: number | null
  predictionTimer: number
  steamFogTick: number
  avatarSteamFog: Record<string, AvatarSteamFog>
  setAvatarSteamFog: React.Dispatch<React.SetStateAction<Record<string, AvatarSteamFog>>>
  resultTimerRef: React.RefObject<ReturnType<typeof setInterval> | null>
  autoAdvanceRef: React.RefObject<ReturnType<typeof setTimeout> | null>
  clearResultTimers: () => void
}

export function useGameTimers({
  tableId,
  roundNumber,
  currentTurnIndex,
  currentTurnPlayer,
  currentUser,
  isSpinning,
  showResult,
  countdown,
  predictionPhase,
  dispatch,
  handleSpin,
  playersRef,
  casualMode,
  tableLoading = false,
}: UseGameTimersParams): UseGameTimersResult {
  // --- Turn timer ---
  const [turnTimer, setTurnTimer] = useState<number | null>(null)
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const turnGuardRef = useRef<{
    key: string | null
    deadlineTs: number
    skipTimeout: ReturnType<typeof setTimeout> | null
  }>({ key: null, deadlineTs: 0, skipTimeout: null })

  useEffect(() => {
    const isEligible =
      !tableLoading &&
      !!currentTurnPlayer &&
      !currentTurnPlayer.isBot &&
      currentUser?.id === currentTurnPlayer.id &&
      !isSpinning &&
      !showResult &&
      countdown === null

    const key =
      isEligible && currentTurnPlayer
        ? `${tableId}:${roundNumber}:${currentTurnIndex}:${currentTurnPlayer.id}`
        : null

    const prevKey = turnGuardRef.current.key
    if (!key || (prevKey && key !== prevKey)) {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current)
        turnTimerRef.current = null
      }
      if (turnGuardRef.current.skipTimeout) {
        clearTimeout(turnGuardRef.current.skipTimeout)
        turnGuardRef.current.skipTimeout = null
      }
      turnGuardRef.current.key = key
      turnGuardRef.current.deadlineTs = 0
      setTurnTimer(null)
    }

    if (!key) return

    if (turnGuardRef.current.key === key && turnGuardRef.current.deadlineTs > 0) return

    const deadlineTs = Date.now() + TURN_MS
    turnGuardRef.current.key = key
    turnGuardRef.current.deadlineTs = deadlineTs

    if (turnTimerRef.current) clearInterval(turnTimerRef.current)
    const tick = () => {
      const leftMs = Math.max(0, deadlineTs - Date.now())
      const leftSec = Math.ceil(leftMs / 1000)
      setTurnTimer(leftSec)
      if (leftSec <= 0 && turnTimerRef.current) {
        clearInterval(turnTimerRef.current)
        turnTimerRef.current = null
      }
    }
    tick()
    turnTimerRef.current = setInterval(tick, TURN_TICK_MS)

    if (turnGuardRef.current.skipTimeout) clearTimeout(turnGuardRef.current.skipTimeout)
    turnGuardRef.current.skipTimeout = setTimeout(() => {
      if (turnGuardRef.current.key !== key) return
      if (!currentTurnPlayer) return
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentTurnPlayer,
          text: `${currentTurnPlayer.name} пропускает ход`,
          timestamp: Date.now(),
        },
      })
      dispatch({ type: "NEXT_TURN" })
    }, TURN_MS + 25)

    return () => {}
  }, [tableId, roundNumber, currentTurnIndex, currentTurnPlayer?.id, currentTurnPlayer?.isBot, currentUser?.id, isSpinning, showResult, countdown, dispatch, tableLoading])

  // --- Auto-skip for OTHER live players who went AFK ---
  useEffect(() => {
    if (tableLoading) return
    if (!currentTurnPlayer || currentTurnPlayer.isBot) return
    if (!currentUser || currentUser.id === currentTurnPlayer.id) return
    if (isSpinning || showResult || countdown !== null) return

    const timeout = setTimeout(() => {
      const liveIds = playersRef.current.filter(p => !p.isBot).map(p => p.id).sort((a, b) => a - b)
      if (!currentUser || liveIds[0] !== currentUser.id) return

      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentTurnPlayer,
          text: `${currentTurnPlayer.name} пропускает ход`,
          timestamp: Date.now(),
        },
      })
      dispatch({ type: "NEXT_TURN" })
    }, AFK_SKIP_MS)

    return () => clearTimeout(timeout)
  }, [currentTurnPlayer, currentUser, isSpinning, showResult, countdown, dispatch, playersRef, tableLoading])

  // --- Result timer + auto-advance ---
  const resultTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResultTimers = useCallback(() => {
    if (resultTimerRef.current) { clearInterval(resultTimerRef.current); resultTimerRef.current = null }
    if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null }
  }, [])

  useEffect(() => {
    if (!showResult || tableLoading) {
      clearResultTimers()
      return
    }

    resultTimerRef.current = setInterval(() => {
      // Drives re-render only for the result display
    }, RESULT_TICK_MS)

    autoAdvanceRef.current = setTimeout(() => {
      dispatch({ type: "NEXT_TURN" })
    }, RESULT_AUTO_ADVANCE_MS)

    return clearResultTimers
  }, [showResult, dispatch, clearResultTimers, tableLoading])

  // --- Prediction timer ---
  const [predictionTimer, setPredictionTimer] = useState<number>(PREDICTION_DURATION)
  const predictionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (casualMode) return
    setPredictionTimer(PREDICTION_DURATION)
    if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
  }, [roundNumber, casualMode])

  useEffect(() => {
    if (casualMode || tableLoading) return
    if (!predictionPhase || isSpinning || showResult) {
      if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
      return
    }

    setPredictionTimer(PREDICTION_DURATION)
    predictionTimerRef.current = setInterval(() => {
      setPredictionTimer((prev) => {
        if (prev <= 1) {
          if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
    }
  }, [predictionPhase, isSpinning, showResult, casualMode, tableLoading])

  useEffect(() => {
    if (casualMode || tableLoading) return
    if (predictionTimer === 0 && predictionPhase && !isSpinning && !showResult && countdown === null) {
      handleSpin()
    }
  }, [predictionTimer, predictionPhase, isSpinning, showResult, countdown, handleSpin, casualMode, tableLoading])

  // --- Steam fog tick ---
  const [steamFogTick, setSteamFogTick] = useState(0)
  const [avatarSteamFog, setAvatarSteamFog] = useState<Record<string, AvatarSteamFog>>({})

  useEffect(() => {
    const id = window.setInterval(() => {
      setSteamFogTick((t) => t + 1)
      setAvatarSteamFog((prev) => {
        const now = Date.now()
        let changed = false
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          if (next[key].until <= now) {
            delete next[key]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, STEAM_FOG_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  return {
    turnTimer,
    predictionTimer,
    steamFogTick,
    avatarSteamFog,
    setAvatarSteamFog,
    resultTimerRef,
    autoAdvanceRef,
    clearResultTimers,
  }
}
