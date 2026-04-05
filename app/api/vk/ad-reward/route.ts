import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getSessionTokenFromRequest, sha256Base64 } from "@/lib/auth/session"

function getUserIdFromSession(req: Request): string | null {
  const token = getSessionTokenFromRequest(req)
  if (!token) return null
  const db = getDb()
  const tokenHash = sha256Base64(token)
  const now = Date.now()
  const row = db
    .prepare(`SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?`)
    .get(tokenHash, now) as { user_id: string } | undefined
  return row?.user_id ?? null
}

function getVkUserIdFromRequest(req: Request): number | null {
  const url = new URL(req.url)
  const raw = url.searchParams.get("vk_user_id")
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function utcDayKey(now: number): number {
  const d = new Date(now)
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function parseEnvInt(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}

/**
 * Начисление сердец за «видео с наградой» в VK: только сервер, с кулдауном и дневным лимитом (UTC).
 * Тело запроса не нужно; идентификация как у GET/PUT /api/user/state (сессия или vk_user_id).
 */
export async function POST(req: Request) {
  const userId = getUserIdFromSession(req)
  const vkUserId = userId ? null : getVkUserIdFromRequest(req)
  if (!userId && vkUserId == null) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const amount = parseEnvInt("VK_AD_REWARD_HEARTS", 5)
  const cooldownMs = parseEnvInt("VK_AD_REWARD_COOLDOWN_MS", 120_000)
  const maxPerUtcDay = parseEnvInt("VK_AD_REWARD_MAX_PER_UTCDAY", 60)

  const subjectKey = userId ? `u:${userId}` : `v:${vkUserId}`

  const db = getDb()
  const now = Date.now()
  const utcDay = utcDayKey(now)

  type TxResult =
    | { ok: true; voiceBalance: number; inventory: unknown[] }
    | { ok: false; code: "cooldown"; retryAfterMs: number }
    | { ok: false; code: "daily_cap" }

  const work = db.transaction((): TxResult => {
    const row = db
      .prepare(
        `SELECT last_claim_at, utc_day, claims_today FROM vk_ad_reward_claims WHERE subject_key = ?`,
      )
      .get(subjectKey) as
      | { last_claim_at: number; utc_day: number; claims_today: number }
      | undefined

    if (row && now - row.last_claim_at < cooldownMs) {
      return {
        ok: false,
        code: "cooldown",
        retryAfterMs: cooldownMs - (now - row.last_claim_at),
      }
    }

    let nextClaimsToday = 1
    if (row && row.utc_day === utcDay) {
      nextClaimsToday = row.claims_today + 1
    }

    if (nextClaimsToday > maxPerUtcDay) {
      return { ok: false, code: "daily_cap" }
    }

    if (userId) {
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, '[]', ?)
         ON CONFLICT(user_id) DO UPDATE SET
           voice_balance = user_game_state.voice_balance + excluded.voice_balance,
           updated_at = excluded.updated_at`,
      ).run(userId, amount, now)
    } else {
      db.prepare(
        `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at)
         VALUES (?, ?, '[]', ?)
         ON CONFLICT(vk_user_id) DO UPDATE SET
           voice_balance = vk_user_game_state.voice_balance + excluded.voice_balance,
           updated_at = excluded.updated_at`,
      ).run(vkUserId, amount, now)
    }

    db.prepare(
      `INSERT INTO vk_ad_reward_claims (subject_key, last_claim_at, utc_day, claims_today)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(subject_key) DO UPDATE SET
         last_claim_at = excluded.last_claim_at,
         utc_day = excluded.utc_day,
         claims_today = CASE
           WHEN vk_ad_reward_claims.utc_day = excluded.utc_day THEN vk_ad_reward_claims.claims_today + 1
           ELSE 1
         END`,
    ).run(subjectKey, now, utcDay, nextClaimsToday)

    const gameRow = userId
      ? (db
          .prepare(`SELECT voice_balance, inventory_json FROM user_game_state WHERE user_id = ?`)
          .get(userId) as { voice_balance: number; inventory_json: string } | undefined)
      : (db
          .prepare(`SELECT voice_balance, inventory_json FROM vk_user_game_state WHERE vk_user_id = ?`)
          .get(vkUserId) as { voice_balance: number; inventory_json: string } | undefined)

    const voiceBalance = gameRow?.voice_balance ?? 0
    let inventory: unknown[] = []
    if (gameRow?.inventory_json) {
      try {
        inventory = JSON.parse(gameRow.inventory_json) as unknown[]
      } catch {
        inventory = []
      }
    }
    return { ok: true, voiceBalance, inventory }
  })

  const out = work()
  if (!out.ok) {
    if (out.code === "cooldown") {
      const sec = Math.max(1, Math.ceil(out.retryAfterMs / 1000))
      return NextResponse.json(
        {
          ok: false,
          error: `Подождите ещё ${sec} с`,
          code: out.code,
          retryAfterMs: Math.max(0, Math.ceil(out.retryAfterMs)),
        },
        { status: 429, headers: { "Retry-After": String(sec) } },
      )
    }
    return NextResponse.json(
      { ok: false, error: "На сегодня лимит наград за рекламу исчерпан", code: out.code },
      { status: 429 },
    )
  }

  return NextResponse.json({
    ok: true,
    voiceBalance: out.voiceBalance,
    inventory: out.inventory,
    granted: amount,
  })
}
