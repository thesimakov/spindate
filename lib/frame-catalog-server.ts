import { getDb } from "@/lib/db"
import { type FrameCatalogRow } from "@/lib/frame-catalog"

type FrameCatalogDbRow = {
  id: string
  section: string
  name: string
  border: string
  shadow: string
  animation_class: string
  svg_path: string
  cost: number
  published: number
  deleted: number
}

export function listFrameCatalogRows(options?: { includeDeleted?: boolean; onlyPublished?: boolean }): FrameCatalogRow[] {
  const db = getDb()
  const where: string[] = []
  if (!options?.includeDeleted) where.push("deleted = 0")
  if (options?.onlyPublished) where.push("published = 1")
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  const rows = db
    .prepare(
      `SELECT id, section, name, border, shadow, animation_class, svg_path, cost, published, deleted
       FROM frame_catalog
       ${whereSql}
       ORDER BY sort_order ASC, updated_at ASC`,
    )
    .all() as FrameCatalogDbRow[]

  return rows.map((row) => ({
    id: row.id as FrameCatalogRow["id"],
    section: row.section === "free" ? "free" : "premium",
    name: row.name,
    border: row.border,
    shadow: row.shadow,
    animationClass: row.animation_class ?? "",
    svgPath: row.svg_path ?? "",
    cost: Math.max(0, row.cost | 0),
    published: row.published === 1,
    deleted: row.deleted === 1,
  }))
}

export function updateFrameCatalogEntry(input: {
  id: string
  section?: "free" | "premium"
  name?: string
  border?: string
  shadow?: string
  animationClass?: string
  svgPath?: string
  cost?: number
  published?: boolean
  deleted?: boolean
}) {
  if (typeof input.id !== "string" || !input.id.trim()) throw new Error("bad_frame_id")
  const safeId = input.id.trim()
  const db = getDb()
  const now = Date.now()
  const existing = db
    .prepare(
      `SELECT id, section, name, border, shadow, animation_class, svg_path, cost, published, deleted, sort_order
       FROM frame_catalog
       WHERE id = ? LIMIT 1`,
    )
    .get(safeId) as (FrameCatalogDbRow & { sort_order: number }) | undefined

  if (!existing) {
    const sortOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM frame_catalog`).get() as {
      next: number
    }
    db.prepare(
      `INSERT INTO frame_catalog (
         id, section, name, border, shadow, animation_class, svg_path, cost, published, deleted, sort_order, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      safeId,
      input.section ?? "free",
      input.name?.trim() || safeId,
      input.border?.trim() || "2px solid #475569",
      input.shadow?.trim() || "none",
      input.animationClass?.trim() || "",
      input.svgPath?.trim() || "",
      Math.max(0, Math.floor(Number(input.cost) || 0)),
      input.published === false ? 0 : 1,
      input.deleted === true ? 1 : 0,
      sortOrder.next,
      now,
    )
    return
  }

  const nextSection = input.section === "free" || input.section === "premium" ? input.section : existing.section
  const nextName = typeof input.name === "string" && input.name.trim() ? input.name.trim() : existing.name
  const nextBorder = typeof input.border === "string" && input.border.trim() ? input.border.trim() : existing.border
  const nextShadow = typeof input.shadow === "string" && input.shadow.trim() ? input.shadow.trim() : existing.shadow
  const nextAnimationClass =
    typeof input.animationClass === "string" ? input.animationClass.trim() : existing.animation_class
  const nextSvgPath = typeof input.svgPath === "string" ? input.svgPath.trim() : existing.svg_path
  const nextCost = Number.isFinite(Number(input.cost)) ? Math.max(0, Math.floor(Number(input.cost))) : existing.cost
  const nextPublished = typeof input.published === "boolean" ? (input.published ? 1 : 0) : existing.published
  const nextDeleted = typeof input.deleted === "boolean" ? (input.deleted ? 1 : 0) : existing.deleted

  db.prepare(
    `UPDATE frame_catalog
     SET section = ?, name = ?, border = ?, shadow = ?, animation_class = ?, svg_path = ?, cost = ?, published = ?, deleted = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    nextSection,
    nextName,
    nextBorder,
    nextShadow,
    nextAnimationClass,
    nextSvgPath,
    nextCost,
    nextPublished,
    nextDeleted,
    now,
    safeId,
  )
}
