"use client"

import { cn } from "@/lib/utils"
import type { InlineToastState } from "@/hooks/use-inline-toast"

interface InlineToastProps {
  toast: InlineToastState
  className?: string
  /**
   * Плавающий слой: `absolute` внутри `relative` предка (не в потоке).
   * `inlineUnderBankBar`: смещение вниз под панель «Банк эмоций» (ПК) или под мобильную полосу эмоций.
   * По умолчанию — fixed в углу вьюпорта.
   */
  inline?: boolean
  /** Уточняет `top` для режима `inline` (нужен `relative` на колонке game-room). */
  inlineUnderBankBar?: boolean
}

export function InlineToast({ toast, className, inline, inlineUnderBankBar }: InlineToastProps) {
  const toneClass =
    toast.type === "error"
      ? "border-rose-400/45 bg-rose-950/95 text-rose-100"
      : toast.type === "info"
        ? "border-amber-300/40 bg-slate-900/95 text-amber-100"
        : "border-cyan-300/35 bg-slate-900/95 text-cyan-100"

  const boxClass = cn(
    "rounded-xl border px-3 py-2 text-left text-sm font-semibold shadow-[0_10px_30px_rgba(2,6,23,0.55)] animate-in fade-in zoom-in-95 duration-200",
    "max-w-[min(22rem,calc(100vw-2rem))]",
    toneClass,
  )

  if (inline) {
    const topUnderBar = inlineUnderBankBar
      ? "top-[calc(58px+0.5rem)]"
      : "top-[calc(70px+0.375rem)]"
    return (
      <div
        className={cn(
          "pointer-events-none absolute right-2 z-[46] max-w-[min(22rem,calc(100%-1rem))] lg:right-3",
          topUnderBar,
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <div className={cn(boxClass, "pointer-events-auto shadow-[0_12px_36px_rgba(2,6,23,0.65)]")}>
          {toast.message}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-[60] rounded-xl border px-3 py-2 text-sm font-semibold shadow-[0_10px_30px_rgba(2,6,23,0.55)] animate-in fade-in zoom-in-95 duration-200",
        toneClass,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  )
}
