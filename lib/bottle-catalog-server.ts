import { getDb } from "@/lib/db"
import { isBottleSkin, toBottleImageUrl, type BottleCatalogSkinRow } from "@/lib/bottle-catalog"
import type { BottleSkin } from "@/lib/game-types"

type BottleCatalogDbRow = {
  id: string
  name: string
  img: string
  cost: number
  published: number
  deleted: number
  sort_order: number
}

export function listBottleCatalogRows(options?: {
  includeDeleted?: boolean
  onlyPublished?: boolean
  resolveImage?: boolean
}): BottleCatalogSkinRow[] {
  const db = getDb()
  const where: string[] = []
  if (!options?.includeDeleted) where.push("deleted = 0")
  if (options?.onlyPublished) where.push("published = 1")
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  const rows = db
    .prepare(
      `SELECT id, name, img, cost, published, deleted, sort_order
       FROM bottle_catalog
       ${whereSql}
       ORDER BY sort_order ASC, updated_at ASC`,
    )
    .all() as BottleCatalogDbRow[]

  return rows
    .filter((row) => isBottleSkin(row.id))
    .map((row) => ({
      id: row.id as BottleSkin,
      name: row.name,
      img: options?.resolveImage === false ? row.img : toBottleImageUrl(row.img),
      cost: Math.max(0, row.cost | 0),
      published: row.published === 1,
      deleted: row.deleted === 1,
    }))
}

export function getBottleCatalogCostServer(id: BottleSkin): number {
  const db = getDb()
  const row = db
    .prepare(`SELECT cost FROM bottle_catalog WHERE id = ? AND published = 1 AND deleted = 0 LIMIT 1`)
    .get(id) as { cost: number } | undefined
  return row?.cost ?? 0
}

export function updateBottleCatalogEntry(input: {
  id: string
  name?: string
  img?: string
  cost?: number
  published?: boolean
  deleted?: boolean
}) {
  if (!isBottleSkin(input.id)) {
    throw new Error("unknown_bottle_id")
  }
  const db = getDb()
  const now = Date.now()
  const existing = db
    .prepare(`SELECT id, name, img, cost, published, deleted FROM bottle_catalog WHERE id = ? LIMIT 1`)
    .get(input.id) as Omit<BottleCatalogDbRow, "sort_order"> | undefined
  if (!existing) {
    throw new Error("not_found")
  }
  const nextName = typeof input.name === "string" && input.name.trim() ? input.name.trim() : existing.name
  const nextImg = typeof input.img === "string" ? input.img.trim() : existing.img
  const nextCost = Number.isFinite(Number(input.cost)) ? Math.max(0, Math.floor(Number(input.cost))) : existing.cost
  const nextPublished = typeof input.published === "boolean" ? (input.published ? 1 : 0) : existing.published
  const nextDeleted = typeof input.deleted === "boolean" ? (input.deleted ? 1 : 0) : existing.deleted

  db.prepare(
    `UPDATE bottle_catalog
     SET name = ?, img = ?, cost = ?, published = ?, deleted = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextName, nextImg, nextCost, nextPublished, nextDeleted, now, input.id)
}

