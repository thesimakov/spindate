import { getDb } from "@/lib/db"
import { TICKER_AD_TIERS, type TickerAdTierId } from "@/lib/ticker-player-ads-constants"

export { TICKER_AD_TIERS }
export type { TickerAdTierId }

export type TickerPlayerAdStatus =
  | "pending_moderation"
  | "scheduled"
  | "rejected"
  | "deleted"
  | "expired"

export type TickerPlayerAdRow = {
  id: number
  ownerUserId: string | null
  ownerVkUserId: number | null
  authorDisplayName: string
  body: string
  linkUrl: string
  durationMs: number
  costHearts: number
  status: TickerPlayerAdStatus
  paidAt: number
  queueStartMs: number | null
  queueEndMs: number | null
  createdAt: number
  updatedAt: number
  rejectReason: string | null
}

const MAX_BODY_LEN = 400
const MAX_DISPLAY_NAME = 80

export function normalizeTickerAdLink(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: "Укажите ссылку" }
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return { ok: false, error: "Некорректная ссылка" }
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, error: "Разрешены только http(s)-ссылки" }
  }
  const host = u.hostname.toLowerCase()
  const allowed =
    host === "vk.com" ||
    host === "www.vk.com" ||
    host === "m.vk.com" ||
    host === "vk.ru" ||
    host === "www.vk.ru" ||
    host === "m.vk.ru"
  if (!allowed) {
    return { ok: false, error: "Ссылка только на vk.com или vk.ru" }
  }
  if (u.protocol === "http:") {
    u.protocol = "https:"
  }
  return { ok: true, url: u.toString() }
}

export function parseTier(tier: unknown): { duration_ms: number; cost_hearts: number } | null {
  if (typeof tier !== "string") return null
  const id = tier as TickerAdTierId
  return TICKER_AD_TIERS[id] ?? null
}

function mapRow(r: Record<string, unknown>): TickerPlayerAdRow {
  return {
    id: Number(r.id),
    ownerUserId: r.owner_user_id != null ? String(r.owner_user_id) : null,
    ownerVkUserId:
      r.owner_vk_user_id != null && r.owner_vk_user_id !== ""
        ? Number(r.owner_vk_user_id)
        : null,
    authorDisplayName: String(r.author_display_name ?? ""),
    body: String(r.body ?? ""),
    linkUrl: String(r.link_url ?? ""),
    durationMs: Number(r.duration_ms) || 0,
    costHearts: Number(r.cost_hearts) || 0,
    status: r.status as TickerPlayerAdStatus,
    paidAt: Number(r.paid_at) || 0,
    queueStartMs: r.queue_start_ms != null ? Number(r.queue_start_ms) : null,
    queueEndMs: r.queue_end_ms != null ? Number(r.queue_end_ms) : null,
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
    rejectReason: r.reject_reason != null ? String(r.reject_reason) : null,
  }
}

export function createTickerPlayerAdOrder(input: {
  userId: string | null
  vkUserId: number | null
  authorDisplayName: string
  body: string
  linkUrl: string
  durationMs: number
  costHearts: number
}):
  | { ok: true; id: number; newBalance: number }
  | { ok: false; error: string; code?: string } {
  const name = input.authorDisplayName.trim().slice(0, MAX_DISPLAY_NAME)
  const body = input.body.trim().slice(0, MAX_BODY_LEN)
  if (!name) return { ok: false, error: "Укажите отображаемое имя" }
  if (!body) return { ok: false, error: "Введите текст объявления" }
  if (!input.userId && input.vkUserId == null) {
    return { ok: false, error: "Не авторизован", code: "unauthorized" }
  }

  const db = getDb()
  const now = Date.now()

  const tx = db.transaction(() => {
    let balance = 0
    if (input.userId) {
      const row = db
        .prepare(`SELECT voice_balance FROM user_game_state WHERE user_id = ?`)
        .get(input.userId) as { voice_balance: number } | undefined
      balance = row?.voice_balance ?? 0
      if (balance < input.costHearts) {
        throw new Error("INSUFFICIENT_BALANCE")
      }
      const next = balance - input.costHearts
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, '[]', ?)
         ON CONFLICT(user_id) DO UPDATE SET voice_balance = excluded.voice_balance, updated_at = excluded.updated_at`,
      ).run(input.userId, next, now)
      balance = next
    } else if (input.vkUserId != null) {
      const row = db
        .prepare(`SELECT voice_balance FROM vk_user_game_state WHERE vk_user_id = ?`)
        .get(input.vkUserId) as { voice_balance: number } | undefined
      balance = row?.voice_balance ?? 0
      if (balance < input.costHearts) {
        throw new Error("INSUFFICIENT_BALANCE")
      }
      const next = balance - input.costHearts
      db.prepare(
        `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, '[]', ?)
         ON CONFLICT(vk_user_id) DO UPDATE SET voice_balance = excluded.voice_balance, updated_at = excluded.updated_at`,
      ).run(input.vkUserId, next, now)
      balance = next
    }

    const info = db
      .prepare(
        `INSERT INTO ticker_player_ads (
           owner_user_id, owner_vk_user_id, author_display_name, body, link_url,
           duration_ms, cost_hearts, status, paid_at, queue_start_ms, queue_end_ms,
           created_at, updated_at, reject_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_moderation', ?, NULL, NULL, ?, ?, NULL)`,
      )
      .run(
        input.userId,
        input.vkUserId,
        name,
        body,
        input.linkUrl,
        input.durationMs,
        input.costHearts,
        now,
        now,
        now,
      )
    return { id: Number(info.lastInsertRowid), newBalance: balance }
  })

  try {
    const r = tx()
    return { ok: true, id: r.id, newBalance: r.newBalance }
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") {
      return { ok: false, error: "Недостаточно сердец", code: "insufficient" }
    }
    throw e
  }
}

export function schedulePublishedTickerAd(id: number): { ok: true } | { ok: false; error: string } {
  const db = getDb()
  const now = Date.now()
  const pending = db.prepare(`SELECT id, status, duration_ms FROM ticker_player_ads WHERE id = ?`).get(id) as
    | { id: number; status: string; duration_ms: number }
    | undefined
  if (!pending) return { ok: false, error: "Не найдено" }
  if (pending.status !== "pending_moderation") {
    return { ok: false, error: "Можно опубликовать только объявление на модерации" }
  }

  const newDuration = Number(pending.duration_ms) || 0
  if (newDuration <= 0) return { ok: false, error: "Некорректная длительность" }

  try {
    const run = db.transaction(() => {
      const newStart = now
      const newEnd = now + newDuration

      const scheduledRows = db
        .prepare(
          `SELECT id, queue_start_ms, queue_end_ms, duration_ms FROM ticker_player_ads
           WHERE status = 'scheduled'
             AND queue_start_ms IS NOT NULL AND queue_end_ms IS NOT NULL
             AND queue_end_ms > ?
           ORDER BY queue_start_ms ASC, id ASC`,
        )
        .all(now) as Array<{
        id: number
        queue_start_ms: number
        queue_end_ms: number
        duration_ms: number
      }>

      let activeIdx = -1
      for (let i = 0; i < scheduledRows.length; i++) {
        const s = scheduledRows[i]
        const qs = Number(s.queue_start_ms)
        const qe = Number(s.queue_end_ms)
        if (qs <= now && now < qe) {
          activeIdx = i
          break
        }
      }

      let cursor = newEnd
      const shiftRow = db.prepare(
        `UPDATE ticker_player_ads
         SET queue_start_ms = ?, queue_end_ms = ?, updated_at = ?
         WHERE id = ? AND status = 'scheduled'`,
      )

      if (activeIdx >= 0) {
        const A = scheduledRows[activeIdx]
        const remaining = Number(A.queue_end_ms) - now
        if (remaining > 0) {
          shiftRow.run(cursor, cursor + remaining, now, A.id)
          cursor += remaining
        }
        for (let j = activeIdx + 1; j < scheduledRows.length; j++) {
          const B = scheduledRows[j]
          const d = Number(B.duration_ms) || 0
          if (d <= 0) continue
          shiftRow.run(cursor, cursor + d, now, B.id)
          cursor += d
        }
      } else {
        for (const B of scheduledRows) {
          const d = Number(B.duration_ms) || 0
          if (d <= 0) continue
          shiftRow.run(cursor, cursor + d, now, B.id)
          cursor += d
        }
      }

      const published = db
        .prepare(
          `UPDATE ticker_player_ads
           SET status = 'scheduled', queue_start_ms = ?, queue_end_ms = ?, updated_at = ?
           WHERE id = ? AND status = 'pending_moderation'`,
        )
        .run(newStart, newEnd, now, id)
      if (published.changes === 0) throw new Error("PUBLISH_CONFLICT")
    })
    run()
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.message === "PUBLISH_CONFLICT") {
      return { ok: false, error: "Не удалось опубликовать" }
    }
    throw e
  }
}

export type TickerPlayerQueueItem = {
  id: number
  text: string
  linkUrl: string
  queueStartMs: number
  queueEndMs: number
}

/** Оставшиеся слоты в очереди (конец ещё не наступил); для клиентского тика по времени. */
export function getTickerPlayerAdQueueSnapshot(now: number): TickerPlayerQueueItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, body, link_url, queue_start_ms, queue_end_ms FROM ticker_player_ads
       WHERE status = 'scheduled'
         AND queue_start_ms IS NOT NULL AND queue_end_ms IS NOT NULL
         AND queue_end_ms > ?
       ORDER BY queue_start_ms ASC, id ASC`,
    )
    .all(now) as Array<{
    id: number
    body: string
    link_url: string
    queue_start_ms: number
    queue_end_ms: number
  }>

  const out: TickerPlayerQueueItem[] = []
  for (const r of rows) {
    const text = String(r.body ?? "").trim()
    if (!text) continue
    out.push({
      id: Number(r.id),
      text,
      linkUrl: String(r.link_url ?? ""),
      queueStartMs: Number(r.queue_start_ms),
      queueEndMs: Number(r.queue_end_ms),
    })
  }
  return out
}

export function pickActiveTickerPlayerFromQueue(
  queue: TickerPlayerQueueItem[],
  t: number,
): TickerPlayerQueueItem | null {
  for (const item of queue) {
    if (item.queueStartMs <= t && t < item.queueEndMs) return item
  }
  return null
}

export function getCurrentTickerPlayerAd(now: number): { id: number; text: string; linkUrl: string } | null {
  const queue = getTickerPlayerAdQueueSnapshot(now)
  const active = pickActiveTickerPlayerFromQueue(queue, now)
  if (!active) return null
  return { id: active.id, text: active.text, linkUrl: active.linkUrl }
}

export function listTickerPlayerAdsForAdmin(): TickerPlayerAdRow[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT * FROM ticker_player_ads
       WHERE status != 'deleted'
       ORDER BY created_at DESC`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(mapRow)
}

export function softDeleteTickerPlayerAd(id: number): { ok: boolean } {
  const db = getDb()
  const now = Date.now()
  const r = db
    .prepare(`UPDATE ticker_player_ads SET status = 'deleted', updated_at = ? WHERE id = ? AND status != 'deleted'`)
    .run(now, id)
  return { ok: r.changes > 0 }
}

export function rejectTickerPlayerAd(id: number, reason: string | null): { ok: boolean } {
  const db = getDb()
  const now = Date.now()
  const trimmed = reason?.trim().slice(0, 500) ?? ""
  const r = db
    .prepare(
      `UPDATE ticker_player_ads
       SET status = 'rejected', reject_reason = ?, updated_at = ?
       WHERE id = ? AND status = 'pending_moderation'`,
    )
    .run(trimmed || null, now, id)
  return { ok: r.changes > 0 }
}
