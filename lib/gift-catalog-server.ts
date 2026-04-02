import { getDb } from "@/lib/db"
import { type GiftCatalogRow } from "@/lib/gift-catalog"

type GiftCatalogDbRow = {
  id: string
  section: string
  name: string
  emoji: string
  cost: number
  published: number
  deleted: number
}

export function listGiftCatalogRows(options?: { includeDeleted?: boolean; onlyPublished?: boolean }): GiftCatalogRow[] {
  const db = getDb()
  const where: string[] = []
  if (!options?.includeDeleted) where.push("deleted = 0")
  if (options?.onlyPublished) where.push("published = 1")
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  const rows = db
    .prepare(
      `SELECT id, section, name, emoji, cost, published, deleted
       FROM gift_catalog
       ${whereSql}
       ORDER BY sort_order ASC, updated_at ASC`,
    )
    .all() as GiftCatalogDbRow[]

  return rows.map((row) => ({
    id: row.id as GiftCatalogRow["id"],
    section:
      row.section === "free" || row.section === "vip"
        ? row.section
        : (row.cost | 0) >= 10
          ? "vip"
          : "paid",
    name: row.name,
    emoji: row.emoji || "🎁",
    cost: Math.max(0, row.cost | 0),
    published: row.published === 1,
    deleted: row.deleted === 1,
  }))
}

export function updateGiftCatalogEntry(input: {
  id: string
  section?: "free" | "paid" | "vip"
  name?: string
  emoji?: string
  cost?: number
  published?: boolean
  deleted?: boolean
}) {
  if (typeof input.id !== "string" || !input.id.trim()) throw new Error("bad_gift_id")
  const safeId = input.id.trim()
  const db = getDb()
  const now = Date.now()
  const existing = db
    .prepare(`SELECT id, section, name, emoji, cost, published, deleted FROM gift_catalog WHERE id = ? LIMIT 1`)
    .get(safeId) as Omit<GiftCatalogDbRow, never> | undefined
  if (!existing) {
    const sortOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM gift_catalog`).get() as {
      next: number
    }
    db.prepare(
      `INSERT INTO gift_catalog (id, section, name, emoji, cost, published, deleted, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      safeId,
      input.section ?? "paid",
      input.name?.trim() || safeId,
      input.emoji?.trim() || "🎁",
      Math.max(0, Math.floor(Number(input.cost) || 0)),
      input.published === false ? 0 : 1,
      input.deleted === true ? 1 : 0,
      sortOrder.next,
      now,
    )
    return
  }

  const nextSection =
    input.section === "free" || input.section === "paid" || input.section === "vip" ? input.section : existing.section
  const nextName = typeof input.name === "string" && input.name.trim() ? input.name.trim() : existing.name
  const nextEmoji = typeof input.emoji === "string" && input.emoji.trim() ? input.emoji.trim() : existing.emoji
  const nextCost = Number.isFinite(Number(input.cost)) ? Math.max(0, Math.floor(Number(input.cost))) : existing.cost
  const nextPublished = typeof input.published === "boolean" ? (input.published ? 1 : 0) : existing.published
  const nextDeleted = typeof input.deleted === "boolean" ? (input.deleted ? 1 : 0) : existing.deleted

  db.prepare(
    `UPDATE gift_catalog
     SET section = ?, name = ?, emoji = ?, cost = ?, published = ?, deleted = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextSection, nextName, nextEmoji, nextCost, nextPublished, nextDeleted, now, safeId)
}

export function deleteGiftCatalogEntry(id: string) {
  if (typeof id !== "string" || !id.trim()) throw new Error("bad_gift_id")
  const safeId = id.trim()
  const db = getDb()
  db.prepare(`DELETE FROM gift_catalog WHERE id = ?`).run(safeId)
}
