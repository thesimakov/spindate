import { getDb } from "@/lib/db"

export type MaintenanceModeRow = {
  enabled: boolean
  updatedAt: number
}

type MaintenanceModeDbRow = {
  enabled: number
  updated_at: number
}

export function getMaintenanceMode(): MaintenanceModeRow {
  const db = getDb()
  const row = db
    .prepare(`SELECT enabled, updated_at FROM maintenance_mode WHERE id = 1 LIMIT 1`)
    .get() as MaintenanceModeDbRow | undefined
  if (!row) {
    const now = Date.now()
    db.prepare(
      `INSERT INTO maintenance_mode (id, enabled, updated_at)
       VALUES (1, 0, ?)
       ON CONFLICT(id) DO NOTHING`,
    ).run(now)
    return { enabled: false, updatedAt: now }
  }
  return {
    enabled: row.enabled === 1,
    updatedAt: Number(row.updated_at) || 0,
  }
}

export function updateMaintenanceMode(enabled: boolean): MaintenanceModeRow {
  const db = getDb()
  const now = Date.now()
  db.prepare(
    `INSERT INTO maintenance_mode (id, enabled, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
  ).run(enabled ? 1 : 0, now)
  return { enabled, updatedAt: now }
}
