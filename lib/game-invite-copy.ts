/** Тексты приглашения друзей в мини-приложение «Крути и знакомься». */

/** Одна строка для буфера и сообщений */
export const GAME_INVITE_MESSAGE_LINE = "Я играю в «Крути и знакомься» — присоединяйся!"

/** Ссылка на страницу приложения ВК, если задан `NEXT_PUBLIC_VK_APP_ID`. */
export function getVkMiniAppPageUrl(): string | undefined {
  try {
    const raw = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_VK_APP_ID?.trim() : undefined
    if (!raw) return undefined
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return undefined
    return `https://vk.com/app${n}`
  } catch {
    return undefined
  }
}

/** Текст для VKWebAppCopyText: приглашение и при наличии — ссылка на приложение. */
export function buildGameInviteClipboardText(): string {
  const url = getVkMiniAppPageUrl()
  if (url) return `${GAME_INVITE_MESSAGE_LINE}\n${url}`
  return GAME_INVITE_MESSAGE_LINE
}
