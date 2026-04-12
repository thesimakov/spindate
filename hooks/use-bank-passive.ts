"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch } from "react"
import type { GameAction } from "@/lib/game-types"

/** За столом с бутылочкой: не больше столько ❤ в сутки от активного бонуса. */
export const TABLE_ACTIVE_BONUS_DAILY_CAP = 200

const INTERVAL_MS = 60_000
const AMOUNT_PER_TICK = 1
const STORAGE_PREFIX = "spindate_table_active_bonus_v1_"

function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type Stored = { dateKey: string; earnedToday: number; lastTickMs: number }

function loadState(userId: number): Stored {
  const dk = localDateKey()
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!raw) return { dateKey: dk, earnedToday: 0, lastTickMs: Date.now() }
    const p = JSON.parse(raw) as Partial<Stored>
    return {
      dateKey: typeof p.dateKey === "string" ? p.dateKey : dk,
      earnedToday: typeof p.earnedToday === "number" && Number.isFinite(p.earnedToday) ? Math.max(0, p.earnedToday) : 0,
      lastTickMs: typeof p.lastTickMs === "number" && Number.isFinite(p.lastTickMs) ? p.lastTickMs : Date.now(),
    }
  } catch {
    return { dateKey: dk, earnedToday: 0, lastTickMs: Date.now() }
  }
}

function saveState(userId: number, s: Stored) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(s))
  } catch {
    // ignore
  }
}

/**
 * Активный бонус банка: +1 ❤ каждые 60 с за столом с бутылочкой, если в комнате ≥2 живых игроков,
 * суточный потолок {@link TABLE_ACTIVE_BONUS_DAILY_CAP}. Условия «есть второй игрок» и т.д. — в `enabled` снаружи.
 */
export function useBankPassive(
  userId: number | undefined,
  dispatch: Dispatch<GameAction>,
  onGrantBurst: () => void,
  enabled: boolean,
) {
  const lastMsRef = useRef(0)
  const prevEnabledRef = useRef(false)
  const [tick, setTick] = useState(0)
  const [earnedToday, setEarnedToday] = useState(0)
  const onGrantRef = useRef(onGrantBurst)
  onGrantRef.current = onGrantBurst

  useLayoutEffect(() => {
    if (userId == null) {
      lastMsRef.current = 0
      prevEnabledRef.current = enabled
      return
    }
    const now = Date.now()
    lastMsRef.current = now
    prevEnabledRef.current = enabled
    const st = loadState(userId)
    saveState(userId, { ...st, lastTickMs: now })
    setTick((t) => t + 1)
  }, [userId, enabled])

  useEffect(() => {
    if (userId == null) {
      setEarnedToday(0)
      return
    }
    const st = loadState(userId)
    const dk = localDateKey()
    const earned = st.dateKey === dk ? st.earnedToday : 0
    setEarnedToday(earned)
  }, [userId, tick])

  useEffect(() => {
    if (userId == null) return

    if (!enabled) {
      const now = Date.now()
      lastMsRef.current = now
      prevEnabledRef.current = false
      const st = loadState(userId)
      saveState(userId, { ...st, lastTickMs: now })
      setTick((t) => t + 1)
      return
    }

    if (prevEnabledRef.current === false) {
      const now = Date.now()
      lastMsRef.current = now
      const st = loadState(userId)
      saveState(userId, { ...st, lastTickMs: now })
    }
    prevEnabledRef.current = true

    const id = window.setInterval(() => {
      const now = Date.now()
      const dk = localDateKey()
      let st = loadState(userId)
      if (st.dateKey !== dk) {
        st = { dateKey: dk, earnedToday: 0, lastTickMs: now }
        saveState(userId, st)
        setEarnedToday(0)
      }

      if (st.earnedToday >= TABLE_ACTIVE_BONUS_DAILY_CAP) {
        setTick((t) => t + 1)
        return
      }

      if (now - lastMsRef.current < INTERVAL_MS) {
        setTick((t) => t + 1)
        return
      }

      lastMsRef.current = now
      const nextEarned = st.earnedToday + 1
      const next: Stored = { dateKey: dk, earnedToday: nextEarned, lastTickMs: now }
      saveState(userId, next)
      setEarnedToday(nextEarned)
      dispatch({ type: "PAY_VOICES", amount: -AMOUNT_PER_TICK })
      onGrantRef.current()
      setTick((t) => t + 1)
    }, 1000)

    return () => window.clearInterval(id)
  }, [userId, dispatch, enabled])

  const msUntilNext = useMemo(() => {
    if (userId == null || !enabled) return 0
    const st = loadState(userId)
    const dk = localDateKey()
    const earned = st.dateKey === dk ? st.earnedToday : 0
    if (earned >= TABLE_ACTIVE_BONUS_DAILY_CAP) return 0
    return Math.max(0, lastMsRef.current + INTERVAL_MS - Date.now())
  }, [userId, tick, enabled, earnedToday])

  return { msUntilNext, earnedToday, dailyCap: TABLE_ACTIVE_BONUS_DAILY_CAP }
}

/** Обратный отсчёт m:ss до следующего тика бонуса. */
export function formatBankPassiveCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}
