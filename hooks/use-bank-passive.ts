"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch } from "react"
import type { GameAction } from "@/lib/game-types"

const INTERVAL_MS = 60_000
const AMOUNT_PER_TICK = 3
const STORAGE_KEY_PREFIX = "spindate_bank_passive_v1_"

export function useBankPassive(
  userId: number | undefined,
  dispatch: Dispatch<GameAction>,
  onGrantBurst: () => void,
  enabled = true,
) {
  const lastMsRef = useRef(0)
  const prevEnabledRef = useRef(enabled)
  const [tick, setTick] = useState(0)
  const onGrantRef = useRef(onGrantBurst)
  onGrantRef.current = onGrantBurst

  useLayoutEffect(() => {
    if (userId == null) {
      lastMsRef.current = 0
      prevEnabledRef.current = enabled
      return
    }
    const key = `${STORAGE_KEY_PREFIX}${userId}`
    // На любом новом входе пользователя стартуем таймер "сейчас",
    // чтобы никогда не было догоняющих начислений за прошлые сессии/паузы.
    const now = Date.now()
    lastMsRef.current = now
    prevEnabledRef.current = enabled
    try {
      localStorage.setItem(key, JSON.stringify({ lastTickMs: now }))
    } catch {
      // ignore
    }
    setTick((t) => t + 1)
  }, [userId, enabled])

  useEffect(() => {
    if (userId == null) return

    const key = `${STORAGE_KEY_PREFIX}${userId}`
    // На паузе/away начисление выключено: не копим "долг", а переносим точку отсчёта на сейчас.
    if (!enabled) {
      const now = Date.now()
      lastMsRef.current = now
      prevEnabledRef.current = false
      try {
        localStorage.setItem(key, JSON.stringify({ lastTickMs: now }))
      } catch {
        // ignore
      }
      setTick((t) => t + 1)
      return
    }
    // При возврате с паузы/away стартуем новый цикл "сейчас",
    // чтобы не докидывать сердца за время отсутствия.
    if (prevEnabledRef.current === false) {
      const now = Date.now()
      lastMsRef.current = now
      try {
        localStorage.setItem(key, JSON.stringify({ lastTickMs: now }))
      } catch {
        // ignore
      }
    }
    prevEnabledRef.current = true

    const id = window.setInterval(() => {
      const now = Date.now()
      // Без catch-up: максимум одно начисление за тик, даже если вкладка была заморожена.
      if (now - lastMsRef.current >= INTERVAL_MS) {
        lastMsRef.current = now
        try {
          localStorage.setItem(key, JSON.stringify({ lastTickMs: now }))
        } catch {
          // ignore
        }
        dispatch({ type: "PAY_VOICES", amount: -AMOUNT_PER_TICK })
        onGrantRef.current()
      }
      setTick((t) => t + 1)
    }, 1000)

    return () => window.clearInterval(id)
  }, [userId, dispatch, enabled])

  const msUntilNext = useMemo(() => {
    if (userId == null || !enabled) return 0
    return Math.max(0, lastMsRef.current + INTERVAL_MS - Date.now())
  }, [userId, tick, enabled])

  return { msUntilNext }
}

export function formatBankPassiveCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}
