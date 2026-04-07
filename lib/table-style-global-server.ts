import { getDb } from "@/lib/db"
import type { RoomMeta } from "@/lib/rooms/types"
import {
  DEFAULT_ROOM_TABLE_STYLE,
  normalizeRoomTableStyle,
  type RoomTableStyle,
} from "@/lib/rooms/room-appearance"

export type TableStyleGlobalState = {
  enabled: boolean
  styleId: RoomTableStyle
  updatedAt: number
}

export function getTableStyleGlobal(): TableStyleGlobalState {
  const db = getDb()
  const row = db
    .prepare(`SELECT enabled, style_id, updated_at FROM table_style_global WHERE id = 1`)
    .get() as { enabled: number; style_id: string; updated_at: number } | undefined
  if (!row) {
    return { enabled: false, styleId: DEFAULT_ROOM_TABLE_STYLE, updatedAt: Date.now() }
  }
  return {
    enabled: row.enabled === 1,
    styleId: normalizeRoomTableStyle(row.style_id),
    updatedAt: Number(row.updated_at) || Date.now(),
  }
}

export function setTableStyleGlobal(payload: {
  enabled?: boolean
  styleId?: string
}): TableStyleGlobalState {
  const prev = getTableStyleGlobal()
  const enabled = typeof payload.enabled === "boolean" ? payload.enabled : prev.enabled
  const styleId = normalizeRoomTableStyle(payload.styleId ?? prev.styleId)
  const now = Date.now()
  const db = getDb()
  db.prepare(
    `INSERT INTO table_style_global (id, enabled, style_id, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       style_id = excluded.style_id,
       updated_at = excluded.updated_at`,
  ).run(enabled ? 1 : 0, styleId, now)
  return getTableStyleGlobal()
}

/**
 * Эффективный скин стола: глобальный для системных столов; пользовательские комнаты — свой tableStyle.
 */
export function resolveEffectiveTableStyle(meta: RoomMeta | undefined): RoomTableStyle {
  const g = getTableStyleGlobal()
  if (g.enabled && !meta?.isUserRoom) {
    return normalizeRoomTableStyle(g.styleId)
  }
  return normalizeRoomTableStyle(meta?.tableStyle ?? DEFAULT_ROOM_TABLE_STYLE)
}
