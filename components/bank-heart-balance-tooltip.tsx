"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatBankPassiveCountdown } from "@/hooks/use-bank-passive"
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("cursor-help tabular-nums", className)}
          title={`Следующие 3 сердечка через ${t}. Нажмите для подсказки.`}
        >
          <span className={tabularClassName}>{voiceBalance}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[18rem] border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 shadow-xl"
      >
        <p className="text-xs font-medium leading-snug">
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
