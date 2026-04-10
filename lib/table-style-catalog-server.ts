import { getDb } from "@/lib/db"
import type { RoomTableStyle } from "@/lib/rooms/room-appearance"

export type TableStyleCatalogRow = {
  id: RoomTableStyle
  name: string
  published: boolean
  updatedAt: number
  sortOrder: number
}

const STYLE_NAMES: Record<RoomTableStyle, string> = {
  classic_night: "Классическая ночь",
  sunset_lounge: "Закатный лаунж",
  ocean_breeze: "Океанский бриз",
  violet_dream: "Фиолетовый сон",
  cosmic_rockets: "Космос и ракеты",
  light_day: "Светлый день",
}

function fallbackRows(now = Date.now()): TableStyleCatalogRow[] {
  return (Object.keys(STYLE_NAMES) as RoomTableStyle[]).map((id, index) => ({
    id,
    name: STYLE_NAMES[id],
    published: id !== "cosmic_rockets",
    updatedAt: now,
    sortOrder: index,
  }))
}

export function listTableStyleCatalog(): TableStyleCatalogRow[] {
  const db = getDb()
  const rows = db
    .prepare(`SELECT id, name, published, updated_at FROM table_style_catalog ORDER BY sort_order ASC, id ASC`)
    .all() as Array<{ id: string; name: string; published: number; updated_at: number }>
  if (!rows.length) return fallbackRows()
  const byId = new Map<string, { id: string; name: string; published: number; updated_at: number }>()
  for (const r of rows) {
    if (r?.id) byId.set(r.id, r)
  }
  const now = Date.now()
  return (Object.keys(STYLE_NAMES) as RoomTableStyle[]).map((id, index) => {
    const row = byId.get(id)
    return {
      id,
      name: row && typeof row.name === "string" && row.name.trim() ? row.name : STYLE_NAMES[id],
      published: row ? row.published === 1 : id !== "cosmic_rockets",
      updatedAt: row ? Number(row.updated_at) || now : now,
      sortOrder: index,
    }
  })
}

export function listPublishedTableStyles(): RoomTableStyle[] {
  return listTableStyleCatalog()
    .filter((r) => r.published)
    .map((r) => r.id)
}

export function isTableStylePublished(id: RoomTableStyle): boolean {
  return listTableStyleCatalog().some((row) => row.id === id && row.published)
}

export function updateTableStyleCatalog(id: RoomTableStyle, payload: { name?: string; published?: boolean }): TableStyleCatalogRow[] {
  const db = getDb()
  const prev = db.prepare(`SELECT name FROM table_style_catalog WHERE id = ?`).get(id) as { name: string } | undefined
  const nextName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim().slice(0, 80)
      : prev?.name && prev.name.trim()
        ? prev.name
        : STYLE_NAMES[id]
  const now = Date.now()
  db.prepare(
    `UPDATE table_style_catalog
     SET name = ?, published = COALESCE(?, published), updated_at = ?
     WHERE id = ?`,
  ).run(nextName, typeof payload.published === "boolean" ? (payload.published ? 1 : 0) : null, now, id)
  return listTableStyleCatalog()
}
