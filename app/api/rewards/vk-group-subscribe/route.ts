import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"
import { vkGroupsIsMember } from "@/lib/vk-groups-server"

const COMMUNITY_GROUP_ID = 236519647
const BONUS_HEARTS = 30

export async function POST(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  // #region agent log
  void fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ec43d5" },
    body: JSON.stringify({
      sessionId: "ec43d5",
      runId: "subscribe-debug-1",
      hypothesisId: "H1",
      location: "app/api/rewards/vk-group-subscribe/route.ts:11",
      message: "reward route auth parsed",
      data: {
        hasAuth: !!auth,
        userId: auth?.userId ?? null,
        vkUserId: auth?.vkUserId ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
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
      { status: 400 },
    )
  }

  const memberCheck = await vkGroupsIsMember({ groupId: COMMUNITY_GROUP_ID, userId: vkUserId })
  // #region agent log
  void fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ec43d5" },
    body: JSON.stringify({
      sessionId: "ec43d5",
      runId: "subscribe-debug-1",
      hypothesisId: "H2",
      location: "app/api/rewards/vk-group-subscribe/route.ts:35",
      message: "vk group membership check result",
      data: {
        ok: memberCheck.ok,
        member: memberCheck.member ?? null,
        reason: memberCheck.reason ?? null,
        vkUserId,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  if (!memberCheck.ok) {
    if (memberCheck.reason === "missing_service_token") {
      return NextResponse.json(
        { ok: false, error: "Сервер не настроен для проверки подписки", reason: memberCheck.reason },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { ok: false, error: "Не удалось проверить подписку", reason: memberCheck.reason },
      { status: 502 },
    )
  }

  if (!memberCheck.member) {
    return NextResponse.json({
      ok: false,
      isMember: false,
      error: "Вы ещё не подписаны на сообщество",
    })
  }

  const now = Date.now()

  if (auth.userId) {
    const row = db
      .prepare(
        `SELECT voice_balance, vk_group_bonus_claimed FROM user_game_state WHERE user_id = ?`,
      )
      .get(auth.userId) as { voice_balance: number; vk_group_bonus_claimed: number } | undefined

    if (row && row.vk_group_bonus_claimed) {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        voiceBalance: row.voice_balance ?? 0,
        isMember: true,
      })
    }

    if (!row) {
      db.prepare(
        `INSERT INTO user_game_state (user_id, voice_balance, inventory_json, updated_at, vk_group_bonus_claimed)
         VALUES (?, ?, '[]', ?, 1)`,
      ).run(auth.userId, BONUS_HEARTS, now)
      return NextResponse.json({
        ok: true,
        voiceBalance: BONUS_HEARTS,
        isMember: true,
        granted: true,
      })
    }

    const balance = (row.voice_balance ?? 0) + BONUS_HEARTS
    db.prepare(
      `UPDATE user_game_state
       SET voice_balance = ?, vk_group_bonus_claimed = 1, updated_at = ?
       WHERE user_id = ?`,
    ).run(balance, now, auth.userId)
    // #region agent log
    void fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ec43d5" },
      body: JSON.stringify({
        sessionId: "ec43d5",
        runId: "subscribe-debug-1",
        hypothesisId: "H3",
        location: "app/api/rewards/vk-group-subscribe/route.ts:97",
        message: "reward granted for user_game_state",
        data: { userId: auth.userId, balance, granted: true },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return NextResponse.json({ ok: true, voiceBalance: balance, isMember: true, granted: true })
  }

  const rowVk = db
    .prepare(`SELECT voice_balance, vk_group_bonus_claimed FROM vk_user_game_state WHERE vk_user_id = ?`)
    .get(vkUserId) as { voice_balance: number; vk_group_bonus_claimed: number } | undefined

  if (rowVk && rowVk.vk_group_bonus_claimed) {
    return NextResponse.json({
      ok: true,
      alreadyClaimed: true,
      voiceBalance: rowVk.voice_balance ?? 0,
      isMember: true,
    })
  }

  if (!rowVk) {
    db.prepare(
      `INSERT INTO vk_user_game_state (vk_user_id, voice_balance, inventory_json, updated_at, vk_group_bonus_claimed)
       VALUES (?, ?, '[]', ?, 1)`,
    ).run(vkUserId, BONUS_HEARTS, now)
    return NextResponse.json({
      ok: true,
      voiceBalance: BONUS_HEARTS,
      isMember: true,
      granted: true,
    })
  }

  const balanceVk = (rowVk.voice_balance ?? 0) + BONUS_HEARTS
  db.prepare(
    `UPDATE vk_user_game_state
     SET voice_balance = ?, vk_group_bonus_claimed = 1, updated_at = ?
     WHERE vk_user_id = ?`,
  ).run(balanceVk, now, vkUserId)
  // #region agent log
  void fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ec43d5" },
    body: JSON.stringify({
      sessionId: "ec43d5",
      runId: "subscribe-debug-1",
      hypothesisId: "H3",
      location: "app/api/rewards/vk-group-subscribe/route.ts:133",
      message: "reward granted for vk_user_game_state",
      data: { vkUserId, balanceVk, granted: true },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return NextResponse.json({ ok: true, voiceBalance: balanceVk, isMember: true, granted: true })
}
