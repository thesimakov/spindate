"use client"

import type { PairKissPhase, Player } from "@/lib/game-types"
import { cn } from "@/lib/utils"

const LIME = "#84cc16"
const LIME_STROKE = "#ffffff"

function CurvedArrowDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 8 C 40 44, 80 44, 112 8"
        stroke={LIME_STROKE}
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 8 C 40 44, 80 44, 112 8"
        stroke={LIME}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M104 12 L112 8 L108 20" fill={LIME} stroke={LIME_STROKE} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function CurvedArrowUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 40 C 40 4, 80 4, 112 40"
        stroke={LIME_STROKE}
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 40 C 40 4, 80 4, 112 40"
        stroke={LIME}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M104 36 L112 40 L108 28" fill={LIME} stroke={LIME_STROKE} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export interface PairKissHeartModalProps {
  phase: PairKissPhase
  playerA: Player
  playerB: Player
  currentUserId: number | undefined
  nowMs: number
  onPick: (playerId: number, yes: boolean) => void
}

export function PairKissHeartModal({
  phase,
  playerA,
  playerB,
  currentUserId,
  nowMs,
  onPick,
}: PairKissHeartModalProps) {
  const { choiceA, choiceB, resolved, outcome } = phase
  const rem = Math.max(0, Math.ceil((phase.deadlineMs - nowMs) / 1000))
  const progress = Math.min(1, Math.max(0, (phase.deadlineMs - nowMs) / 10_000))

  const showMerged =
    resolved && (outcome === "both_yes" || outcome === "only_a" || outcome === "only_b")
  const pulseLeft = resolved && (outcome === "both_yes" || outcome === "only_a")
  const pulseRight = resolved && (outcome === "both_yes" || outcome === "only_b")
  const greyLeft = resolved && !pulseLeft
  const greyRight = resolved && !pulseRight

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-3 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal
      aria-labelledby="pair-kiss-title"
    >
      <div
        className="relative w-full max-w-[min(92vw,380px)] rounded-3xl border border-white/20 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
        style={{
          background: "linear-gradient(165deg, rgba(30,41,59,0.97) 0%, rgba(15,23,42,0.99) 100%)",
        }}
      >
        <h2 id="pair-kiss-title" className="sr-only">
          {"Поцеловать?"}
        </h2>

        <div className="mb-2 flex flex-col items-center gap-1">
          <CurvedArrowDown className="h-10 w-28 opacity-95" />
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-lime-300/90">
            {playerA.name}
          </p>
        </div>

        <div className="relative mx-auto flex min-h-[120px] items-center justify-center gap-1">
          {/* Left half — игрок A */}
          <div
            className={cn(
              "relative flex h-28 w-[52px] items-center justify-center transition-all duration-500",
              pulseLeft && "pair-kiss-heart-pulse",
              greyLeft && "opacity-45 grayscale",
            )}
          >
            <svg viewBox="0 0 64 96" className="h-full w-full drop-shadow-lg" aria-hidden>
              <path
                d="M32 88 C 8 72 4 48 4 36 C 4 16 20 8 32 20 C 44 8 60 16 60 36 C 60 48 56 72 32 88Z"
                fill={pulseLeft && outcome === "both_yes" ? "#e11d48" : "#9f1239"}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
                className={cn(showMerged && outcome === "both_yes" && "fill-rose-600")}
              />
            </svg>
          </div>
          <div
            className={cn(
              "relative flex h-28 w-[52px] items-center justify-center transition-all duration-500",
              pulseRight && "pair-kiss-heart-pulse",
              greyRight && "opacity-45 grayscale",
            )}
          >
            <svg viewBox="0 0 64 96" className="h-full w-full drop-shadow-lg" aria-hidden>
              <path
                d="M32 88 C 56 72 60 48 60 36 C 60 16 44 8 32 20 C 20 8 4 16 4 36 C 4 48 8 72 32 88Z"
                fill={pulseRight && outcome === "both_yes" ? "#e11d48" : "#9f1239"}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {resolved && outcome === "both_yes" && (
          <p className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 text-2xl drop-shadow-md">
            {"💋"}
          </p>
        )}

        <div className="mt-2 flex flex-col items-center gap-1">
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-lime-300/90">
            {playerB.name}
          </p>
          <CurvedArrowUp className="h-10 w-28 opacity-95" />
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm tabular-nums text-slate-200">
            <span className="font-bold">{"Осталось"}</span>
            <span>{resolved ? "0" : rem}{" сек"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-[width] duration-200"
              style={{ width: `${resolved ? 0 : progress * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceBlock
            label={`${playerA.name} — поцеловать?`}
            playerId={playerA.id}
            myId={currentUserId}
            choice={choiceA}
            resolved={resolved}
            onPick={onPick}
            isA
          />
          <ChoiceBlock
            label={`${playerB.name} — поцеловать?`}
            playerId={playerB.id}
            myId={currentUserId}
            choice={choiceB}
            resolved={resolved}
            onPick={onPick}
          />
        </div>
      </div>
    </div>
  )
}

function ChoiceBlock({
  label,
  playerId,
  myId,
  choice,
  resolved,
  onPick,
  isA,
}: {
  label: string
  playerId: number
  myId: number | undefined
  choice: boolean | null
  resolved: boolean
  onPick: (playerId: number, yes: boolean) => void
  isA?: boolean
}) {
  const mine = myId === playerId
  const disabled = resolved || !mine || choice !== null

  return (
    <div
      className="rounded-2xl border border-slate-600/50 bg-slate-950/80 p-3"
      data-part={isA ? "a" : "b"}
    >
      <p className="mb-2 text-center text-xs font-bold text-slate-200">{label}</p>
      {mine ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(playerId, true)}
            className={cn(
              "min-h-[40px] flex-1 rounded-xl font-extrabold transition-all",
              choice === true
                ? "bg-emerald-600 text-white ring-2 ring-lime-300"
                : "bg-slate-800 text-slate-100 hover:bg-slate-700",
              disabled && "opacity-50",
            )}
          >
            {"Да"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(playerId, false)}
            className={cn(
              "min-h-[40px] flex-1 rounded-xl font-extrabold transition-all",
              choice === false
                ? "bg-rose-700 text-white ring-2 ring-rose-300"
                : "bg-slate-800 text-slate-100 hover:bg-slate-700",
              disabled && "opacity-50",
            )}
          >
            {"Нет"}
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400">
          {choice === null && !resolved ? "Ожидаем ответ…" : choice === true ? "Да" : choice === false ? "Нет" : "—"}
        </p>
      )}
    </div>
  )
}
