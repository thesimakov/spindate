"use client"

import { X } from "lucide-react"

export interface BetaWelcomeModalProps {
  open: boolean
  onContinue: () => void
}

/**
 * Приветствие при входе (бета): светлая карточка в духе экрана «открыт жест», кнопка «Продолжить».
 */
export function BetaWelcomeModal({ open, onContinue }: BetaWelcomeModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-welcome-title"
    >
      <div className="relative w-full max-w-[min(100%,24rem)] rounded-[1.75rem] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
        <button
          type="button"
          onClick={onContinue}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-emerald-600 transition hover:bg-slate-200"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <p
          id="beta-welcome-title"
          className="mb-4 text-center text-[0.95rem] font-bold tracking-tight text-slate-400 sm:text-base"
        >
          Добро пожаловать!
        </p>

        <div className="mb-5 flex justify-center" aria-hidden>
          <span className="text-[4.5rem] leading-none drop-shadow-sm">👋</span>
        </div>

        <p className="mb-3 text-center text-[1.05rem] font-bold leading-snug text-slate-900 sm:text-lg">
          Игра в бета-версии
        </p>

        <p className="mb-6 text-center text-[0.9rem] leading-relaxed text-slate-600 sm:text-[0.95rem]">
          Привет! Это не значит, что нельзя поиграть и пообщаться — всё уже здесь. Заходи в зал: получай сердечки,
          крути бутылочку, выбирай стол, покупай и дари подарки. Дату официального запуска объявим отдельно.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-2xl bg-emerald-500 py-3.5 text-center text-base font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          Продолжить
        </button>
      </div>
    </div>
  )
}
