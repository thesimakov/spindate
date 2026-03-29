"use client"

import React from "react"
import { RotateCw, Target } from "lucide-react"
import { Bottle } from "@/components/bottle"
import type { BottleSkin } from "@/lib/game-types"

interface BottleCenterProps {
  bottleAngle: number
  isSpinning: boolean
  bottleSkin: BottleSkin
  isDrunk: boolean
  playerCount: number
  isMobile: boolean
  isMyTurn: boolean
  showResult: boolean
  countdown: number | null
  predictionPhase: boolean
  predictionTimer: number
  predictionMade: boolean
  predictionTarget: { id: number } | null
  predictionTarget2: { id: number } | null
  casualMode: boolean
  onSpin: () => void
}

function BottleCenterInner({
  bottleAngle,
  isSpinning,
  bottleSkin,
  isDrunk,
  playerCount,
  isMobile,
  isMyTurn,
  showResult,
  countdown,
  predictionPhase,
  predictionTimer,
  predictionMade,
  predictionTarget,
  predictionTarget2,
  casualMode,
  onSpin,
}: BottleCenterProps) {
  return (
    <>
      {/* Bottle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <div
          style={isMobile ? { transform: "scale(1.4)" } : undefined}
          className="drop-shadow-[0_0_22px_rgba(56,189,248,0.4)]"
        >
          <Bottle
            angle={bottleAngle}
            isSpinning={isSpinning}
            skin={bottleSkin ?? "classic"}
            isDrunk={isDrunk}
            fortuneSegmentCount={playerCount > 0 ? playerCount : 8}
          />
        </div>
      </div>

      {/* Spin button */}
      {isMyTurn && !isSpinning && !showResult && countdown === null && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none">
          <button
            onClick={onSpin}
            className="pointer-events-auto flex items-center justify-center gap-2 rounded-full font-bold transition-all hover:brightness-110 hover:scale-105 active:scale-95 whitespace-nowrap shadow-lg spin-btn-pulse"
            style={{
              minWidth: 78,
              minHeight: 78,
              padding: "14px 26px",
              fontSize: "18px",
              background: "linear-gradient(180deg, #22c55e 0%, #16a34a 42%, #15803d 100%)",
              backgroundColor: "#16a34a",
              color: "#fff",
              border: "3px solid #14532d",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 0 #14532d, 0 12px 28px rgba(0,0,0,0.55)",
              opacity: 1,
            }}
          >
            <RotateCw className="h-6 w-6 shrink-0" strokeWidth={2.5} />
            {"Крутить"}
          </button>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full shadow-xl animate-in zoom-in duration-300"
            style={{
              background: "radial-gradient(circle, #e8c06a 0%, #c4943a 100%)",
              boxShadow: "0 0 30px rgba(232, 192, 106, 0.5)",
            }}
          >
            <span className="text-4xl font-black" style={{ color: "#0f172a" }}>{countdown}</span>
          </div>
        </div>
      )}

      {/* Prediction timer overlay */}
      {!casualMode && predictionPhase && !isSpinning && !showResult && countdown === null && (
        <div className="absolute left-1/2 top-[15%] -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 animate-in fade-in duration-300">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-1.5 shadow-lg"
            style={{
              background: predictionTimer <= 3 ? "rgba(231, 76, 60, 0.9)" : "rgba(15, 23, 42, 0.85)",
              border: `1px solid ${predictionTimer <= 3 ? "#e74c3c" : "#2ecc71"}`,
              boxShadow: predictionTimer <= 3
                ? "0 0 16px rgba(231, 76, 60, 0.5)"
                : "0 0 12px rgba(46, 204, 113, 0.3)",
              transition: "all 0.3s ease",
            }}
          >
            <Target className="h-4 w-4" style={{ color: predictionTimer <= 3 ? "#fff" : "#2ecc71" }} />
            <span
              className="text-sm font-bold"
              style={{ color: predictionTimer <= 3 ? "#fff" : "#2ecc71" }}
            >
              {"Угадай пару: "}{predictionTimer}{"с"}
            </span>
          </div>
          {!predictionMade && !predictionTarget && (
            <span
              className="text-[10px] font-medium"
              style={{ color: "#94a3b8", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
            >
              {"Нажми на игрока"}
            </span>
          )}
          {!predictionMade && predictionTarget && !predictionTarget2 && (
            <span
              className="text-[10px] font-medium animate-pulse"
              style={{ color: "#2ecc71", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
            >
              {"Выбери второго игрока"}
            </span>
          )}
        </div>
      )}
    </>
  )
}

export const BottleCenter = React.memo(BottleCenterInner)
