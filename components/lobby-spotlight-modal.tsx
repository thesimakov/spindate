"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

export interface LobbySpotlightModalProps {
  open: boolean
  /** Мелкий текст над заголовком (например «Добро пожаловать!»). */
  eyebrow?: string
  title: string
  body: string
  buttonLabel: string
  /** Путь к картинке в public/uploads; если задан — показывается вместо centerSlot. */
  imageUrl?: string | null
  /** Блок по центру (эмодзи и т.п.), если нет imageUrl. */
  centerSlot?: ReactNode
  onContinue: () => void
  /** id для aria-labelledby — уникальный в рамках страницы. */
  titleId?: string
}

/**
 * Общая карточка-модалка в стиле бета-приветствия: тёмный фон, белая карточка, крестик.
 */
export function LobbySpotlightModal({
  open,
  eyebrow,
  title,
  body,
  buttonLabel,
  imageUrl,
  centerSlot,
  onContinue,
  titleId = "lobby-spotlight-title",
}: LobbySpotlightModalProps) {
  if (!open) return null

  const showImage = typeof imageUrl === "string" && imageUrl.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
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

        {eyebrow ? (
          <p className="mb-4 text-center text-[0.95rem] font-bold tracking-tight text-slate-400 sm:text-base">{eyebrow}</p>
        ) : null}

        {showImage ? (
          <div className="mb-5 flex justify-center" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!.trim()}
              alt=""
              className="max-h-40 w-auto max-w-full rounded-2xl object-contain shadow-sm"
            />
          </div>
        ) : centerSlot ? (
          <div className="mb-5 flex justify-center" aria-hidden>
            {centerSlot}
          </div>
        ) : null}

        <p
          id={titleId}
          className={`mb-3 text-center text-[1.05rem] font-bold leading-snug text-slate-900 sm:text-lg ${eyebrow || showImage || centerSlot ? "" : "mt-1"}`}
        >
          {title}
        </p>

        <p className="mb-6 whitespace-pre-wrap text-center text-[0.9rem] leading-relaxed text-slate-600 sm:text-[0.95rem]">
          {body}
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-2xl bg-emerald-500 py-3.5 text-center text-base font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
