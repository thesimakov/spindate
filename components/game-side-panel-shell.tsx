"use client"

import { X } from "lucide-react"

type GameSidePanelShellProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  /** Доп. элемент справа от заголовка (счётчик и т.п.) */
  headerRight?: React.ReactNode
}

export function GameSidePanelShell({ title, subtitle, onClose, children, headerRight }: GameSidePanelShellProps) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="game-side-panel-title"
        className="fixed inset-y-0 right-0 z-[60] flex h-app max-h-app w-full max-w-md flex-col border-l border-cyan-500/20 bg-[rgba(2,6,23,0.98)] shadow-[-24px_0_60px_rgba(0,0,0,0.55)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cyan-500/15 px-4 py-3">
          <div className="min-w-0">
            <h2 id="game-side-panel-title" className="truncate text-lg font-bold text-slate-100">
              {title}
            </h2>
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">{children}</div>
      </div>
    </>
  )
}
