"use client"

import { X } from "lucide-react"
import { FORTUNE_WHEEL_SEGMENTS } from "@/lib/fortune-wheel"

type FortuneWheelSidePanelProps = {
  open: boolean
  wheelSpinning: boolean
  wheelRotationDeg: number
  wheelTickets: number
  wheelLastRewardText: string | null
  freeChanceReady: boolean
  freeChanceCountdown: string
  onClose: () => void
  onSpin: () => void
  onSpinFree: () => void
  onBuyTickets: (count: number, cost: number) => void
}

export function FortuneWheelSidePanel({
  open,
  wheelSpinning,
  wheelRotationDeg,
  wheelTickets,
  wheelLastRewardText,
  freeChanceReady,
  freeChanceCountdown,
  onClose,
  onSpin,
  onSpinFree,
  onBuyTickets,
}: FortuneWheelSidePanelProps) {
  if (!open) return null
  const segmentAngle = 360 / FORTUNE_WHEEL_SEGMENTS.length
  /** Поворот для размещения вдоль биссектрисы: в CSS `translateY(-r)` идёт вверх; нужный угол = мат.θ + 90° = (i+½)·segmentAngle */
  const segCssRotate = (i: number) => (i + 0.5) * segmentAngle
  /** Высота треугольника-указателя (borderTop) — для расчёта 70% внутри круга */
  const POINTER_H_PX = 22
  /** Верх внутренней окружности колеса = p-2 (0.5rem); 30% высоты указателя — снаружи */
  const pointerTop = `calc(0.5rem - ${0.3 * POINTER_H_PX}px)`

  /** Внешняя граница — дуга окружности, не хорда треугольника */
  const sectorPieBackground = `conic-gradient(from -90deg at 50% 50%, ${FORTUNE_WHEEL_SEGMENTS.map((_, i) => {
    const c = i % 2 === 0 ? "#93c5fd" : "#ffffff"
    const a0 = i * segmentAngle
    const a1 = (i + 1) * segmentAngle
    return `${c} ${a0}deg ${a1}deg`
  }).join(", ")})`

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        className="side-panel-slide-in-left fixed inset-y-0 left-0 z-[60] flex h-app max-h-app w-full max-w-none flex-col border-r border-cyan-500/20 bg-[rgba(2,6,23,0.98)] shadow-[24px_0_60px_rgba(0,0,0,0.55)]"
        style={{ width: "50vw" }}
        role="dialog"
        aria-modal="true"
        aria-label="Колесо фортуны"
      >
        <div className="relative flex shrink-0 items-center justify-between border-b border-cyan-500/15 px-4 py-3 pl-10">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>🎡</span>
            <span className="font-bold text-slate-100">Колесо фортуны</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="side-panel-close-outside-left rounded-full p-1.5 text-slate-300 transition hover:bg-slate-600/50 hover:text-white hover:brightness-110"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-lg space-y-3">
            <div className="rounded-xl border border-slate-600/60 bg-slate-900/65 p-3">
              <div className="relative isolate mx-auto w-full max-w-[22rem] [--fw-r:min(34vw,8.8rem)]">
                <div
                  className={"fortune-wheel-rays absolute inset-0 z-0 rounded-full " + (wheelSpinning ? "is-spinning" : "")}
                  aria-hidden
                />
                <div
                  className="relative z-[1] aspect-square w-full rounded-full p-2"
                  style={{
                    background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.96) 0%, rgba(226,232,240,0.98) 40%, rgba(148,163,184,0.98) 100%)",
                    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.88), 0 0 0 1px rgba(255,255,255,0.35)",
                  }}
                >
                  <div className="fortune-wheel-rim absolute inset-0 rounded-full" aria-hidden />
                  <div
                    className="fortune-wheel-face relative z-10 h-full w-full rounded-full border-[3px] border-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.5)]"
                    style={{
                      transform: `rotate(${wheelRotationDeg}deg)`,
                      transition: wheelSpinning ? "transform 4.8s cubic-bezier(0.15, 0.9, 0.12, 1)" : undefined,
                    }}
                  >
                    <div className={"fortune-wheel-sweep pointer-events-none absolute inset-0 rounded-full " + (wheelSpinning ? "is-spinning" : "")} aria-hidden />
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden"
                      style={{
                        background: sectorPieBackground,
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55)",
                      }}
                    />
                    <div className="relative h-full w-full">
                      {FORTUNE_WHEEL_SEGMENTS.map((s, i) => {
                        const a = segCssRotate(i)
                        return (
                          <div
                            key={`${s.kind}-${s.amount}-${i}`}
                            className="absolute left-1/2 top-1/2 z-[2]"
                            style={{ transform: `translate(-50%,-50%) rotate(${a}deg)` }}
                          >
                            {/*
                              Колонка вдоль биссектрисы: сверху — плашка xN, ниже — иконка, у центра — лампочка.
                            */}
                            <div
                              className="flex w-[2.75rem] flex-col items-center justify-between gap-0.5 text-center sm:w-[3rem]"
                              style={{
                                height: "calc(var(--fw-r) * 0.44)",
                                transform: "translateY(calc(-1 * var(--fw-r) * 0.64))",
                              }}
                            >
                              <div
                                className="fortune-wheel-prize-pop flex shrink-0 flex-col items-center justify-center"
                                style={{ animationDelay: `${i * 0.12}s`, transform: `rotate(${-a}deg)` }}
                              >
                                <span className="rounded-full border-2 border-white bg-white/95 px-1.5 py-0.5 text-[10px] font-black leading-tight text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.18)] ring-1 ring-slate-900/10 sm:px-2 sm:text-[11px]">
                                  {s.label}
                                </span>
                              </div>
                              <div
                                className="fortune-wheel-prize-pop flex shrink-0 flex-col items-center justify-center"
                                style={{ animationDelay: `${i * 0.12}s`, transform: `rotate(${-a}deg)` }}
                              >
                                <span
                                  className="text-[1.8rem] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] sm:text-[1.95rem]"
                                  aria-hidden
                                >
                                  {s.icon}
                                </span>
                              </div>
                              <div
                                className="flex shrink-0 items-center justify-center pt-0.5"
                                style={{ transform: `rotate(${-a}deg)` }}
                              >
                                <span
                                  className={"fortune-wheel-bulb block h-2.5 w-2.5 rounded-full " + (wheelSpinning ? "is-spinning" : "")}
                                  style={{ animationDelay: `${i * 120}ms` }}
                                  aria-hidden
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div className="absolute left-1/2 top-1/2 z-[20] flex h-[3.25rem] w-[3.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-rose-300 bg-white text-[1.65rem] shadow-[0_6px_18px_rgba(0,0,0,0.35)] sm:h-14 sm:w-14 sm:text-2xl">
                        💋
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={"fortune-wheel-pointer pointer-events-none absolute left-1/2 z-[45] -translate-x-1/2 " + (wheelSpinning ? "is-spinning" : "")}
                  style={{
                    top: pointerTop,
                    width: 0,
                    height: 0,
                    borderLeft: "12px solid transparent",
                    borderRight: "12px solid transparent",
                    borderTop: `${POINTER_H_PX}px solid #f43f5e`,
                    filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.5))",
                  }}
                />
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="rounded-full bg-rose-500 px-3 py-1 text-sm font-black text-white shadow-[0_4px_10px_rgba(190,24,93,0.4)]">
                  {wheelTickets} 🎡
                </span>
                {wheelLastRewardText && (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/35">
                    Приз: {wheelLastRewardText}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={wheelSpinning || wheelTickets <= 0}
                onClick={onSpin}
                className="mt-3 w-full rounded-2xl border-2 border-rose-300/60 bg-gradient-to-b from-rose-500 to-pink-600 py-3 text-lg font-black text-white shadow-[0_6px_0_#9f1239,0_12px_24px_rgba(190,24,93,0.45),inset_0_2px_0_rgba(255,255,255,0.3)] transition hover:brightness-110 active:translate-y-px active:shadow-[0_3px_0_#9f1239] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {wheelSpinning ? "Крутим..." : "Крутить колесо"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onBuyTickets(1, 5)} className="rounded-xl border border-cyan-300/45 bg-gradient-to-b from-cyan-500/30 to-sky-600/25 px-3 py-2 text-sm font-bold text-cyan-100 transition hover:brightness-110">
                Купить 1 🎡 за 5 ❤
              </button>
              <button type="button" onClick={() => onBuyTickets(5, 25)} className="rounded-xl border border-cyan-300/45 bg-gradient-to-b from-cyan-500/30 to-sky-600/25 px-3 py-2 text-sm font-bold text-cyan-100 transition hover:brightness-110">
                Купить 5 🎡 за 25 ❤
              </button>
            </div>
            <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-3">
              <p className="text-sm font-black text-emerald-200">Бесплатные шансы</p>
              <p className="mt-1 text-xs font-semibold text-emerald-100/90">
                {freeChanceReady ? "Бесплатный прокрут доступен" : `Появятся через: ${freeChanceCountdown}`}
              </p>
              <button
                type="button"
                disabled={!freeChanceReady || wheelSpinning}
                onClick={onSpinFree}
                className="mt-2 w-full rounded-xl border border-emerald-300/55 bg-gradient-to-b from-emerald-400 to-green-600 px-3 py-2 text-sm font-black text-white shadow-[0_4px_10px_rgba(22,163,74,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-500 disabled:to-slate-600 disabled:text-slate-200 disabled:shadow-none"
              >
                Крутить
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
