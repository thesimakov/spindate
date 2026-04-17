/** Бонус за каждый пункт в окне «Дополнительные сердечки». */
export const VK_EXTRA_HEARTS_GATE_BONUS_PER_ACTION = 5

export type VkExtraHeartsGateAction = "fav" | "group" | "notify"

export type VkExtraHeartsGateProgress = Record<VkExtraHeartsGateAction, boolean>

export const VK_EXTRA_HEARTS_GATE_ACTIONS: VkExtraHeartsGateAction[] = ["fav", "group", "notify"]

const VK_EXTRA_HEARTS_GATE_STORAGE_PREFIX = "spindate_vk_extra_hearts_gate_v1_"

export function emptyVkExtraHeartsGateProgress(): VkExtraHeartsGateProgress {
  return { fav: false, group: false, notify: false }
}

function isProgressShape(value: unknown): value is VkExtraHeartsGateProgress {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return VK_EXTRA_HEARTS_GATE_ACTIONS.every((k) => typeof obj[k] === "boolean")
}

function progressStorageKey(userId: number): string {
  return `${VK_EXTRA_HEARTS_GATE_STORAGE_PREFIX}${userId}`
}

export function readVkExtraHeartsGateProgress(userId: number): VkExtraHeartsGateProgress {
  if (typeof window === "undefined") return emptyVkExtraHeartsGateProgress()
  try {
    const raw = window.localStorage.getItem(progressStorageKey(userId))
    if (!raw) return emptyVkExtraHeartsGateProgress()
    const parsed: unknown = JSON.parse(raw)
    if (!isProgressShape(parsed)) return emptyVkExtraHeartsGateProgress()
    return parsed
  } catch {
    return emptyVkExtraHeartsGateProgress()
  }
}

export function writeVkExtraHeartsGateProgress(userId: number, progress: VkExtraHeartsGateProgress): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(progressStorageKey(userId), JSON.stringify(progress))
  } catch {
    // ignore localStorage failures
  }
}

export function isVkExtraHeartsGateCompleted(progress: VkExtraHeartsGateProgress): boolean {
  return VK_EXTRA_HEARTS_GATE_ACTIONS.every((k) => progress[k])
}
