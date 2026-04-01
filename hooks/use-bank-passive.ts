"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch } from "react"
import type { GameAction } from "@/lib/game-types"

const INTERVAL_MS = 60_000
const AMOUNT_PER_TICK = 3
const STORAGE_KEY_PREFIX = "spindate_bank_passive_v1_"

type UseBankPassiveOptions = {
  /** false — пауза / ожидание / вне игры: тики не начисляются, без догона после возврата */
  enabled?: boolean
}

export function useBankPassive(
  userId: number | undefined,
  dispatch: Dispatch<GameAction>,
  onGrantBurst: () => void,
  options?: UseBankPassiveOptions,
) {
  const enabled = options?.enabled !== false
  const lastSnapRef = useRef<{ uid?: number; en?: boolean }>({})
  const lastMsRef = useRef(0)
  const [tick, setTick] = useState(0)
  const onGrantRef = useRef(onGrantBurst)
  onGrantRef.current = onGrantBurst

  useLayoutEffect(() => {
    if (userId == null) {
      lastMsRef.current = 0
      lastSnapRef.current = {}
      return
    }

    const key = `${STORAGE_KEY_PREFIX}${userId}`
    const now = Date.now()
    const prev = lastSnapRef.current
    const userChanged = prev.uid !== userId
    const resumedAfterDisable = prev.en === false && enabled === true && !userChanged

    if (!enabled) {
      lastMsRef.current = now
      try {
        localStorage.setItem(key, JSON.stringify({ lastTickMs: now }))
      } catch {
        /* ignore */
      }
      lastSnapRef.current = { uid: userId, en: false }
      setTick((t) => t + 1)
      return
    }

    if (resumedAfterDisable) {
      lastMsRef.current = now
      try {
        localStorage.setItem(key, JSON.stringify({ lastTickMs: now }))
      } catch {
        /* ignore */
      }
      lastSnapRef.current = { uid: userId, en: true }
      setTick((t) => t + 1)
      return
    }

    if (userChanged) {
      let last = now
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const j = JSON.parse(raw) as { lastTickMs?: number }
          if (typeof j.lastTickMs === "number" && j.lastTickMs > 0) last = j.lastTickMs
        } else {
          localStorage.setItem(key, JSON.stringify({ lastTickMs: last }))
        }
      } catch {
        last = now
      }
      lastMsRef.current = last
      lastSnapRef.current = { uid: userId, en: true }
      setTick((t) => t + 1)
    }
  }, [userId, enabled])

  useEffect(() => {
    if (userId == null || !enabled) return

    const key = `${STORAGE_KEY_PREFIX}${userId}`
    const id = window.setInterval(() => {
      const now = Date.now()
      let last = lastMsRef.current
      let n = 0
      while (now - last >= INTERVAL_MS) {
        last += INTERVAL_MS
        n++
      }
      if (n > 0) {
        lastMsRef.current = last
        try {
          localStorage.setItem(key, JSON.stringify({ lastTickMs: last }))
        } catch {
          // ignore
        }
        dispatch({ type: "PAY_VOICES", amount: -AMOUNT_PER_TICK * n })
        for (let i = 0; i < n; i++) {
          window.setTimeout(() => onGrantRef.current(), i * 400)
        }
      }
      setTick((t) => t + 1)
    }, 1000)

    return () => window.clearInterval(id)
  }, [userId, dispatch, enabled])

  useEffect(() => {
    return () => {
      if (userId == null) return
      const key = `${STORAGE_KEY_PREFIX}${userId}`
      try {
        localStorage.setItem(key, JSON.stringify({ lastTickMs: Date.now() }))
      } catch {
        /* ignore */
      }
    }
  }, [userId])

  const msUntilNext = useMemo(() => {
    if (userId == null || !enabled) return 0
    return Math.max(0, lastMsRef.current + INTERVAL_MS - Date.now())
  }, [userId, enabled, tick])

  return { msUntilNext, passiveRefillActive: enabled && userId != null }
}

export function formatBankPassiveCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}
