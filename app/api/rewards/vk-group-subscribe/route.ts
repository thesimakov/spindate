import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"
import { vkGroupsIsMember } from "@/lib/vk-groups-server"
import { parseVisualPrefsJson } from "@/lib/user-visual-prefs"
import { VK_GROUP_SUBSCRIBE_BONUS_HEARTS } from "@/lib/vk-group-subscribe-constants"

const COMMUNITY_GROUP_ID = 236519647
const BONUS_HEARTS = VK_GROUP_SUBSCRIBE_BONUS_HEARTS
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

function parseInventoryJson(raw: string | undefined): unknown[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as unknown
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401, headers: NO_CACHE })
  }

  if (auth.okUserId != null) {
    return NextResponse.json(
      { ok: false, error: "Бонус доступен только аккаунтам ВКонтакте" },
      { status: 400, headers: NO_CACHE },
    )
  }

  let vkUserId: number | null = auth.vkUserId
  const db = getDb()

  if (vkUserId == null && auth.userId) {
    const row = db
      .prepare(`SELECT vk_user_id FROM users WHERE id = ?`)
      .get(auth.userId) as { vk_user_id: number | null } | undefined
    const v = row?.vk_user_id
    if (typeof v === "number" && Number.isInteger(v) && v > 0) vkUserId = v
  }

  if (vkUserId == null) {
    return NextResponse.json(
      { ok: false, error: "Бонус доступен только аккаунтам ВКонтакте" },
      { status: 400, headers: NO_CACHE },
    )
  }

  const memberCheck = await vkGroupsIsMember({ groupId: COMMUNITY_GROUP_ID, userId: vkUserId })
  if (!memberCheck.ok) {
    if (memberCheck.reason === "missing_service_token") {
      return NextResponse.json(
        { ok: false, error: "Сервер не настроен для проверки подписки", reason: memberCheck.reason },
        { status: 503, headers: NO_CACHE },
      )
    }
    return NextResponse.json(
      { ok: false, error: "Не удалось проверить подписку", reason: memberCheck.reason },
      { status: 502, headers: NO_CACHE },
    )
  }

  if (!memberCheck.member) {
    return NextResponse.json(
      {
        ok: false,
        isMember: false,
        error: "Вы ещё не подписаны на сообщество",
      },
      { headers: NO_CACHE },
    )
  }

  const now = Date.now()

  const userPayload = (userId: string) => {
    const r = db
      .prepare(
        `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM user_game_state WHERE user_id = ?`,
      )
      .get(userId) as
      | { voice_balance: number; inventory_json: string; visual_prefs_json: string }
      | undefined
    return {
      voiceBalance: r?.voice_balance ?? 0,
      inventory: parseInventoryJson(r?.inventory_json),
      visualPrefs: parseVisualPrefsJson(r?.visual_prefs_json) ?? {},
    }
  }

  const vkPayload = (vkId: number) => {
    const r = db
      .prepare(
        `SELECT voice_balance, inventory_json, COALESCE(visual_prefs_json, '{}') AS visual_prefs_json FROM vk_user_game_state WHERE vk_user_id = ?`,
      )
      .get(vkId) as
      | { voice_balance: number; inventory_json: string; visual_prefs_json: string }
      | undefined
    return {
      voiceBalance: r?.voice_balance ?? 0,
      inventory: parseInventoryJson(r?.inventory_json),
      visualPrefs: parseVisualPrefsJson(r?.visual_prefs_json) ?? {},
    }
  }

  if (auth.userId) {
    const row = db
      .prepare(
        `SELECT voice_balance, vk_group_bonus_claimed FROM user_game_state WHERE user_id = ?`,
      )
      .get(auth.userId) as { voice_balance: number; vk_group_bonus_claimed: number } | undefined

    if (row && row.vk_group_bonus_claimed) {
      return NextResponse.json(
        {
          ok: true,
          alreadyClaimed: true,
          isMember: true,
          ...userPayload(auth.userId),
        },
        { headers: NO_CACHE },
      )
    }

    if (!row) {
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at, vk_group_bonus_claimed)
         VALUES (?, ?, '[]', ?, 1)`,
      ).run(auth.userId, BONUS_HEARTS, now)
      return NextResponse.json(
        {
          ok: true,
          isMember: true,
          granted: true,
          ...userPayload(auth.userId),
        },
        { headers: NO_CACHE },
      )
    }

    const balance = (row.voice_balance ?? 0) + BONUS_HEARTS
    db.prepare(
      `UPDATE user_game_state
       SET voice_balance = ?, vk_group_bonus_claimed = 1, updated_at = ?
       WHERE user_id = ?`,
    ).run(balance, now, auth.userId)

    return NextResponse.json(
      { ok: true, isMember: true, granted: true, ...userPayload(auth.userId) },
      { headers: NO_CACHE },
    )
  }

  const rowVk = db
    .prepare(`SELECT voice_balance, vk_group_bonus_claimed FROM vk_user_game_state WHERE vk_user_id = ?`)
    .get(vkUserId) as { voice_balance: number; vk_group_bonus_claimed: number } | undefined

  if (rowVk && rowVk.vk_group_bonus_claimed) {
    return NextResponse.json(
      {
        ok: true,
        alreadyClaimed: true,
        isMember: true,
        ...vkPayload(vkUserId),
      },
      { headers: NO_CACHE },
    )
  }

  if (!rowVk) {
    db.prepare(
      `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at, vk_group_bonus_claimed)
       VALUES (?, ?, '[]', ?, 1)`,
    ).run(vkUserId, BONUS_HEARTS, now)
    return NextResponse.json(
      {
        ok: true,
        isMember: true,
        granted: true,
        ...vkPayload(vkUserId),
      },
      { headers: NO_CACHE },
    )
  }

  const balanceVk = (rowVk.voice_balance ?? 0) + BONUS_HEARTS
  db.prepare(
    `UPDATE vk_user_game_state
     SET voice_balance = ?, vk_group_bonus_claimed = 1, updated_at = ?
     WHERE vk_user_id = ?`,
  ).run(balanceVk, now, vkUserId)

  return NextResponse.json(
    { ok: true, isMember: true, granted: true, ...vkPayload(vkUserId) },
    { headers: NO_CACHE },
  )
}
