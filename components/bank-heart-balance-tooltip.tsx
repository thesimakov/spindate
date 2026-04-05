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
}

/** Число банка с подсказкой таймера и кнопкой «Ускорить» → магазин */
export function BankHeartBalanceTooltip({
  voiceBalance,
  msUntilNext,
  onOpenShop,
  className,
  tabularClassName,
}: BankHeartBalanceTooltipProps) {
  const t = formatBankPassiveCountdown(msUntilNext)
  const compact = formatVoiceBalanceCompact(voiceBalance)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("cursor-help tabular-nums", className)}
          title={`Баланс: ${voiceBalance.toLocaleString("ru-RU")} ❤ · следующие 3 сердечка через ${t}`}
        >
          <span className={tabularClassName}>{compact}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[18rem] border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 shadow-xl"
      >
        <p className="text-[11px] font-semibold tabular-nums text-white">
          Точный баланс: {voiceBalance.toLocaleString("ru-RU")} ❤
        </p>
        <p className="mt-1.5 text-xs font-medium leading-snug">
          Следующие 3 сердечка через{" "}
          <span className="font-black tabular-nums text-cyan-300">{t}</span>
        </p>
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
