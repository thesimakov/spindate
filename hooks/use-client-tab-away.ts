"use client"

import { useCallback, useEffect, useRef } from "react"
import type { GameAction } from "@/lib/game-types"

const AWAY_AFTER_MS = 5 * 60 * 1000
const CHECK_INTERVAL_MS = 4000

export interface UseClientTabAwayParams {
  enabled: boolean
  userId: number | undefined | null
  isAway: boolean
  tablePaused: boolean | undefined
  tableLoading: boolean
  dispatch: (action: GameAction) => void
}

/**
 * Через 5 минут неактивности (видимая вкладка) или 5 минут свёрнутой вкладки —
 * помечает игрока как «ушёл» (синхронизируется на стол для zzz у других).
 */
export function useClientTabAwayPresence({
  enabled,
  userId,
  isAway,
  tablePaused,
  tableLoading,
  dispatch,
}: UseClientTabAwayParams) {
  const lastActivityRef = useRef(Date.now())
  const hiddenSinceRef = useRef<number | null>(null)

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (!userId || !enabled || tablePaused || tableLoading) return

    const onActivity = () => {
      if (!document.hidden) bumpActivity()
    }
    window.addEventListener("pointerdown", onActivity, true)
    window.addEventListener("keydown", onActivity, true)
    return () => {
      window.removeEventListener("pointerdown", onActivity, true)
      window.removeEventListener("keydown", onActivity, true)
    }
  }, [userId, enabled, tablePaused, tableLoading, bumpActivity])

  useEffect(() => {
    if (!userId || !enabled || tablePaused || tableLoading) return

    const onVis = () => {
      if (document.hidden) {
        if (hiddenSinceRef.current == null) hiddenSinceRef.current = Date.now()
      } else {
        hiddenSinceRef.current = null
        bumpActivity()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    onVis()
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [userId, enabled, tablePaused, tableLoading, bumpActivity])

  useEffect(() => {
    if (!userId || !enabled || tablePaused || tableLoading) return

    const id = window.setInterval(() => {
      if (isAway) return
      const now = Date.now()
      let shouldAway = false
      if (document.hidden && hiddenSinceRef.current != null) {
        shouldAway = now - hiddenSinceRef.current >= AWAY_AFTER_MS
      } else if (!document.hidden) {
        shouldAway = now - lastActivityRef.current >= AWAY_AFTER_MS
      }
      if (shouldAway) {
        dispatch({ type: "SET_CLIENT_TAB_AWAY", playerId: userId, away: true })
      }
    }, CHECK_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [userId, enabled, tablePaused, tableLoading, isAway, dispatch])

  const returnFromAway = useCallback(() => {
    if (!userId) return
    lastActivityRef.current = Date.now()
    dispatch({ type: "SET_CLIENT_TAB_AWAY", playerId: userId, away: false })
  }, [userId, dispatch])

  return { returnFromAway, bumpActivity }
}
