import type { GameAction } from "@/lib/game-types"

/**
 * Единый список действий, которые разрешено синхронизировать между клиентами через /api/table/events.
 * Любые локальные экономические действия (PAY_VOICES, ADD_VOICES и т.п.) сюда не добавляются.
 */
export const TABLE_SYNCED_ACTION_TYPES = [
  "START_COUNTDOWN",
  "TICK_COUNTDOWN",
  "START_SPIN",
  "STOP_SPIN",
  "BEGIN_PAIR_KISS_PHASE",
  "SET_PAIR_KISS_CHOICE",
  "FINALIZE_PAIR_KISS",
  "NEXT_TURN",
  "REQUEST_EXTRA_TURN",
  "ADD_LOG",
  "SEND_GENERAL_CHAT",
  "SET_AVATAR_FRAME",
  "ADD_DRUNK_TIME",
  "SET_BOTTLE_SKIN",
  "SET_BOTTLE_DONOR",
  "SET_BOTTLE_TABLE_PURCHASE",
  "RESET_ROUND",
  "SET_BOTTLE_COOLDOWN_UNTIL",
  "SET_CLIENT_TAB_AWAY",
  "START_PREDICTION_PHASE",
  "END_PREDICTION_PHASE",
  "ADD_PREDICTION",
  "PLACE_BET",
] as const

type SyncedActionType = (typeof TABLE_SYNCED_ACTION_TYPES)[number]

const TABLE_SYNCED_ACTION_SET = new Set<string>(TABLE_SYNCED_ACTION_TYPES)

export function isTableSyncedAction(action: GameAction): action is Extract<GameAction, { type: SyncedActionType }> {
  return TABLE_SYNCED_ACTION_SET.has(action.type)
}
