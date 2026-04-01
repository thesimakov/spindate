"use client"

import { Lightbulb } from "lucide-react"

/**
 * Визуал «хозяина» стола: лампочка «идея» сверху справа; при hover — бейдж «Создатель стола».
 */
export function CreatorTableHostAura({ steamOuterPx }: { steamOuterPx: number }) {
  const bulbPx = Math.min(20, Math.max(14, Math.round(steamOuterPx * 0.24)))
  return (
    <>
      <div
        className="pointer-events-none absolute right-0 top-0 z-[6]"
        style={{
          transform: `translate(${Math.round(steamOuterPx * 0.06)}px, -${Math.round(steamOuterPx * 0.06)}px)`,
        }}
        aria-hidden
      >
        <div className="creator-host-idea-bulb flex items-center justify-center rounded-full border border-amber-400/45 bg-slate-950/80 p-0.5 shadow-[0_0_10px_rgba(250,204,21,0.3)]">
          <Lightbulb
            className="creator-host-idea-bulb-icon shrink-0 text-amber-200"
            strokeWidth={2.35}
            style={{ width: bulbPx, height: bulbPx }}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute left-1/2 z-[25] flex -translate-x-1/2 flex-col items-center opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={{ bottom: "calc(100% + 4px)" }}
        aria-hidden
      >
        <span className="whitespace-nowrap rounded-full border border-amber-300/45 bg-slate-950/94 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-amber-50 shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:text-[10px]">
          Создатель стола
        </span>
      </div>
    </>
  )
}
