"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { cn } from "@/lib/utils"
import { getDailyLoveQuote } from "@/lib/love-quotes"

const TABLE_LOADER_MIN_VISIBLE_MS = 1200
const TABLE_LOADER_PROGRESS_STEPS: readonly { pct: number; at: number }[] = [
  { pct: 10, at: 200 },
  { pct: 25, at: 500 },
  { pct: 50, at: 1000 },
  { pct: 70, at: 1550 },
  { pct: 100, at: 2100 },
]
const TABLE_LOADER_FAKE_MAX_BEFORE_READY = 94
const TABLE_LOADER_STUCK_TIMEOUT_MS = 14_000

const PARTICLE_SEEDS = Array.from({ length: 24 }, (_, i) => ({
  w: 4 + ((i * 7 + 3) % 6),
  h: 4 + ((i * 5 + 1) % 6),
  left: ((i * 37 + 13) % 100),
  top: ((i * 41 + 7) % 100),
  hue: 35 + ((i * 11) % 25),
  light: 60 + ((i * 13) % 20),
  delay: (i * 17 % 400) / 1000,
  dur: 0.6 + ((i * 19 % 500) / 1000),
}))

interface TableLoaderOverlayProps {
  visible: boolean
  liveReady: boolean
  authorityReady: boolean
  /** Подтверждение из /api/table/live: вы в списке живых за столом. */
  seatConfirmed: boolean
  /** Живых игроков на столе (до 10 в комнате). */
  liveHumanCount: number
  hasPlayers: boolean
  hasCurrentUser: boolean
  isPcLayout: boolean
  onDone: () => void
}

function TableLoaderOverlayInner({
  visible,
  liveReady,
  authorityReady,
  seatConfirmed,
  liveHumanCount,
  hasPlayers,
  hasCurrentUser,
  isPcLayout,
  onDone,
}: TableLoaderOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)
  const [stuckTimedOut, setStuckTimedOut] = useState(false)
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const startedAtRef = useRef(Date.now())
  const quote = useMemo(() => getDailyLoveQuote(new Date()), [])

  const clearStepTimers = useCallback(() => {
    stepTimersRef.current.forEach(clearTimeout)
    stepTimersRef.current = []
  }, [])

  const scheduleStepTimers = useCallback(() => {
    clearStepTimers()
    for (const { pct, at } of TABLE_LOADER_PROGRESS_STEPS) {
      if (pct >= 100) continue
      stepTimersRef.current.push(setTimeout(() => setProgress(pct), at))
    }
  }, [clearStepTimers])

  useEffect(() => {
    if (!visible) return
    startedAtRef.current = Date.now()
    setProgress(0)
    setFadingOut(false)
    setStuckTimedOut(false)
    scheduleStepTimers()
    return clearStepTimers
  }, [visible, scheduleStepTimers, clearStepTimers])

  useEffect(() => {
    if (!visible || fadingOut) return
    const id = window.setTimeout(() => {
      setStuckTimedOut(true)
      setProgress((p) => Math.max(p, 96))
    }, TABLE_LOADER_STUCK_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [visible, fadingOut])

  useEffect(() => {
    if (!visible || fadingOut) return
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p < 70 || p >= 100) return p
        if (p >= TABLE_LOADER_FAKE_MAX_BEFORE_READY) return p
        return p + 1
      })
    }, 420)
    return () => clearInterval(id)
  }, [visible, fadingOut])

  const doneFiredRef = useRef(false)

  useEffect(() => {
    if (!visible) {
      doneFiredRef.current = false
      return
    }
    if (fadingOut) return
    const allReady =
      hasPlayers &&
      hasCurrentUser &&
      liveReady &&
      authorityReady &&
      seatConfirmed
    const failSafeReady =
      stuckTimedOut &&
      hasPlayers &&
      hasCurrentUser &&
      (liveReady || authorityReady || liveHumanCount > 0)
    if (!allReady && !failSafeReady) return

    const elapsed = Date.now() - startedAtRef.current
    const remaining = TABLE_LOADER_MIN_VISIBLE_MS - elapsed

    const startFade = () => {
      if (!doneFiredRef.current) {
        doneFiredRef.current = true
        onDone()
      }
      setProgress(100)
      setFadingOut(true)
    }

    if (remaining > 0) {
      const t = setTimeout(startFade, remaining)
      return () => clearTimeout(t)
    }
    startFade()
  }, [visible, fadingOut, hasPlayers, hasCurrentUser, liveReady, authorityReady, seatConfirmed, liveHumanCount, onDone, stuckTimedOut])

  if (!visible && !fadingOut) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] isolate flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-950 px-4 py-8 backdrop-blur-sm [scrollbar-gutter:stable]",
        fadingOut && "loader-fade-out",
      )}
      onAnimationEnd={() => {
        if (fadingOut) {
          setFadingOut(false)
          setProgress(0)
        }
      }}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-busy={!fadingOut}
      aria-label="Загрузка стола"
    >
      {fadingOut && (
        <div className="pointer-events-none absolute inset-0 z-[10]" aria-hidden>
          {PARTICLE_SEEDS.map((s, i) => (
            <span
              key={i}
              className="loader-particle absolute rounded-full"
              style={{
                width: `${s.w}px`,
                height: `${s.h}px`,
                left: `${s.left}%`,
                top: `${s.top}%`,
                background: `hsl(${s.hue}, 90%, ${s.light}%)`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1">
        <div
          className={cn(
            "table-loader-quote-card player-menu-quote relative w-full overflow-hidden rounded-[1.75rem] border text-left shadow-[0_28px_64px_-16px_rgba(0,0,0,0.6),0_0_0_1px_rgba(251,191,36,0.18),inset_0_1px_0_rgba(255,255,255,0.09)]",
            isPcLayout ? "max-w-3xl" : "max-w-lg",
          )}
          style={{
            background:
              "linear-gradient(160deg, rgba(30,41,59,0.78) 0%, rgba(15,23,42,0.92) 48%, rgba(12,18,32,0.96) 100%)",
            borderColor: "rgba(251, 191, 36, 0.35)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-amber-400/12 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-10 -left-12 h-40 w-40 rounded-full bg-violet-500/8 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-4 right-2 font-serif text-[6.5rem] leading-none text-amber-500/[0.06] sm:right-6 sm:text-[8rem]"
            aria-hidden
          >
            &ldquo;
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
            aria-hidden
          />
          <div className="relative z-10 mx-auto max-w-prose px-6 py-8 sm:px-10 sm:py-10 md:py-11">
            <header className="mb-7 sm:mb-9">
              <span className="inline-flex items-center rounded-full border border-amber-400/45 bg-gradient-to-r from-amber-500/25 to-amber-950/30 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-50/95 shadow-[0_0_24px_rgba(251,191,36,0.12)] sm:px-4 sm:text-xs">
                Цитата дня
              </span>
            </header>
            <div className="relative flex gap-4 sm:gap-5">
              <div
                className="mt-1 w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-amber-300 via-amber-500/75 to-amber-700/35 shadow-[0_0_14px_rgba(251,191,36,0.28)]"
                aria-hidden
              />
              <blockquote className="m-0 min-w-0 flex-1">
                <p className="text-[1.125rem] font-medium leading-[1.75] text-slate-50 sm:text-xl sm:leading-[1.72] md:text-2xl md:leading-[1.65] [text-wrap:balance]">
                  <span className="italic text-slate-100">{quote.text}</span>
                </p>
              </blockquote>
            </div>
            <footer className="mt-9 border-t border-white/12 pt-7 sm:mt-10 sm:pt-8">
              <p className="text-[0.9375rem] leading-snug text-slate-400 sm:text-lg">
                <span className="font-medium text-amber-200/90">—</span>{" "}
                <span className="font-medium text-slate-200">{quote.author}</span>
              </p>
            </footer>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-4 w-full max-w-md shrink-0 pb-2 sm:mt-6 sm:pb-4">
        <div className="mb-1.5 flex justify-between px-0.5 font-mono text-[9px] font-semibold tabular-nums text-slate-500 sm:text-[10px]">
          {[10, 25, 50, 70, 100].map((n) => (
            <span
              key={n}
              className={progress >= n ? "text-amber-400/90" : "text-slate-600"}
            >
              {n}%
            </span>
          ))}
        </div>
        <div className="relative h-2.5 shrink-0 overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-slate-600/50 sm:h-3">
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)] transition-[width] duration-200 ease-linear will-change-[width]"
            style={{ width: `${progress}%` }}
          >
            {progress >= 70 && progress < 100 && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-[min(40%,8rem)] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-90 app-loader-shimmer"
                aria-hidden
              />
            )}
          </div>
        </div>
        <div className="mt-2 min-h-[4.75rem] text-center text-[11px] font-semibold leading-snug text-slate-400 sm:min-h-[5rem] sm:text-xs">
          <span className="flex items-center justify-center gap-2 tabular-nums">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-400"
              aria-hidden
            />
            {!seatConfirmed
              ? "Ищем стол и место среди живых игроков…"
              : !authorityReady
                ? "Синхронизируем раунд и стол…"
                : "Почти готово…"}{" "}
            {progress}%
          </span>
          {stuckTimedOut && (
            <span className="mt-1.5 block text-[10px] font-medium leading-snug text-amber-200/85 sm:mt-2 sm:text-[11px]">
              Подключение заняло больше обычного. Продолжаем вход, чтобы стол не зависал на загрузке.
            </span>
          )}
          {/* Фиксированная высота второй строки — без скачка при появлении «Живых…» */}
          <span
            className={cn(
              "mt-1.5 block text-[10px] font-medium leading-snug text-slate-500 sm:mt-2 sm:text-[11px]",
              (!seatConfirmed || liveHumanCount <= 0) && "invisible",
            )}
            aria-hidden={!seatConfirmed || liveHumanCount <= 0}
          >
            Живых за столом: {liveHumanCount} / 10 — боты подставляются, пока не наберётся компания
          </span>
        </div>
      </div>
    </div>
  )
}

export const TableLoaderOverlay = React.memo(TableLoaderOverlayInner)
