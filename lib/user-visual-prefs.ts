import type { GameAction, GameState, InventoryItem, UserVisualPrefs } from "@/lib/game-types"

export type { UserVisualPrefs }

/** Восстановление экономики + визуала с сервера (один users.id — одни и те же настройки для ВК/ОК/логина). */
export function buildRestoreGameStateAction(
  voiceBalance: number,
  inventory: InventoryItem[],
  playerNumericId: number,
  visualPrefsRaw: unknown,
): GameAction {
  const has =
    visualPrefsRaw &&
    typeof visualPrefsRaw === "object" &&
    !Array.isArray(visualPrefsRaw) &&
    Object.keys(visualPrefsRaw as object).length > 0
  const visualPrefs = has ? (visualPrefsRaw as UserVisualPrefs) : undefined
  return {
    type: "RESTORE_GAME_STATE",
    voiceBalance,
    inventory,
    ...(visualPrefs ? { visualPrefs, playerIdForVisuals: playerNumericId } : {}),
  }
}

export function parseVisualPrefsJson(raw: string | null | undefined): UserVisualPrefs | undefined {
  if (raw == null || raw === "" || raw === "{}") return undefined
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== "object" || Array.isArray(o)) return undefined
    return o as UserVisualPrefs
  } catch {
    return undefined
  }
}

export function mergeVisualPrefsJson(existing: string | undefined, patch: Partial<UserVisualPrefs> | undefined): string {
  const base = parseVisualPrefsJson(existing) ?? {}
  if (!patch) return JSON.stringify(base)
  const next: UserVisualPrefs = { ...base, ...patch }
  if (patch.ownedBottleSkins !== undefined) next.ownedBottleSkins = patch.ownedBottleSkins
  if (patch.avatarFrameId !== undefined) next.avatarFrameId = patch.avatarFrameId
  return JSON.stringify(next)
}

/** Снимок визуальных полей для PUT /api/user/state (один пользователь = один набор настроек на сервере). */
export function buildVisualPrefsPayload(state: GameState): UserVisualPrefs {
  const uid = state.currentUser?.id
  const frame = uid != null ? state.avatarFrames?.[uid] : undefined
  return {
    tableStyle: state.tableStyle,
    ownedBottleSkins: state.ownedBottleSkins,
    soundsEnabled: state.soundsEnabled,
    avatarFrameId: frame === "none" || frame == null ? null : frame,
  }
}
