"use client"

import type { CSSProperties } from "react"
import { Heart } from "lucide-react"

const SALUTE_TRAJECTORIES = [
  { dx: -86, dy: -18, delay: 0, dur: 860, scale: 0.9, rot: -24 },
  { dx: -72, dy: -44, delay: 60, dur: 980, scale: 1, rot: -10 },
  { dx: -52, dy: -66, delay: 120, dur: 1020, scale: 1.05, rot: 8 },
  { dx: 52, dy: -66, delay: 120, dur: 1020, scale: 1.05, rot: -8 },
  { dx: 72, dy: -44, delay: 60, dur: 980, scale: 1, rot: 10 },
  { dx: 86, dy: -18, delay: 0, dur: 860, scale: 0.9, rot: 24 },
] as const

/** Салют из сердечек: разлёт в стороны от кнопки банка */
export function BankPassiveBurstOverlay({
  burstKey,
  origin,
}: {
  burstKey: number
  origin?: { x: number; y: number }
}) {
  if (burstKey <= 0) return null

  const containerClassName = origin
    ? "pointer-events-none fixed z-[95] flex gap-3 -translate-x-1/2 -translate-y-1/2"
    : "pointer-events-none fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-[95] flex -translate-x-1/2 gap-3 sm:bottom-32"

  return (
    <div
      className={containerClassName}
      style={origin ? { left: origin.x, top: origin.y } : undefined}
      aria-hidden
    >
      {SALUTE_TRAJECTORIES.map((p, i) => (
        <div
          key={`${burstKey}-${i}`}
          className="bank-passive-burst-item"
          style={
            {
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.dur}ms`,
              ["--dx" as string]: `${p.dx}px`,
              ["--dy" as string]: `${p.dy}px`,
              ["--rot" as string]: `${p.rot}deg`,
              ["--scale" as string]: p.scale,
            } as CSSProperties
          }
        >
          <Heart className="h-4 w-4 text-rose-400 sm:h-5 sm:w-5" strokeWidth={2} fill="currentColor" aria-hidden />
        </div>
      ))}
    </div>
  )
}
