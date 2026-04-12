"use client"

import { LobbySpotlightModal } from "@/components/lobby-spotlight-modal"

export interface BetaWelcomeModalProps {
  open: boolean
  onContinue: () => void
}

/**
 * Приветствие при входе (бета): светлая карточка в духе экрана «открыт жест», кнопка «Продолжить».
 */
export function BetaWelcomeModal({ open, onContinue }: BetaWelcomeModalProps) {
  return (
    <LobbySpotlightModal
      open={open}
      onContinue={onContinue}
      eyebrow="Добро пожаловать!"
      title="Игра в бета-версии"
      body="Привет! Это не значит, что нельзя поиграть и пообщаться — всё уже здесь. Заходи в зал: получай сердечки, крути бутылочку, выбирай стол, покупай и дари подарки. Дату официального запуска объявим отдельно."
      buttonLabel="Продолжить"
      titleId="beta-welcome-title"
      centerSlot={<span className="text-[4.5rem] leading-none drop-shadow-sm">👋</span>}
    />
  )
}
