import { ACHIEVEMENT_POST_CATALOG } from "@/lib/achievement-posts-catalog"
import { getDb } from "@/lib/db"

export type AchievementPostTemplateRow = {
  achievementKey: string
  title: string
  hint: string
  defaultStatus: string
  group: "base" | "events"
  imageUrl: string
  postTextTemplate: string
  vkEnabled: boolean
  published: boolean
  updatedAt: number
}

type DbRow = {
  achievement_key: string
  title: string
  image_url: string
  post_text_template: string
  vk_enabled: number
  published: number
  updated_at: number
}

const MAX_TEMPLATE_LEN = 1200

function normalizeImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return ""
  const v = raw.trim()
  if (!v) return ""
  if (v.startsWith("/")) return v.slice(0, 500)
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v.slice(0, 500)
  throw new Error("invalid_image_url")
}

function normalizeTemplate(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, MAX_TEMPLATE_LEN)
}

export function listAchievementPostTemplates(opts?: { onlyPublished?: boolean }): AchievementPostTemplateRow[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at
       FROM achievement_post_templates`,
    )
    .all() as DbRow[]
  const dbMap = new Map(rows.map((r) => [r.achievement_key, r]))
  return ACHIEVEMENT_POST_CATALOG
    .map((item) => {
      const fromDb = dbMap.get(item.key)
      const row: AchievementPostTemplateRow = {
        achievementKey: item.key,
        title: item.title,
        hint: item.hint,
        defaultStatus: item.defaultStatus,
        group: item.group,
        imageUrl: fromDb?.image_url ?? "",
        postTextTemplate:
          fromDb?.post_text_template?.trim() ||
          `Игрок {name} получил достижение «{achievement}» в SpinDate!\n${"{game_url}"}`,
        vkEnabled: fromDb?.vk_enabled === 1,
        published: fromDb?.published === 1,
        updatedAt: fromDb?.updated_at ?? 0,
      }
      return row
    })
    .filter((r) => (opts?.onlyPublished ? r.published : true))
}

export function upsertAchievementPostTemplate(input: {
  achievementKey: string
  imageUrl?: unknown
  postTextTemplate?: unknown
  vkEnabled?: unknown
  published?: unknown
}): void {
  const db = getDb()
  const catalogItem = ACHIEVEMENT_POST_CATALOG.find((x) => x.key === input.achievementKey)
  if (!catalogItem) throw new Error("unknown_achievement_key")
  const imageUrl = normalizeImageUrl(input.imageUrl)
  const postTextTemplate = normalizeTemplate(input.postTextTemplate)
  const vkEnabled = input.vkEnabled === true ? 1 : 0
  const published = input.published === true ? 1 : 0
  const now = Date.now()
  db.prepare(
    `INSERT INTO achievement_post_templates (
      achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(achievement_key) DO UPDATE SET
      title = excluded.title,
      image_url = excluded.image_url,
      post_text_template = excluded.post_text_template,
      vk_enabled = excluded.vk_enabled,
      published = excluded.published,
      updated_at = excluded.updated_at`,
  ).run(
    catalogItem.key,
    catalogItem.title,
    imageUrl,
    postTextTemplate,
    vkEnabled,
    published,
    now,
  )
}

export function deleteAchievementPostTemplate(achievementKey: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM achievement_post_templates WHERE achievement_key = ?`).run(achievementKey)
}
