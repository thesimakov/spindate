import type { GeneralChatMessage } from "@/lib/game-types"

/** Хранение истории чата комнаты: последние сутки по времени сообщения. */
export const ROOM_CHAT_RETENTION_MS = 24 * 60 * 60 * 1000

/**
 * Запасной потолок по числу сообщений после фильтра по времени (очень активный чат).
 */
export const ROOM_CHAT_MAX_MESSAGES = 500

/**
 * Оставить сообщения не старше `ROOM_CHAT_RETENTION_MS` относительно `nowMs`, по возрастанию времени.
 */
export function trimRoomChatMessages(
  messages: GeneralChatMessage[] | undefined,
  nowMs: number = Date.now(),
): GeneralChatMessage[] {
  const cutoff = nowMs - ROOM_CHAT_RETENTION_MS
  const list = (messages ?? []).filter(
    (m) => typeof m.timestamp === "number" && Number.isFinite(m.timestamp) && m.timestamp >= cutoff,
  )
  if (list.length <= ROOM_CHAT_MAX_MESSAGES) return list
  return list.slice(-ROOM_CHAT_MAX_MESSAGES)
}
