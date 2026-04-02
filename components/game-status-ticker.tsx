"use client"

import { useMemo } from "react"
import { useStatusLine } from "@/lib/use-status-line"

export function GameStatusTicker() {
  const { row } = useStatusLine()

  const text = useMemo(() => (row?.text ?? "").trim(), [row?.text])
  if (!text) return null

  const repeated = `${text}   •   ${text}   •   ${text}   •   ${text}`

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-cyan-300/30 bg-slate-950/90 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-center gap-3 px-2 py-1.5 sm:px-3">
        <span className="shrink-0 rounded border border-cyan-300/50 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
          INFO
        </span>
        <div className="relative w-full overflow-hidden">
          <div className="status-line-marquee min-w-max whitespace-nowrap text-xs font-medium text-cyan-100 sm:text-sm">
            {repeated}
          </div>
        </div>
      </div>
      <style jsx>{`
        .status-line-marquee {
          animation: status-line-marquee 22s linear infinite;
          will-change: transform;
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

