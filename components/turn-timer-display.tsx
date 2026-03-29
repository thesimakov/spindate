"use client"

import React from "react"

interface TurnTimerDisplayProps {
  turnTimer: number | null
  isMobile: boolean
}

function TurnTimerDisplayInner({ turnTimer, isMobile }: TurnTimerDisplayProps) {
  if (turnTimer === null) return null

  if (isMobile) {
    return (
      <div
        className="flex items-center gap-1 rounded-full px-2.5 py-0.5"
        style={{
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(248,250,252,0.3)",
          boxShadow: "0 0 8px rgba(148,163,184,0.4)",
        }}
      >
        <span className="text-[10px]" style={{ color: "#e5e7eb" }}>{"Ход"}</span>
        <span className="text-xs font-bold" style={{ color: turnTimer <= 5 ? "#f97373" : "#facc15" }}>
          {turnTimer}
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1"
      style={{
        background: "rgba(15,23,42,0.9)",
        border: "1px solid rgba(248, 250, 252, 0.3)",
        boxShadow: "0 0 12px rgba(148, 163, 184, 0.6)",
      }}
    >
      <span className="text-[11px]" style={{ color: "#e5e7eb" }}>{"Ваш ход"}</span>
      <span className="text-sm font-bold" style={{ color: turnTimer <= 5 ? "#f97373" : "#facc15" }}>
        {turnTimer}
      </span>
      <span className="text-[11px]" style={{ color: "#9ca3af" }}>{"сек"}</span>
    </div>
  )
}

export const TurnTimerDisplay = React.memo(TurnTimerDisplayInner)
