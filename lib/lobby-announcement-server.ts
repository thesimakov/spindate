import { getDb } from "@/lib/db"

export type LobbyAnnouncementRow = {
  title: string
  body: string
  buttonLabel: string
  imageUrl: string
  published: boolean
  deleted: boolean
  updatedAt: number
}

type LobbyAnnouncementDbRow = {
  title: string
  body: string
  button_label: string
  image_url: string
  published: number
  deleted: number
  updated_at: number
}

function rowFromDb(row: LobbyAnnouncementDbRow): LobbyAnnouncementRow {
  return {
    title: typeof row.title === "string" ? row.title.trim() : "",
    body: typeof row.body === "string" ? row.body.trim() : "",
    buttonLabel: typeof row.button_label === "string" ? row.button_label.trim() : "",
    imageUrl: typeof row.image_url === "string" ? row.image_url.trim() : "",
    published: row.published === 1,
    deleted: row.deleted === 1,
    updatedAt: Number(row.updated_at) || 0,
  }
}

/** Публичная выдача: только опубликовано, не удалено, все обязательные поля заполнены. */
export function isLobbyAnnouncementContentValid(r: LobbyAnnouncementRow): boolean {
  return r.title.length > 0 && r.body.length > 0 && r.buttonLabel.length > 0
}

export function getLobbyAnnouncement(options?: { onlyPublished?: boolean }): LobbyAnnouncementRow | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT title, body, button_label, image_url, published, deleted, updated_at
       FROM lobby_announcement WHERE id = 1 LIMIT 1`,
    )
    .get() as LobbyAnnouncementDbRow | undefined
  if (!row) return null
  const parsed = rowFromDb(row)
  if (options?.onlyPublished) {
    if (!parsed.published || parsed.deleted || !isLobbyAnnouncementContentValid(parsed)) {
      return null
    }
  }
  return parsed
}

export function updateLobbyAnnouncement(input: {
  title?: string
  body?: string
  buttonLabel?: string
  imageUrl?: string
  published?: boolean
  deleted?: boolean
}): LobbyAnnouncementRow {
  const db = getDb()
  const now = Date.now()
  const existing =
    getLobbyAnnouncement() ??
    ({
      title: "",
      body: "",
      buttonLabel: "",
      imageUrl: "",
      published: false,
      deleted: false,
      updatedAt: now,
    } satisfies LobbyAnnouncementRow)

  const nextTitle = typeof input.title === "string" ? input.title.trim() : existing.title
  const nextBody = typeof input.body === "string" ? input.body.trim() : existing.body
  const nextButton =
    typeof input.buttonLabel === "string" ? input.buttonLabel.trim() : existing.buttonLabel
  const nextImage = typeof input.imageUrl === "string" ? input.imageUrl.trim() : existing.imageUrl
  const nextPublished = typeof input.published === "boolean" ? input.published : existing.published
  const nextDeleted = typeof input.deleted === "boolean" ? input.deleted : existing.deleted

  db.prepare(
    `INSERT INTO lobby_announcement (id, title, body, button_label, image_url, published, deleted, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       body = excluded.body,
       button_label = excluded.button_label,
       image_url = excluded.image_url,
       published = excluded.published,
       deleted = excluded.deleted,
       updated_at = excluded.updated_at`,
  ).run(
    nextTitle,
    nextBody,
    nextButton,
    nextImage,
    nextPublished ? 1 : 0,
    nextDeleted ? 1 : 0,
    now,
  )

  return {
    title: nextTitle,
    body: nextBody,
    buttonLabel: nextButton,
    imageUrl: nextImage,
    published: nextPublished,
    deleted: nextDeleted,
    updatedAt: now,
  }
}
