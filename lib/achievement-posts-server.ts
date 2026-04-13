import {
  ACHIEVEMENT_POST_CATALOG,
  ACHIEVEMENT_POST_CATALOG_BY_KEY,
  SHARE_USER_TABLE_POST_KEY,
} from "@/lib/achievement-posts-catalog"
import { getDb } from "@/lib/db"

export type AchievementPostTemplateRow = {
  achievementKey: string
  /** Ключ для `achievementStats[statsKeyTitle]` в клиенте — из каталога или задан вручную для custom_* */
  statsKeyTitle: string
  /** Запись только в БД, нет строки в статическом каталоге */
  isCustom?: boolean
  /** Заголовок в интерфейсе */
  title: string
  hint: string
  defaultStatus: string
  group: "base" | "events" | "system"
  imageUrl: string
  postTextTemplate: string
  vkEnabled: boolean
  published: boolean
  updatedAt: number
  /** Цель прогресса (подсказка в админке; может совпадать с игровой логикой) */
  targetCount: number | null
}

type DbRow = {
  achievement_key: string
  title: string
  image_url: string
  post_text_template: string
  vk_enabled: number
  published: number
  updated_at: number
  display_title: string
  hint_custom: string
  default_status_custom: string
  target_count: number | null
}

const MAX_TEMPLATE_LEN = 1200
const MAX_LABEL_LEN = 120
const MAX_HINT_LEN = 400
const MAX_STATUS_LEN = 30
const BRAND_OLD = "SpinDate"
const BRAND_NEW = "Крути и знакомься!"

function normalizeBrandText(value: string): string {
  return value.replaceAll(BRAND_OLD, BRAND_NEW)
}

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
  return normalizeBrandText(raw.trim()).slice(0, MAX_TEMPLATE_LEN)
}

function normalizeOptionalString(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return normalizeBrandText(raw.trim()).slice(0, max)
}

function normalizeTargetCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null
  const n = Math.floor(raw)
  if (n < 0 || n > 999_999_999) return null
  return n
}

const DEFAULT_ACHIEVEMENT_POST_BODY = `Игрок {name} получил достижение «{achievement}» в Крути и знакомься!\n{game_url}`

const DEFAULT_SHARE_USER_TABLE_POST_BODY =
  `{name} создал(а) стол «{table_name}». Заходи в «Крути и знакомься» поиграть вместе!\n{game_url}`

function defaultPostTextTemplateForCatalogKey(key: string): string {
  if (key === SHARE_USER_TABLE_POST_KEY) return DEFAULT_SHARE_USER_TABLE_POST_BODY
  return DEFAULT_ACHIEVEMENT_POST_BODY
}

function parseTargetCount(fromDb: DbRow | undefined): number | null {
  if (!fromDb || !Object.prototype.hasOwnProperty.call(fromDb, "target_count")) return null
  if (fromDb.target_count == null) return null
  return typeof fromDb.target_count === "number" && Number.isFinite(fromDb.target_count)
    ? Math.floor(fromDb.target_count)
    : null
}

function templateRowFromCustomDb(fromDb: DbRow): AchievementPostTemplateRow {
  const dbTextRaw = typeof fromDb.post_text_template === "string" ? fromDb.post_text_template : ""
  const dbTextTrimmed = dbTextRaw.trim()
  const postTextTemplate =
    dbTextTrimmed.length > 0 ? normalizeBrandText(dbTextTrimmed) : DEFAULT_ACHIEVEMENT_POST_BODY

  const statsKeyTitle = (fromDb.title?.trim() ? fromDb.title.trim() : "") || fromDb.achievement_key
  const displayTitle = (fromDb.display_title?.trim() ? fromDb.display_title.trim() : "") || fromDb.achievement_key
  const hint = (fromDb.hint_custom?.trim() ? fromDb.hint_custom.trim() : "") || ""
  const defaultStatus =
    (fromDb.default_status_custom?.trim() ? fromDb.default_status_custom.trim() : "") ||
    displayTitle.slice(0, MAX_STATUS_LEN)

  return {
    achievementKey: fromDb.achievement_key,
    statsKeyTitle: statsKeyTitle.slice(0, MAX_LABEL_LEN),
    title: displayTitle.slice(0, MAX_LABEL_LEN),
    hint: hint.slice(0, MAX_HINT_LEN),
    defaultStatus: defaultStatus.slice(0, MAX_STATUS_LEN),
    group: "events",
    imageUrl: fromDb.image_url ?? "",
    postTextTemplate,
    vkEnabled: fromDb.vk_enabled === 1,
    published: fromDb.published === 1,
    updatedAt: fromDb.updated_at ?? 0,
    targetCount: parseTargetCount(fromDb),
    isCustom: true,
  }
}

export function listAchievementPostTemplates(opts?: { onlyPublished?: boolean }): AchievementPostTemplateRow[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at,
              display_title, hint_custom, default_status_custom, target_count
       FROM achievement_post_templates`,
    )
    .all() as DbRow[]
  const dbMap = new Map(rows.map((r) => [r.achievement_key, r]))
  const mergedCatalog = ACHIEVEMENT_POST_CATALOG.map((item) => {
    const fromDb = dbMap.get(item.key)
    const dbTextRaw = typeof fromDb?.post_text_template === "string" ? fromDb.post_text_template : ""
    const dbTextTrimmed = dbTextRaw.trim()
    const postTextTemplate =
      dbTextTrimmed.length > 0
        ? normalizeBrandText(dbTextTrimmed)
        : defaultPostTextTemplateForCatalogKey(item.key)

    const displayTitle = (fromDb?.display_title?.trim() ? fromDb.display_title.trim() : "") || item.title
    const hint = (fromDb?.hint_custom?.trim() ? fromDb.hint_custom.trim() : "") || item.hint
    const defaultStatus =
      (fromDb?.default_status_custom?.trim() ? fromDb.default_status_custom.trim() : "") || item.defaultStatus

    const row: AchievementPostTemplateRow = {
      achievementKey: item.key,
      statsKeyTitle: item.title,
      title: displayTitle.slice(0, MAX_LABEL_LEN),
      hint: hint.slice(0, MAX_HINT_LEN),
      defaultStatus: defaultStatus.slice(0, MAX_STATUS_LEN),
      group: item.group,
      imageUrl: fromDb?.image_url ?? "",
      postTextTemplate,
      /** Без строки в БД: сторис/посты VK для достижений включены; системный share_user_table — выкл., пока не включат в админке. */
      vkEnabled: fromDb ? fromDb.vk_enabled === 1 : item.group !== "system",
      published: fromDb?.published === 1,
      updatedAt: fromDb?.updated_at ?? 0,
      targetCount: parseTargetCount(fromDb),
    }
    return row
  })

  const catalogKeys = new Set(ACHIEVEMENT_POST_CATALOG.map((x) => x.key))
  const customRows = rows
    .filter((r) => !catalogKeys.has(r.achievement_key))
    .map((r) => templateRowFromCustomDb(r))

  return [...mergedCatalog, ...customRows].filter((r) => (opts?.onlyPublished ? r.published : true))
}

/** Ключи доп. ивентов из админки: `custom_*`, не пересекаются с кодовым каталогом */
const CUSTOM_ACHIEVEMENT_KEY_RE = /^custom_[a-z0-9_]{4,80}$/i

function normalizeCustomAchievementKey(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("invalid_achievement_key")
  const v = raw.trim()
  if (!CUSTOM_ACHIEVEMENT_KEY_RE.test(v)) throw new Error("invalid_achievement_key")
  return v
}

function upsertCatalogAchievementPostTemplate(
  catalogItem: (typeof ACHIEVEMENT_POST_CATALOG)[number],
  input: {
    imageUrl?: unknown
    postTextTemplate?: unknown
    vkEnabled?: unknown
    published?: unknown
    displayTitle?: unknown
    hintCustom?: unknown
    defaultStatusCustom?: unknown
    targetCount?: unknown
  },
): void {
  const db = getDb()
  const existing = db
    .prepare(
      `SELECT achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at,
              display_title, hint_custom, default_status_custom, target_count
       FROM achievement_post_templates WHERE achievement_key = ?`,
    )
    .get(catalogItem.key) as DbRow | undefined

  const imageUrl = normalizeImageUrl(input.imageUrl !== undefined ? input.imageUrl : existing?.image_url ?? "")

  const hasPostTextKey = Object.prototype.hasOwnProperty.call(input, "postTextTemplate")
  const postTextTemplate = hasPostTextKey
    ? normalizeTemplate(input.postTextTemplate)
    : existing?.post_text_template
      ? normalizeTemplate(existing.post_text_template)
      : ""

  const vkEnabled = Object.prototype.hasOwnProperty.call(input, "vkEnabled")
    ? input.vkEnabled === true
      ? 1
      : 0
    : (existing?.vk_enabled ?? 0)
  const published = Object.prototype.hasOwnProperty.call(input, "published")
    ? input.published === true
      ? 1
      : 0
    : (existing?.published ?? 0)

  const displayTitle = Object.prototype.hasOwnProperty.call(input, "displayTitle")
    ? normalizeOptionalString(input.displayTitle, MAX_LABEL_LEN)
    : existing?.display_title ?? ""
  const hintCustom = Object.prototype.hasOwnProperty.call(input, "hintCustom")
    ? normalizeOptionalString(input.hintCustom, MAX_HINT_LEN)
    : existing?.hint_custom ?? ""
  const defaultStatusCustom = Object.prototype.hasOwnProperty.call(input, "defaultStatusCustom")
    ? normalizeOptionalString(input.defaultStatusCustom, MAX_STATUS_LEN)
    : existing?.default_status_custom ?? ""

  let targetCount: number | null
  if (Object.prototype.hasOwnProperty.call(input, "targetCount")) {
    targetCount = normalizeTargetCount(input.targetCount)
  } else {
    targetCount = existing?.target_count ?? null
  }

  const now = Date.now()
  db.prepare(
    `INSERT INTO achievement_post_templates (
      achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at,
      display_title, hint_custom, default_status_custom, target_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(achievement_key) DO UPDATE SET
      title = excluded.title,
      image_url = excluded.image_url,
      post_text_template = excluded.post_text_template,
      vk_enabled = excluded.vk_enabled,
      published = excluded.published,
      updated_at = excluded.updated_at,
      display_title = excluded.display_title,
      hint_custom = excluded.hint_custom,
      default_status_custom = excluded.default_status_custom,
      target_count = excluded.target_count`,
  ).run(
    catalogItem.key,
    catalogItem.title,
    imageUrl,
    postTextTemplate,
    vkEnabled,
    published,
    now,
    displayTitle,
    hintCustom,
    defaultStatusCustom,
    targetCount,
  )
}

function upsertCustomAchievementPostTemplate(input: {
  achievementKey: string
  statsKeyTitle?: unknown
  imageUrl?: unknown
  postTextTemplate?: unknown
  vkEnabled?: unknown
  published?: unknown
  displayTitle?: unknown
  hintCustom?: unknown
  defaultStatusCustom?: unknown
  targetCount?: unknown
}): void {
  const db = getDb()
  const key = normalizeCustomAchievementKey(input.achievementKey)
  if (ACHIEVEMENT_POST_CATALOG_BY_KEY.has(key)) throw new Error("reserved_achievement_key")

  const existing = db
    .prepare(
      `SELECT achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at,
              display_title, hint_custom, default_status_custom, target_count
       FROM achievement_post_templates WHERE achievement_key = ?`,
    )
    .get(key) as DbRow | undefined

  const statsTitle = Object.prototype.hasOwnProperty.call(input, "statsKeyTitle")
    ? normalizeOptionalString(input.statsKeyTitle, MAX_LABEL_LEN)
    : existing?.title ?? ""
  if (!statsTitle.trim()) throw new Error("stats_key_required")

  const imageUrl = normalizeImageUrl(input.imageUrl !== undefined ? input.imageUrl : existing?.image_url ?? "")

  const hasPostTextKey = Object.prototype.hasOwnProperty.call(input, "postTextTemplate")
  const postTextTemplate = hasPostTextKey
    ? normalizeTemplate(input.postTextTemplate)
    : existing?.post_text_template
      ? normalizeTemplate(existing.post_text_template)
      : ""

  const vkEnabled = Object.prototype.hasOwnProperty.call(input, "vkEnabled")
    ? input.vkEnabled === true
      ? 1
      : 0
    : (existing?.vk_enabled ?? 0)
  const published = Object.prototype.hasOwnProperty.call(input, "published")
    ? input.published === true
      ? 1
      : 0
    : (existing?.published ?? 0)

  const displayTitle = Object.prototype.hasOwnProperty.call(input, "displayTitle")
    ? normalizeOptionalString(input.displayTitle, MAX_LABEL_LEN)
    : existing?.display_title ?? ""
  const hintCustom = Object.prototype.hasOwnProperty.call(input, "hintCustom")
    ? normalizeOptionalString(input.hintCustom, MAX_HINT_LEN)
    : existing?.hint_custom ?? ""
  const defaultStatusCustom = Object.prototype.hasOwnProperty.call(input, "defaultStatusCustom")
    ? normalizeOptionalString(input.defaultStatusCustom, MAX_STATUS_LEN)
    : existing?.default_status_custom ?? ""

  let targetCount: number | null
  if (Object.prototype.hasOwnProperty.call(input, "targetCount")) {
    targetCount = normalizeTargetCount(input.targetCount)
  } else {
    targetCount = existing?.target_count ?? null
  }

  const now = Date.now()
  db.prepare(
    `INSERT INTO achievement_post_templates (
      achievement_key, title, image_url, post_text_template, vk_enabled, published, updated_at,
      display_title, hint_custom, default_status_custom, target_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(achievement_key) DO UPDATE SET
      title = excluded.title,
      image_url = excluded.image_url,
      post_text_template = excluded.post_text_template,
      vk_enabled = excluded.vk_enabled,
      published = excluded.published,
      updated_at = excluded.updated_at,
      display_title = excluded.display_title,
      hint_custom = excluded.hint_custom,
      default_status_custom = excluded.default_status_custom,
      target_count = excluded.target_count`,
  ).run(
    key,
    statsTitle.trim(),
    imageUrl,
    postTextTemplate,
    vkEnabled,
    published,
    now,
    displayTitle,
    hintCustom,
    defaultStatusCustom,
    targetCount,
  )
}

export function upsertAchievementPostTemplate(input: {
  achievementKey: string
  imageUrl?: unknown
  postTextTemplate?: unknown
  vkEnabled?: unknown
  published?: unknown
  displayTitle?: unknown
  hintCustom?: unknown
  defaultStatusCustom?: unknown
  targetCount?: unknown
  statsKeyTitle?: unknown
}): void {
  const catalogItem = ACHIEVEMENT_POST_CATALOG.find((x) => x.key === input.achievementKey)
  if (catalogItem) {
    upsertCatalogAchievementPostTemplate(catalogItem, {
      imageUrl: input.imageUrl,
      postTextTemplate: input.postTextTemplate,
      vkEnabled: input.vkEnabled,
      published: input.published,
      displayTitle: input.displayTitle,
      hintCustom: input.hintCustom,
      defaultStatusCustom: input.defaultStatusCustom,
      targetCount: input.targetCount,
    })
    return
  }
  upsertCustomAchievementPostTemplate(input)
}

export function createCustomAchievementPostTemplate(input: {
  achievementKey?: unknown
  statsKeyTitle?: unknown
  imageUrl?: unknown
  postTextTemplate?: unknown
  vkEnabled?: unknown
  published?: unknown
  displayTitle?: unknown
  hintCustom?: unknown
  defaultStatusCustom?: unknown
  targetCount?: unknown
}): string {
  const db = getDb()
  const rawKey =
    typeof input.achievementKey === "string" && input.achievementKey.trim()
      ? input.achievementKey.trim()
      : `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
  const key = normalizeCustomAchievementKey(rawKey)
  if (ACHIEVEMENT_POST_CATALOG_BY_KEY.has(key)) throw new Error("reserved_achievement_key")

  const exists = db.prepare(`SELECT 1 FROM achievement_post_templates WHERE achievement_key = ?`).get(key) as
    | { 1: number }
    | undefined
  if (exists) throw new Error("achievement_key_exists")

  upsertCustomAchievementPostTemplate({
    achievementKey: key,
    statsKeyTitle: input.statsKeyTitle,
    imageUrl: input.imageUrl,
    postTextTemplate: input.postTextTemplate,
    vkEnabled: input.vkEnabled,
    published: input.published,
    displayTitle: input.displayTitle,
    hintCustom: input.hintCustom,
    defaultStatusCustom: input.defaultStatusCustom,
    targetCount: input.targetCount,
  })
  return key
}

export function deleteAchievementPostTemplate(achievementKey: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM achievement_post_templates WHERE achievement_key = ?`).run(achievementKey)
}
