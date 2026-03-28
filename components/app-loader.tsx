"use client"

interface AppLoaderProps {
  title?: string
  subtitle?: string
  hint?: string
  className?: string
}

/** Живой лоадер: спиннер + пульсирующие точки + текст */
export function AppLoader({ title = "Загрузка...", subtitle, hint, className = "" }: AppLoaderProps) {
  return (
    <div
      className={`flex min-h-app flex-col items-center justify-center gap-8 px-6 bg-slate-900/98 text-slate-100 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {/* Двойное кольцо + пульс */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-20 w-20 rounded-full border-4 border-amber-500/20"
          aria-hidden
        />
        <div
          className="h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-amber-400 border-r-amber-500/60"
          style={{ animationDuration: "0.9s" }}
          aria-hidden
        />
        <div
          className="absolute h-12 w-12 animate-spin rounded-full border-2 border-transparent border-b-rose-400/80 border-l-rose-500/50"
          style={{ animationDuration: "1.4s", animationDirection: "reverse" }}
          aria-hidden
        />
        <div
          className="absolute h-24 w-24 animate-ping rounded-full border-2 border-amber-400/30"
          style={{ animationDuration: "2s", animationIterationCount: "infinite" }}
          aria-hidden
        />
      </div>

      {/* Текст */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-semibold text-slate-200">{title}</p>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        {/* Пульсирующие точки */}
        <div className="flex gap-1.5 pt-1" aria-hidden>
          <span
            className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"
            style={{ animationDelay: "0s", animationDuration: "0.6s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-amber-500/80 animate-pulse"
            style={{ animationDelay: "0.2s", animationDuration: "0.6s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-amber-400/70 animate-pulse"
            style={{ animationDelay: "0.4s", animationDuration: "0.6s" }}
          />
        </div>
        {hint && <p className="text-[11px] text-slate-500 pt-1">{hint}</p>}
      </div>

      {/* Полоска прогресса (бесконечная анимация) */}
      <div className="w-48 h-1 rounded-full bg-slate-700/80 overflow-hidden">
        <div className="app-loader-shimmer h-full w-1/2 rounded-full bg-gradient-to-r from-amber-500/40 to-amber-400" />
      </div>
    </div>
  )
}
