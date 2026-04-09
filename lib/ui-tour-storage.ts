/**
 * Включить показ экрана обучения после ежедневного гейта (`ui-tour`).
 * Выключено — сразу лобби; компоненты и логика тура сохранены для возврата.
 */
export const UI_TOUR_ENABLED = false

const UI_TOUR_DONE_KEY = "spindate_ui_tour_done_v1"

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
  return !!readMap()[String(userId)]
}

export function markUiTourDone(userId: number): void {
  if (typeof window === "undefined") return
  try {
    const next = { ...readMap(), [String(userId)]: true }
    window.localStorage.setItem(UI_TOUR_DONE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
