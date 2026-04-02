"use client"

import { useMemo } from "react"
import { useStatusLine } from "@/lib/use-status-line"
import { useGameLayoutMode } from "@/lib/use-media-query"

export function GameStatusTicker() {
  const { row } = useStatusLine()
  const { layoutMobile } = useGameLayoutMode()

  const text = useMemo(() => (row?.text ?? "").trim(), [row?.text])
  if (!text) return null

  const repeated = `${text}   •   ${text}   •   ${text}   •   `
  const tableWidthStyle = layoutMobile
    ? {
        width: "min(90vw, 420px)",
        maxWidth: "min(90vw, 420px)",
      }
    : {
        width: "min(90%, min(100%, calc(min(72vh, 78dvh) * 60 / 50)))",
        maxWidth: "100vw",
      }

  return (
    <div
      className="status-board pointer-events-none fixed bottom-0 left-1/2 z-40 -translate-x-1/2 border border-cyan-300/30 bg-slate-950/90 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur"
      style={tableWidthStyle}
    >
      <div className="status-board-glow" />
      <div className="flex items-center gap-3 px-2 py-1.5 sm:px-3">
        <span className="status-pill shrink-0 rounded border border-cyan-300/50 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
          Новости
        </span>
        <div className="relative w-full overflow-hidden">
          <div className="status-line-marquee status-line-text flex w-max whitespace-nowrap text-xs font-medium text-cyan-100 sm:text-sm">
            <span className="status-line-item pr-8">{repeated}</span>
            <span className="status-line-item pr-8" aria-hidden>
              {repeated}
            </span>
          </div>
        </div>
      </div>
      <style jsx>{`
        .status-board {
          overflow: hidden;
        }
        .status-board-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(34, 211, 238, 0.08) 0%, rgba(15, 23, 42, 0) 36%, rgba(34, 211, 238, 0.06) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.045) 0px,
              rgba(255, 255, 255, 0.045) 1px,
              rgba(0, 0, 0, 0) 1px,
              rgba(0, 0, 0, 0) 3px
            );
          animation: board-flicker 2.8s ease-in-out infinite;
        }
        .status-pill {
          text-shadow: 0 0 10px rgba(103, 232, 249, 0.65);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            0 0 14px rgba(34, 211, 238, 0.28);
        }
        .status-line-text {
          font-family: "JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
          letter-spacing: 0.04em;
          text-shadow:
            0 0 8px rgba(34, 211, 238, 0.45),
            0 0 18px rgba(34, 211, 238, 0.25);
          color: #cffafe;
        }
        .status-line-marquee {
          animation: status-line-marquee 18s linear infinite;
          will-change: transform;
        }
        @keyframes board-flicker {
          0%,
          100% {
            opacity: 0.92;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes status-line-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}

