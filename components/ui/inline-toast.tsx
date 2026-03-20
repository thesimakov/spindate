"use client"

import type { InlineToastState } from "@/hooks/use-inline-toast"

interface InlineToastProps {
  toast: InlineToastState
  className?: string
}

export function InlineToast({ toast, className }: InlineToastProps) {
  const toneClass =
    toast.type === "error"
      ? "border-rose-400/45 bg-rose-950/95 text-rose-100"
      : toast.type === "info"
        ? "border-amber-300/40 bg-slate-900/95 text-amber-100"
        : "border-cyan-300/35 bg-slate-900/95 text-cyan-100"

  return (
    <div
      className={`fixed right-4 top-4 z-[60] rounded-xl border px-3 py-2 text-sm font-semibold shadow-[0_10px_30px_rgba(2,6,23,0.55)] animate-in fade-in zoom-in-95 duration-200 ${toneClass} ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  )
}
