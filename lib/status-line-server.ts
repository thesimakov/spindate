import { getDb } from "@/lib/db"

export type StatusLineRow = {
  text: string
  published: boolean
  deleted: boolean
  updatedAt: number
}

type StatusLineDbRow = {
  text: string
  published: number
  deleted: number
  updated_at: number
}

export function getStatusLine(options?: { onlyPublished?: boolean }): StatusLineRow | null {
  const db = getDb()
  const row = db
    .prepare(`SELECT text, published, deleted, updated_at FROM status_line WHERE id = 1 LIMIT 1`)
    .get() as StatusLineDbRow | undefined
  if (!row) return null
  const text = typeof row.text === "string" ? row.text.trim() : ""
  const published = row.published === 1
  const deleted = row.deleted === 1
  if (options?.onlyPublished && (!published || deleted || !text)) {
    return null
  }
  return {
    text,
    published,
    deleted,
    updatedAt: Number(row.updated_at) || 0,
  }
}

export function updateStatusLine(input: {
  text?: string
  published?: boolean
  deleted?: boolean
}): StatusLineRow {
  const db = getDb()
  const now = Date.now()
  const existing = getStatusLine() ?? { text: "", published: false, deleted: false, updatedAt: now }
  const nextText = typeof input.text === "string" ? input.text.trim() : existing.text
  const nextPublished = typeof input.published === "boolean" ? input.published : existing.published
  const nextDeleted = typeof input.deleted === "boolean" ? input.deleted : existing.deleted
  db.prepare(
    `INSERT INTO status_line (id, text, published, deleted, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       text = excluded.text,
       published = excluded.published,
       deleted = excluded.deleted,
       updated_at = excluded.updated_at`,
  ).run(nextText, nextPublished ? 1 : 0, nextDeleted ? 1 : 0, now)
  return {
    text: nextText,
    published: nextPublished,
    deleted: nextDeleted,
    updatedAt: now,
  }
}

