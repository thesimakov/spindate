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
  hasPlayers: boolean
  hasCurrentUser: boolean
  isPcLayout: boolean
  onDone: () => void
}

function TableLoaderOverlayInner({
  visible,
  liveReady,
  authorityReady,
  hasPlayers,
  hasCurrentUser,
  isPcLayout,
  onDone,
}: TableLoaderOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)
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
    scheduleStepTimers()
    return clearStepTimers
  }, [visible, scheduleStepTimers, clearStepTimers])

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

  useEffect(() => {
    if (!visible || fadingOut) return
    const allReady = hasPlayers && hasCurrentUser && liveReady && authorityReady
    if (!allReady) return

    const elapsed = Date.now() - startedAtRef.current
    const remaining = TABLE_LOADER_MIN_VISIBLE_MS - elapsed

    const startFade = () => {
      setProgress(100)
      setFadingOut(true)
    }

    if (remaining > 0) {
      const t = setTimeout(startFade, remaining)
      return () => clearTimeout(t)
    }
    startFade()
  }, [visible, fadingOut, hasPlayers, hasCurrentUser, liveReady, authorityReady])

  if (!visible && !fadingOut) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] isolate flex flex-col overflow-y-auto bg-slate-950 px-4 py-8 backdrop-blur-sm",
        fadingOut && "loader-fade-out",
      )}
      onAnimationEnd={() => {
        if (fadingOut) {
          setFadingOut(false)
          setProgress(0)
          onDone()
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
            "table-loader-quote-card player-menu-quote relative w-full overflow-hidden rounded-3xl border text-left shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]",
            isPcLayout ? "max-w-2xl" : "max-w-md",
          )}
          style={{
            background:
              "linear-gradient(155deg, rgba(30,41,59,0.72) 0%, rgba(15,23,42,0.88) 45%, rgba(15,23,42,0.92) 100%)",
            borderColor: "rgba(251, 191, 36, 0.28)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-8 -left-10 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
            aria-hidden
          />
          <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.15)] sm:text-[11px]">
                Цитата дня
              </span>
              <span className="hidden h-px w-12 bg-gradient-to-r from-amber-400/50 to-transparent sm:block" aria-hidden />
            </div>
            <blockquote className="relative m-0">
              <span
                className="pointer-events-none absolute -left-0.5 -top-6 font-serif text-[4.5rem] leading-none text-amber-400/[0.18] sm:text-[5.5rem] sm:text-amber-400/20"
                aria-hidden
              >
                &ldquo;
              </span>
              <p className="relative z-[1] text-[1.05rem] font-medium leading-[1.65] text-slate-50 sm:text-xl sm:leading-[1.7]">
                <span className="bg-gradient-to-br from-white via-slate-100 to-slate-300/90 bg-clip-text italic text-transparent">
                  {quote.text}
                </span>
              </p>
            </blockquote>
            <footer className="mt-5 flex items-center gap-2 border-t border-white/[0.08] pt-4">
              <span className="h-px w-8 shrink-0 bg-gradient-to-r from-amber-400/60 to-transparent" aria-hidden />
              <p className="text-[0.9375rem] font-medium tracking-wide text-slate-400/95 sm:text-base">
                <span className="text-amber-200/95">—</span>{" "}
                <span className="text-slate-300">{quote.author}</span>
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
        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-slate-600/50 sm:h-3">
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)] transition-[width] duration-300 ease-out"
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
        <p className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] font-semibold tabular-nums text-slate-400 sm:text-xs">
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-400"
            aria-hidden
          />
          Подбираем стол… {progress}%
        </p>
      </div>
    </div>
  )
}

export const TableLoaderOverlay = React.memo(TableLoaderOverlayInner)
