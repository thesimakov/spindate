/** Один раз за сессию браузера: после «Продолжить» больше не показываем бета-приветствие до новой вкладки/сессии. */
export const BETA_WELCOME_SESSION_KEY = "spindate_beta_welcome_v1"

export function readBetaWelcomeAcknowledged(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(BETA_WELCOME_SESSION_KEY) === "1"
  } catch {
    return true
  }
}

export function writeBetaWelcomeAcknowledged(): void {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(BETA_WELCOME_SESSION_KEY, "1")
    }
  } catch {
    // ignore
  }
}
