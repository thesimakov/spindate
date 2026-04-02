"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Crown, Flower2, Heart, Sparkles } from "lucide-react"
import { DAILY_STREAK_DAY_COUNT, DAILY_STREAK_REWARDS, type DailyStreakReward } from "@/lib/daily-streak-rewards"

export interface DailyStreakBonusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Текущий день серии 1–8. */
  streakDay: number
  onClaim: () => void | Promise<void>
}

/** Акценты: фиолет + бирюза (без оранжевого) */
const acc = {
  border: "border-violet-500/40",
  borderGlow: "shadow-[0_0_0_1px_rgba(167,139,250,0.2),0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
  grad: "from-violet-400 via-fuchsia-500 to-purple-700",
  gradSoft: "from-cyan-400/90 to-violet-600/95",
  textGlow: "shadow-[0_0_16px_rgba(34,211,238,0.45)]",
}

const PARTICLE_STYLES = [
  { left: "10%", bottom: "18%", delay: "0s" },
  { left: "28%", bottom: "12%", delay: "0.9s" },
  { left: "52%", bottom: "22%", delay: "1.6s" },
  { left: "72%", bottom: "14%", delay: "2.2s" },
  { left: "88%", bottom: "28%", delay: "0.4s" },
  { left: "40%", bottom: "8%", delay: "2.8s" },
] as const

export function DailyStreakBonusDialog({ open, onOpenChange, streakDay, onClaim }: DailyStreakBonusDialogProps) {
  const streak = Math.min(DAILY_STREAK_DAY_COUNT, Math.max(1, streakDay))

  const modalShell = `rounded-[1.85rem] border ${acc.border} bg-[#12101a] ${acc.borderGlow}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="backdrop-blur-md bg-black/65"
        className="max-w-[min(100%,26rem)] w-[calc(100%-1.5rem)] overflow-visible border-0 bg-transparent p-0 shadow-none"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className={`relative overflow-hidden ${modalShell}`}>
          <div className="relative overflow-hidden px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-7">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "linear-gradient(165deg, #2a1f45 0%, #1a1428 45%, #12101c 100%)",
              }}
              aria-hidden
            />

            <div
              className="daily-streak-aurora-1 pointer-events-none absolute -left-[20%] -top-[30%] h-[140%] w-[85%] rounded-full bg-gradient-to-br from-violet-600/35 via-fuchsia-600/25 to-transparent blur-3xl"
              aria-hidden
            />
            <div
              className="daily-streak-aurora-2 pointer-events-none absolute -bottom-[40%] -right-[25%] h-[130%] w-[80%] rounded-full bg-gradient-to-tl from-cyan-500/20 via-violet-600/25 to-transparent blur-3xl"
              aria-hidden
            />

            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {PARTICLE_STYLES.map((p, i) => (
                <span
                  key={i}
                  className="daily-streak-particle absolute h-1 w-1 rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 opacity-80 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                  style={{
                    left: p.left,
                    bottom: p.bottom,
                    animationDelay: p.delay,
                    animationDuration: `${3.8 + (i % 3) * 0.6}s`,
                  }}
                />
              ))}
            </div>

            <div
              className="daily-streak-shimmer-layer pointer-events-none absolute -left-[30%] top-0 h-full w-[55%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
              aria-hidden
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" aria-hidden />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm sm:text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" strokeWidth={2.5} aria-hidden />
                Серия 8 дней
              </div>
              <h2 className="text-xl font-black tracking-tight text-zinc-50 sm:text-[1.35rem]">
                Ежедневный бонус
              </h2>
              <p className="mt-2 max-w-[20ch] text-[13px] font-bold leading-snug text-zinc-200 sm:max-w-none sm:text-sm">
                День {streak} — забери награду и не прерывай серию!
              </p>
              <p className="mt-1.5 max-w-[22rem] text-[11px] font-medium leading-snug text-zinc-400 sm:text-xs">
                Заходи каждый день: награды растут, в конце — розы и супер-рамка.
              </p>

              <div
                className="mt-4 flex max-w-full flex-wrap items-center justify-center gap-1 sm:gap-1.5"
                role="list"
                aria-label="Прогресс серии"
              >
                {Array.from({ length: DAILY_STREAK_DAY_COUNT }, (_, i) => {
                  const d = i + 1
                  const current = d === streak
                  return (
                    <span
                      key={d}
                      role="listitem"
                      className={
                        current
                          ? `h-2 w-6 rounded-full bg-gradient-to-r sm:w-7 ${acc.gradSoft} ${acc.textGlow} shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]`
                          : "h-2 w-1.5 rounded-full bg-zinc-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] sm:w-2"
                      }
                      title={`День ${d}`}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] bg-gradient-to-b from-[#16101f] via-[#12101a] to-[#0c0a12] px-3 pb-5 pt-4 sm:px-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {DAILY_STREAK_REWARDS.slice(0, 6).map((spec, i) => {
                const d = i + 1
                const isActive = d === streak
                const isPast = d < streak
                return <DayCapsule key={d} day={d} spec={spec} active={isActive} past={isPast} />
              })}
            </div>

            {/* День 7 шире, день 8 — слот под супер-рамку */}
            <div className="mt-2.5 flex w-full items-stretch gap-2 sm:gap-2.5">
              <div className="min-w-0 flex-[1.5]">
                <DayCapsule
                  day={7}
                  spec={DAILY_STREAK_REWARDS[6]}
                  active={7 === streak}
                  past={7 < streak}
                />
              </div>
              <div className="min-w-0 flex-1">
                <DayCapsule
                  day={8}
                  spec={DAILY_STREAK_REWARDS[7]}
                  active={8 === streak}
                  past={8 < streak}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void Promise.resolve(onClaim()).finally(() => onOpenChange(false))
              }}
              className={`mt-5 w-full rounded-full border-2 border-violet-400/85 bg-gradient-to-b ${acc.grad} py-3.5 text-center text-base font-extrabold text-white shadow-[0_6px_0_#4c1d95,0_16px_36px_rgba(139,92,246,0.38),inset_0_2px_0_rgba(255,255,255,0.4)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] transition hover:brightness-[1.06] active:translate-y-1 active:shadow-[0_3px_0_#4c1d95,0_10px_24px_rgba(139,92,246,0.35)]`}
            >
              Получить
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DayCapsule({
  day,
  spec,
  active,
  past,
}: {
  day: number
  spec: DailyStreakReward
  active: boolean
  past: boolean
}) {
  const locked = !active && !past

  return (
    <div
      className={
        "relative flex min-h-[3.35rem] w-full min-w-0 items-center gap-2 rounded-2xl px-2.5 py-2 sm:min-h-[3.5rem] sm:rounded-3xl sm:px-3 sm:py-2.5 " +
        (active
          ? "border-2 border-violet-400/90 bg-[#1c1826] pt-3.5 shadow-[0_0_24px_rgba(139,92,246,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : past
            ? "border border-emerald-500/35 bg-emerald-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "border border-zinc-700/60 bg-zinc-800/50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]")
      }
    >
      {active && (
        <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-fuchsia-500/80 bg-gradient-to-b from-violet-500 to-fuchsia-600 px-2 py-0.5 text-[8px] font-black uppercase leading-none tracking-wide text-white shadow-[0_4px_14px_rgba(167,139,250,0.55)] sm:text-[9px]">
          Сегодня
        </span>
      )}
      <div
        className={
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:h-9 sm:w-9 " +
          (active
            ? "border-violet-400/75 bg-[#252030] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]"
            : past
              ? "border-emerald-500/50 bg-[#1a1f1c]"
              : "border-zinc-600 bg-zinc-900/80")
        }
      >
        {past ? (
          <span className="text-base font-black leading-none text-emerald-400" aria-hidden>
            ✓
          </span>
        ) : locked ? (
          <span className="h-2 w-2 rounded-full bg-zinc-500" aria-hidden />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.85)]" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <span
          className={
            "block text-[12px] font-black leading-tight sm:text-sm " +
            (active ? "text-zinc-50" : past ? "text-emerald-200/95" : "text-zinc-400")
          }
        >
          день {day}
        </span>
        {locked && (
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">скоро</span>
        )}
      </div>
      <span
        className={
          "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 shadow-md sm:px-2.5 " +
          (locked
            ? "bg-gradient-to-b from-[#5c6b7a] to-[#3d4a5c] ring-1 ring-white/10"
            : "bg-gradient-to-b from-violet-500 via-fuchsia-500 to-purple-800 ring-1 ring-violet-300/40")
        }
      >
        {spec.kind === "hearts" ? (
          <Heart
            className="h-3.5 w-3.5 shrink-0 fill-white text-white sm:h-4 sm:w-4"
            strokeWidth={0}
            aria-hidden
          />
        ) : spec.kind === "roses" ? (
          <Flower2 className="h-3.5 w-3.5 shrink-0 text-white sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
        ) : (
          <Crown
            className={
              "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 " + (locked ? "text-zinc-100" : "text-amber-100")
            }
            strokeWidth={2.25}
            aria-hidden
          />
        )}
        <span className="text-[11px] font-black tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] sm:text-xs">
          {spec.kind === "frame" ? "×1" : spec.amount}
        </span>
      </span>
    </div>
  )
}
