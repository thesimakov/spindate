/**
 * Включить показ экрана обучения после ежедневного гейта (`ui-tour`).
 * Включено — при первом входе игрок видит tutorial демо-сцены «Стол».
 */
export const UI_TOUR_ENABLED = true

const UI_TOUR_DONE_KEY = "spindate_ui_tour_done_v1"
const UI_TOUR_DONE_BOOL_KEY = (userId: number) => `tutorialCompleted_${userId}`

function readMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(UI_TOUR_DONE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>
    }
  } catch {
    /* ignore */
  }
  return {}
}

export function isUiTourDone(userId: number): boolean {
  const byMap = !!readMap()[String(userId)]
  if (byMap) return true
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(UI_TOUR_DONE_BOOL_KEY(userId)) === "true"
}

export function markUiTourDone(userId: number): void {
  if (typeof window === "undefined") return
  try {
    const next = { ...readMap(), [String(userId)]: true }
    window.localStorage.setItem(UI_TOUR_DONE_KEY, JSON.stringify(next))
    window.localStorage.setItem(UI_TOUR_DONE_BOOL_KEY(userId), "true")
  } catch {
    /* ignore */
  }
}
