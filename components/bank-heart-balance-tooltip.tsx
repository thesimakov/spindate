"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatBankPassiveCountdown } from "@/hooks/use-bank-passive"
import { formatVoiceBalanceCompact } from "@/lib/format-voice-balance"
import { cn } from "@/lib/utils"

type BankHeartBalanceTooltipProps = {
  voiceBalance: number
  msUntilNext: number
  onOpenShop: () => void
  className?: string
  tabularClassName?: string
  /** Активный бонус за столом (+3 ❤ / 30 мин, лимит/сутки). */
  activeBonus?: {
    earnedToday: number
    dailyCap: number
    /** Условия для начисления выполняются (есть второй игрок, не пауза и т.д.). */
    isAccruing: boolean
    /** Пояснение, когда начисление сейчас не идёт. */
    idleHint?: string
  }
}

/** Число банка с подсказкой активного бонуса и кнопкой «Ускорить» → магазин */
export function BankHeartBalanceTooltip({
  voiceBalance,
  msUntilNext,
  onOpenShop,
  className,
  tabularClassName,
  activeBonus,
}: BankHeartBalanceTooltipProps) {
  const t = formatBankPassiveCountdown(msUntilNext)
  const compact = formatVoiceBalanceCompact(voiceBalance)

  const bonusTitle = activeBonus
    ? !activeBonus.isAccruing && activeBonus.idleHint
      ? `Активный бонус: ${activeBonus.idleHint}`
      : !activeBonus.isAccruing
        ? "Активный бонус: сейчас не копится"
        : activeBonus.earnedToday >= activeBonus.dailyCap
          ? `Активный бонус: лимит ${activeBonus.dailyCap} ❤/сутки исчерпан`
          : `Активный бонус: +3 ❤ через ${t} · ${activeBonus.earnedToday}/${activeBonus.dailyCap} за сегодня`
    : ""

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("cursor-help tabular-nums", className)}
          title={
            activeBonus
              ? `Баланс: ${voiceBalance.toLocaleString("ru-RU")} ❤ · ${bonusTitle}`
              : `Баланс: ${voiceBalance.toLocaleString("ru-RU")} ❤`
          }
        >
          <span className={tabularClassName}>{compact}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[20rem] border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 shadow-xl"
      >
        <p className="text-[11px] font-semibold tabular-nums text-white">
          Точный баланс: {voiceBalance.toLocaleString("ru-RU")} ❤
        </p>
        {activeBonus && (
          <div className="mt-1.5 space-y-1.5 text-xs font-medium leading-snug">
            <p className="font-bold text-cyan-200/95">Активный бонус</p>
            {!activeBonus.isAccruing && activeBonus.idleHint ? (
              <p className="text-slate-300">{activeBonus.idleHint}</p>
            ) : !activeBonus.isAccruing ? (
              <p className="text-slate-400">
                За столом с бутылочкой: до {activeBonus.dailyCap} ❤ в сутки активным игрокам (+3 ❤ / 30 мин).
              </p>
            ) : activeBonus.earnedToday >= activeBonus.dailyCap ? (
              <p className="text-slate-300">
                Сегодня уже получено максимум ({activeBonus.dailyCap} ❤) за игру за столом. Лимит обновится после полуночи.
              </p>
            ) : (
              <p className="text-slate-200">
                Сегодня:{" "}
                <span className="font-black tabular-nums text-cyan-300">
                  {activeBonus.earnedToday}/{activeBonus.dailyCap}
                </span>{" "}
                · следующее +3 через{" "}
                <span className="font-black tabular-nums text-cyan-300">{t}</span>
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onOpenShop()
          }}
          className="mt-2 w-full rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-2 py-1.5 text-center text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/25"
        >
          Ускорить
        </button>
      </TooltipContent>
    </Tooltip>
  )
}
