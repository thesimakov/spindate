import { appPath } from "@/lib/app-path"

/** Почта по умолчанию для «Написать письмо»; переопределяется NEXT_PUBLIC_SUPPORT_EMAIL. */
export const DEFAULT_SUPPORT_EMAIL = "hello@lemnity.ru"

/**
 * mailto с темой про игру и id игрока (для поддержки).
 * Тема: Игра - "Крути и знакомься: Бутылочка" - Игрок {id}
 */
export function buildContactMailto(playerId: number | undefined): string {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL
  const idPart = playerId != null ? String(playerId) : "не авторизован"
  const subject = `Игра - "Крути и знакомься: Бутылочка" - Игрок ${idPart}`
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`
}

/** URL раздела «Вопросы и ответы». */
export function getFaqUrl(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_FAQ_URL?.trim() ?? ""
}

export function getPrivacyPageUrl(): string {
  const custom = process.env.NEXT_PUBLIC_PRIVACY_URL?.trim()
  if (custom) return custom
  if (typeof window === "undefined") return appPath("/privacy")
  return `${window.location.origin}${appPath("/privacy")}`
}

export function getTermsPageUrl(): string {
  const custom = process.env.NEXT_PUBLIC_TERMS_URL?.trim()
  if (custom) return custom
  if (typeof window === "undefined") return appPath("/terms")
  return `${window.location.origin}${appPath("/terms")}`
}
