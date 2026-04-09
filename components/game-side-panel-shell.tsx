"use client"

import { X } from "lucide-react"

type GameSidePanelShellProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  /** Единая стилистика боковых окон */
  variant?: "dark" | "material"
  /** Доп. элемент справа от заголовка (счётчик и т.п.) */
  headerRight?: React.ReactNode
  /** Переопределение фона/бордера панели (например, тема магазина) */
  panelClassName?: string
  headerClassName?: string
  titleClassName?: string
  contentClassName?: string
  closeButtonClassName?: string
  overlayClassName?: string
}

export function GameSidePanelShell({
  title,
  subtitle,
  onClose,
  children,
  variant = "dark",
  headerRight,
  panelClassName,
  headerClassName,
  titleClassName,
  contentClassName,
  closeButtonClassName,
  overlayClassName,
}: GameSidePanelShellProps) {
  const isMaterial = variant === "material"
  const basePanel =
    "side-panel-slide-in fixed inset-y-0 right-0 z-[60] flex h-app max-h-app w-full max-w-md flex-col border-l shadow-[-24px_0_60px_rgba(0,0,0,0.55)]"
  const baseHeader = "relative flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3 pr-10"
  const baseTitle = "truncate text-lg font-black tracking-tight"
  const baseContent = "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
  const baseClose =
    "rounded-lg p-1.5 transition"

  const panelDefaults = isMaterial
    ? "border-slate-200/85 bg-gradient-to-b from-white to-slate-50 shadow-[-24px_0_60px_rgba(15,23,42,0.18)]"
    : "border-cyan-500/20 bg-[rgba(2,6,23,0.98)]"

  const headerDefaults = isMaterial
    ? "border-slate-800/70 bg-slate-950/90"
    : "border-cyan-500/15"

  const titleDefaults = isMaterial ? "text-slate-100" : "text-slate-100"
  const subtitleDefaults = isMaterial ? "text-[15px] font-medium text-slate-300" : "text-xs text-slate-400"
  const contentDefaults = isMaterial
    ? "bg-gradient-to-b from-slate-50 via-white to-slate-100"
    : ""
  const closeDefaults = isMaterial
    ? "text-slate-300 hover:bg-white/10 hover:text-white"
    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"

  return (
    <>
      <button
        type="button"
        className={
          "side-panel-overlay-fade-in fixed inset-0 z-[55] bg-black/55 backdrop-blur-[1px] " + (overlayClassName ?? "")
        }
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="game-side-panel-title"
        className={
          `${basePanel} ${panelDefaults} ` + (panelClassName ?? "")
        }
      >
        <div
          className={
            `${baseHeader} ${headerDefaults} ` + (headerClassName ?? "")
          }
        >
          <div className="min-w-0">
            <h2
              id="game-side-panel-title"
              className={`${baseTitle} ${titleDefaults} ` + (titleClassName ?? "")}
            >
              {title}
            </h2>
            {subtitle ? <p className={subtitleDefaults}>{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              `side-panel-close-outside-right ${baseClose} ${closeDefaults} hover:brightness-110 ` +
              (closeButtonClassName ?? "")
            }
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className={`${baseContent} ${contentDefaults} ` + (contentClassName ?? "")}>
          {children}
        </div>
      </div>
    </>
  )
}
