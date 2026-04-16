import { getDb } from "@/lib/db"
import { toGiftImageUrl, type GiftCatalogRow } from "@/lib/gift-catalog"

type GiftCatalogDbRow = {
  id: string
  section: string
  name: string
  emoji: string
  img: string
  cost: number
  pay_currency: string
  stock: number
  published: number
  deleted: number
}

export function listGiftCatalogRows(options?: {
  includeDeleted?: boolean
  onlyPublished?: boolean
  resolveImage?: boolean
}): GiftCatalogRow[] {
  const db = getDb()
  const where: string[] = []
  if (!options?.includeDeleted) where.push("deleted = 0")
  if (options?.onlyPublished) where.push("published = 1")
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  const rows = db
    .prepare(
      `SELECT id, section, name, emoji, img, cost, pay_currency, stock, published, deleted
       FROM gift_catalog
       ${whereSql}
       ORDER BY sort_order ASC, updated_at ASC`,
    )
    .all() as GiftCatalogDbRow[]

  return rows.map((row) => {
    const payCurrency = row.pay_currency === "roses" ? "roses" : "hearts"
    const section: GiftCatalogRow["section"] =
      row.section === "free" || row.section === "vip"
        ? row.section
        : payCurrency === "roses"
          ? (row.cost | 0) >= 25
            ? "vip"
            : "paid"
          : (row.cost | 0) >= 10
            ? "vip"
            : "paid"
    const stockRaw = row.stock
    const stock = typeof stockRaw === "number" && Number.isFinite(stockRaw) ? Math.floor(stockRaw) : -1

    return {
      id: row.id as GiftCatalogRow["id"],
      section,
      name: row.name,
      emoji: row.emoji || "🎁",
      img: options?.resolveImage === false ? (row.img ?? "") : toGiftImageUrl(row.img ?? ""),
      cost: Math.max(0, row.cost | 0),
      payCurrency,
      published: row.published === 1,
      deleted: row.deleted === 1,
      stock: stock < 0 ? -1 : stock,
    }
  })
}

export function updateGiftCatalogEntry(input: {
  id: string
  section?: "free" | "paid" | "vip"
  name?: string
  emoji?: string
  img?: string
  cost?: number
  payCurrency?: "hearts" | "roses"
  /** −1 без лимита; иначе неотрицательное целое */
  stock?: number
  published?: boolean
  deleted?: boolean
}) {
  if (typeof input.id !== "string" || !input.id.trim()) throw new Error("bad_gift_id")
  const safeId = input.id.trim()
  const db = getDb()
  const now = Date.now()
  const existing = db
    .prepare(
      `SELECT id, section, name, emoji, img, cost, pay_currency, stock, published, deleted FROM gift_catalog WHERE id = ? LIMIT 1`,
    )
    .get(safeId) as GiftCatalogDbRow | undefined
  const nextPayCurrency =
    input.payCurrency === "roses" || input.payCurrency === "hearts"
      ? input.payCurrency
      : existing
        ? existing.pay_currency === "roses"
          ? "roses"
          : "hearts"
        : "hearts"
  const nextStockInsert =
    typeof input.stock === "number" && Number.isFinite(input.stock)
      ? input.stock < 0
        ? -1
        : Math.max(0, Math.floor(input.stock))
      : -1

  if (!existing) {
    const sortOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM gift_catalog`).get() as {
      next: number
    }
    db.prepare(
      `INSERT INTO gift_catalog (id, section, name, emoji, img, cost, pay_currency, stock, published, deleted, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      safeId,
      input.section ?? "paid",
      input.name?.trim() || safeId,
      input.emoji?.trim() || "🎁",
      typeof input.img === "string" ? input.img.trim() : "",
      Math.max(0, Math.floor(Number(input.cost) || 0)),
      nextPayCurrency,
      nextStockInsert,
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
  const nextImg = typeof input.img === "string" ? input.img.trim() : existing.img
  const nextCost = Number.isFinite(Number(input.cost)) ? Math.max(0, Math.floor(Number(input.cost))) : existing.cost
  const nextPublished = typeof input.published === "boolean" ? (input.published ? 1 : 0) : existing.published
  const nextDeleted = typeof input.deleted === "boolean" ? (input.deleted ? 1 : 0) : existing.deleted
  const nextPayDb = nextPayCurrency === "roses" ? "roses" : "hearts"
  const existingStock =
    typeof existing.stock === "number" && Number.isFinite(existing.stock) ? Math.floor(existing.stock) : -1
  const nextStock =
    typeof input.stock === "number" && Number.isFinite(input.stock)
      ? input.stock < 0
        ? -1
        : Math.max(0, Math.floor(input.stock))
      : existingStock < 0
        ? -1
        : existingStock

  db.prepare(
    `UPDATE gift_catalog
     SET section = ?, name = ?, emoji = ?, img = ?, cost = ?, pay_currency = ?, stock = ?, published = ?, deleted = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextSection, nextName, nextEmoji, nextImg, nextCost, nextPayDb, nextStock, nextPublished, nextDeleted, now, safeId)
}

export type ConsumeGiftStockResult =
  | { ok: true; unlimited: true }
  | { ok: true; unlimited: false; stockAfter: number }
  | { ok: false; reason: "not_found" | "out_of_stock" | "unpublished" }

/** Атомарно уменьшает остаток на 1 для подарка с лимитом (stock ≥ 0). Для stock &lt; 0 ничего не меняет — «без лимита». */
export function tryConsumeGiftStock(giftId: string): ConsumeGiftStockResult {
  const safeId = typeof giftId === "string" ? giftId.trim() : ""
  if (!safeId) return { ok: false, reason: "not_found" }
  const db = getDb()
  return db.transaction((): ConsumeGiftStockResult => {
    const row = db
      .prepare(`SELECT stock, published, deleted FROM gift_catalog WHERE id = ? LIMIT 1`)
      .get(safeId) as { stock: number; published: number; deleted: number } | undefined
    if (!row) return { ok: false, reason: "not_found" }
    if (row.deleted === 1) return { ok: false, reason: "not_found" }
    if (row.published !== 1) return { ok: false, reason: "unpublished" }
    const stockRaw = row.stock
    const stock = typeof stockRaw === "number" && Number.isFinite(stockRaw) ? Math.floor(stockRaw) : -1
    if (stock < 0) return { ok: true, unlimited: true }
    if (stock <= 0) return { ok: false, reason: "out_of_stock" }
    const now = Date.now()
    const upd = db
      .prepare(`UPDATE gift_catalog SET stock = stock - 1, updated_at = ? WHERE id = ? AND stock > 0`)
      .run(now, safeId)
    if (upd.changes === 0) return { ok: false, reason: "out_of_stock" }
    const nextRow = db.prepare(`SELECT stock FROM gift_catalog WHERE id = ?`).get(safeId) as { stock: number }
    const next = typeof nextRow?.stock === "number" ? Math.floor(nextRow.stock) : 0
    return { ok: true, unlimited: false, stockAfter: next }
  })()
}

export function deleteGiftCatalogEntry(id: string): { removedImagePath: string | null } {
  if (typeof id !== "string" || !id.trim()) throw new Error("bad_gift_id")
  const safeId = id.trim()
  const db = getDb()
  const existing = db.prepare(`SELECT id, img FROM gift_catalog WHERE id = ? LIMIT 1`).get(safeId) as
    | { id: string; img: string }
    | undefined
  if (!existing) return { removedImagePath: null }
  db.prepare(`DELETE FROM gift_catalog WHERE id = ?`).run(safeId)
  const pathTrimmed = typeof existing.img === "string" ? existing.img.trim() : ""
  if (!pathTrimmed) return { removedImagePath: null }
  return { removedImagePath: pathTrimmed }
}
