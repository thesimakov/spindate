"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { generateLogId } from "@/lib/game-context"
import type { Player, GameAction } from "@/lib/game-types"
import { getRoundDriverPlayerId } from "@/lib/round-driver-id"

const TURN_MS = 15_000
const RESULT_AUTO_ADVANCE_MS = 8000
const TURN_TICK_MS = 500
const STEAM_FOG_TICK_MS = 400
const PREDICTION_DURATION = 10
/** Небольшой запас только на тик/рендер: визуальный 0 = почти мгновенный автопасс. */
const AFK_SKIP_MS = TURN_MS + TURN_TICK_MS

export interface AvatarSteamFog {
  until: number
  level: number
}

export interface UseGameTimersParams {
  tableId: number
  roundNumber: number
  currentTurnIndex: number
  turnStartedAtMs?: number | null
  currentTurnPlayer: Player | undefined
  currentUser: Player | null
  isSpinning: boolean
  showResult: boolean
  /** Видна центральная модалка «Поцелуются?» — авто-NEXT_TURN по таймеру результата отключаем. */
  pairKissCenterUi: boolean
  countdown: number | null
  predictionPhase: boolean
  dispatch: (action: GameAction) => void
  handleSpin: () => void
  playersRef: React.RefObject<Player[]>
  casualMode: boolean
  /** Пока true — все таймеры заблокированы (стол ещё загружается). */
  tableLoading?: boolean
  /** Сервер подтвердил место игрока за live-столом. */
  seatConfirmed?: boolean
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
  turnStartedAtMs,
  currentTurnPlayer,
  currentUser,
  isSpinning,
  showResult,
  pairKissCenterUi,
  countdown,
  predictionPhase,
  dispatch,
  handleSpin,
  playersRef,
  casualMode,
  tableLoading = false,
  seatConfirmed = false,
}: UseGameTimersParams): UseGameTimersResult {
  const currentTurnPlayerRef = useRef(currentTurnPlayer)
  const currentUserRef = useRef(currentUser)
  const showResultRef = useRef(showResult)
  const pairKissCenterUiRef = useRef(pairKissCenterUi)
  const predictionPhaseRef = useRef(predictionPhase)
  const isSpinningRef = useRef(isSpinning)
  const countdownRef = useRef(countdown)
  const seatConfirmedRef = useRef(seatConfirmed)
  useEffect(() => {
    currentTurnPlayerRef.current = currentTurnPlayer
  }, [currentTurnPlayer])
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])
  useEffect(() => {
    showResultRef.current = showResult
  }, [showResult])
  useEffect(() => {
    pairKissCenterUiRef.current = pairKissCenterUi
  }, [pairKissCenterUi])
  useEffect(() => {
    predictionPhaseRef.current = predictionPhase
  }, [predictionPhase])
  useEffect(() => {
    isSpinningRef.current = isSpinning
  }, [isSpinning])
  useEffect(() => {
    countdownRef.current = countdown
  }, [countdown])
  useEffect(() => {
    seatConfirmedRef.current = seatConfirmed
  }, [seatConfirmed])

  const isRoundDriver = useCallback(() => {
    const me = currentUserRef.current
    if (!me) return false
    const id = getRoundDriverPlayerId(playersRef.current)
    return id != null && id === me.id
  }, [playersRef])

  const emitTurnSyncClientLog = useCallback(
    (
      reason: "skip_timer" | "skip_afk" | "flush_skip_timer" | "flush_skip_afk",
      turnPlayer: Player | null | undefined,
    ) => {
      if (process.env.NODE_ENV !== "development") return
      const pid = turnPlayer?.id ?? null
      const turnKey = pid != null ? `${tableId}:${roundNumber}:${currentTurnIndex}:${pid}` : null
      console.debug("[turn-sync]", {
        source: "client",
        reason,
        tableId,
        roundNumber,
        currentTurnIndex,
        turnPlayerId: pid,
        turnKey,
        isRoundDriver: isRoundDriver(),
        seatConfirmed: seatConfirmedRef.current,
      })
    },
    [tableId, roundNumber, currentTurnIndex, isRoundDriver],
  )

  const afkGuardRef = useRef<{ key: string | null; startedAt: number }>({ key: null, startedAt: 0 })
  const afkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultGuardRef = useRef<{ key: string | null; startedAt: number }>({ key: null, startedAt: 0 })
  const predGuardRef = useRef<{ key: string | null; startedAt: number }>({ key: null, startedAt: 0 })
  const handleSpinRef = useRef(handleSpin)
  useEffect(() => {
    handleSpinRef.current = handleSpin
  }, [handleSpin])

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
      seatConfirmed &&
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

    const startTs =
      typeof turnStartedAtMs === "number" && Number.isFinite(turnStartedAtMs)
        ? turnStartedAtMs
        : Date.now()
    const deadlineTs = startTs + TURN_MS
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
      if (!isRoundDriver()) return
      emitTurnSyncClientLog("skip_timer", currentTurnPlayer)
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
    }, TURN_MS + TURN_TICK_MS)

    return () => {
      if (turnTimerRef.current) { clearInterval(turnTimerRef.current); turnTimerRef.current = null }
      if (turnGuardRef.current.skipTimeout) { clearTimeout(turnGuardRef.current.skipTimeout); turnGuardRef.current.skipTimeout = null }
    }
  }, [tableId, roundNumber, currentTurnIndex, turnStartedAtMs, currentTurnPlayer?.id, currentTurnPlayer?.isBot, currentUser?.id, isSpinning, showResult, countdown, dispatch, tableLoading, seatConfirmed, isRoundDriver, emitTurnSyncClientLog])

  // --- Auto-skip for OTHER live players who went AFK ---
  useEffect(() => {
    if (tableLoading) return
    if (!seatConfirmed) return
    if (!currentTurnPlayer || currentTurnPlayer.isBot) return
    if (!currentUser || currentUser.id === currentTurnPlayer.id) return
    if (isSpinning || showResult || countdown !== null) return

    const afkKey = `${currentTurnPlayer.id}:${roundNumber}:${currentTurnIndex}`
    afkGuardRef.current = { key: afkKey, startedAt: Date.now() }

    if (afkTimeoutRef.current) clearTimeout(afkTimeoutRef.current)
    afkTimeoutRef.current = setTimeout(() => {
      afkTimeoutRef.current = null
      const rd = getRoundDriverPlayerId(playersRef.current)
      if (!currentUser || rd !== currentUser.id) return

      emitTurnSyncClientLog("skip_afk", currentTurnPlayer)
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

    return () => {
      if (afkTimeoutRef.current) {
        clearTimeout(afkTimeoutRef.current)
        afkTimeoutRef.current = null
      }
    }
  }, [currentTurnPlayer, currentUser, isSpinning, showResult, countdown, dispatch, playersRef, tableLoading, seatConfirmed, roundNumber, currentTurnIndex, emitTurnSyncClientLog])

  // --- Result timer + auto-advance ---
  const resultTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResultTimers = useCallback(() => {
    if (resultTimerRef.current) { clearInterval(resultTimerRef.current); resultTimerRef.current = null }
    if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null }
  }, [])

  useEffect(() => {
    if (!showResult || tableLoading || pairKissCenterUi || !seatConfirmed) {
      clearResultTimers()
      return
    }

    resultGuardRef.current = {
      key: `${roundNumber}:${currentTurnIndex}:result`,
      startedAt: Date.now(),
    }

    resultTimerRef.current = null

    autoAdvanceRef.current = setTimeout(() => {
      if (!isRoundDriver()) return
      dispatch({ type: "NEXT_TURN" })
    }, RESULT_AUTO_ADVANCE_MS)

    return clearResultTimers
  }, [showResult, pairKissCenterUi, dispatch, clearResultTimers, tableLoading, seatConfirmed, roundNumber, currentTurnIndex])

  // --- Prediction timer ---
  const [predictionTimer, setPredictionTimer] = useState<number>(PREDICTION_DURATION)
  const predictionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (casualMode || !seatConfirmed) return
    setPredictionTimer(PREDICTION_DURATION)
    if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
  }, [roundNumber, casualMode, seatConfirmed])

  useEffect(() => {
    if (casualMode || tableLoading || !seatConfirmed) return
    if (!predictionPhase || isSpinning || showResult) {
      if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
      return
    }

    setPredictionTimer(PREDICTION_DURATION)
    predGuardRef.current = {
      key: `${roundNumber}:${currentTurnIndex}:pred`,
      startedAt: Date.now(),
    }
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
  }, [predictionPhase, isSpinning, showResult, casualMode, tableLoading, seatConfirmed, roundNumber, currentTurnIndex])

  useEffect(() => {
    if (casualMode || tableLoading || !seatConfirmed) return
    if (predictionTimer === 0 && predictionPhase && !isSpinning && !showResult && countdown === null) {
      handleSpin()
    }
  }, [predictionTimer, predictionPhase, isSpinning, showResult, countdown, handleSpin, casualMode, tableLoading, seatConfirmed])

  // --- Фоновые вкладки тормозят setTimeout: при возврате догоняем просроченные ходы ---
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "visible" || tableLoading || !seatConfirmedRef.current) return

      const g = turnGuardRef.current
      const tp = currentTurnPlayerRef.current
      const cu = currentUserRef.current
      if (g.key && g.deadlineTs > 0 && Date.now() > g.deadlineTs + 30) {
        if (
          tp &&
          !tp.isBot &&
          cu &&
          cu.id === tp.id &&
          !isSpinningRef.current &&
          !showResultRef.current &&
          countdownRef.current === null
        ) {
          if (isRoundDriver()) {
            if (g.skipTimeout) {
              clearTimeout(g.skipTimeout)
              g.skipTimeout = null
            }
            if (turnTimerRef.current) {
              clearInterval(turnTimerRef.current)
              turnTimerRef.current = null
            }
            emitTurnSyncClientLog("flush_skip_timer", tp)
            dispatch({
              type: "ADD_LOG",
              entry: {
                id: generateLogId(),
                type: "system",
                fromPlayer: tp,
                text: `${tp.name} пропускает ход`,
                timestamp: Date.now(),
              },
            })
            dispatch({ type: "NEXT_TURN" })
            g.key = null
            g.deadlineTs = 0
          }
        }
      }

      const ag = afkGuardRef.current
      if (ag.key && Date.now() - ag.startedAt >= AFK_SKIP_MS) {
        const ctp = currentTurnPlayerRef.current
        const curUser = currentUserRef.current
        if (
          ctp &&
          !ctp.isBot &&
          curUser &&
          curUser.id !== ctp.id &&
          !isSpinningRef.current &&
          !showResultRef.current &&
          countdownRef.current === null
        ) {
          const rd = getRoundDriverPlayerId(playersRef.current)
          if (curUser && rd === curUser.id) {
            if (afkTimeoutRef.current) {
              clearTimeout(afkTimeoutRef.current)
              afkTimeoutRef.current = null
            }
            emitTurnSyncClientLog("flush_skip_afk", ctp)
            dispatch({
              type: "ADD_LOG",
              entry: {
                id: generateLogId(),
                type: "system",
                fromPlayer: ctp,
                text: `${ctp.name} пропускает ход`,
                timestamp: Date.now(),
              },
            })
            dispatch({ type: "NEXT_TURN" })
            ag.key = null
          }
        }
      }

      if (
        showResultRef.current &&
        !pairKissCenterUiRef.current &&
        resultGuardRef.current.key &&
        Date.now() - resultGuardRef.current.startedAt >= RESULT_AUTO_ADVANCE_MS + 50
      ) {
        if (autoAdvanceRef.current) {
          clearTimeout(autoAdvanceRef.current)
          autoAdvanceRef.current = null
        }
        if (!isRoundDriver()) return
        dispatch({ type: "NEXT_TURN" })
        resultGuardRef.current.key = null
      }

      const pg = predGuardRef.current
      if (
        !casualMode &&
        predictionPhaseRef.current &&
        !isSpinningRef.current &&
        !showResultRef.current &&
        countdownRef.current === null &&
        pg.key &&
        Date.now() - pg.startedAt >= PREDICTION_DURATION * 1000
      ) {
        handleSpinRef.current()
      }
    }
    document.addEventListener("visibilitychange", flush)
    window.addEventListener("focus", flush)
    return () => {
      document.removeEventListener("visibilitychange", flush)
      window.removeEventListener("focus", flush)
    }
  }, [tableLoading, dispatch, playersRef, casualMode, isRoundDriver, emitTurnSyncClientLog])

  // --- Steam fog tick ---
  const [steamFogTick, setSteamFogTick] = useState(0)
  const [avatarSteamFog, setAvatarSteamFog] = useState<Record<string, AvatarSteamFog>>({})
  const hasActiveSteamFog = Object.keys(avatarSteamFog).length > 0

  useEffect(() => {
    if (!hasActiveSteamFog) return
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
  }, [hasActiveSteamFog])

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
