/** Один раз за сессию на конкретную версию контента (updatedAt): после закрытия не показываем до новой публикации. */
export const LOBBY_ANNOUNCE_SESSION_PREFIX = "spindate_lobby_announce_v1_"

export function lobbyAnnouncementSessionKey(updatedAt: number): string {
  return `${LOBBY_ANNOUNCE_SESSION_PREFIX}${updatedAt}`
}

export function readLobbyAnnouncementAcknowledged(updatedAt: number): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(lobbyAnnouncementSessionKey(updatedAt)) === "1"
  } catch {
    return true
  }
}

export function writeLobbyAnnouncementAcknowledged(updatedAt: number): void {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(lobbyAnnouncementSessionKey(updatedAt), "1")
    }
  } catch {
    // ignore
  }
}
