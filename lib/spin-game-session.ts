const KEY = "spindate_spin_game_session"

/** Токен сессии бэкенда spin-game (`sessionToken` из POST /api/auth/vk). */
export function getSpinGameSessionToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setSpinGameSessionToken(token: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (token) sessionStorage.setItem(KEY, token)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
