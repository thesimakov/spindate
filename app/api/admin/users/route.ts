import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getDb } from "@/lib/db"
import { getRedis } from "@/lib/redis"
import { deserializeLiveTablesState } from "@/lib/live-tables-core"
import { getLiveTablesRawMemory } from "@/lib/live-tables-memory"
import { getLiveTablesRawRedis } from "@/lib/live-tables-redis"
import { getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { vkGroupsIsMemberOnce } from "@/lib/vk-groups-server"

/** Лимит времени на ответ (прокси/Vercel часто рвут длинные GET). */
export const maxDuration = 60

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }
const VK_COMMUNITY_GROUP_ID = 236519647
/** Массовая проверка: одна попытка на id + пауза; не больше N за запрос. */
const VK_MEMBERSHIP_CHECK_LIMIT = 20
const VK_MEMBERSHIP_DELAY_MS = 300
/** Не тратить на VK больше этого — иначе «слетает» список из‑за таймаута. */
const VK_MEMBERSHIP_BUDGET_MS = 10_000
const VK_MEMBERSHIP_QUERY_PARAM = "includeVkMembership"

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const includeVkMembership = new URL(req.url).searchParams.get(VK_MEMBERSHIP_QUERY_PARAM) === "1"
    const db = getDb()
    const userCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
    const userGameStateCols = db.prepare(`PRAGMA table_info(user_game_state)`).all() as Array<{ name: string }>
    const vkUserGameStateCols = db.prepare(`PRAGMA table_info(vk_user_game_state)`).all() as Array<{ name: string }>
    const hasVkUserId = userCols.some((c) => c.name === "vk_user_id")
    const hasUserVkGroupClaimed = userGameStateCols.some((c) => c.name === "vk_group_bonus_claimed")
    const hasVkStateVkGroupClaimed = vkUserGameStateCols.some((c) => c.name === "vk_group_bonus_claimed")
    const vkUserIdSelect = hasVkUserId ? "u.vk_user_id" : "NULL AS vk_user_id"
    const userVkGroupClaimedSelect = hasUserVkGroupClaimed
      ? "COALESCE(s.vk_group_bonus_claimed, 0) AS vk_group_bonus_claimed"
      : "0 AS vk_group_bonus_claimed"
    const rows = db.prepare(
      `SELECT u.id as user_id, u.username, ${vkUserIdSelect}, p.display_name, p.avatar_url, p.gender, p.age, p.purpose,
              s.voice_balance, ${userVkGroupClaimedSelect}
       FROM users u
       LEFT JOIN player_profiles p ON p.user_id = u.id
       LEFT JOIN user_game_state s ON s.user_id = u.id
       ORDER BY u.updated_at DESC
       LIMIT 500`,
    ).all() as Array<{
      user_id: string
      username: string
      vk_user_id: number | null
      display_name: string | null
      avatar_url: string | null
      gender: string | null
      age: number | null
      purpose: string | null
      voice_balance: number | null
      vk_group_bonus_claimed: number | null
    }>

    const flagsByUserId = new Map<
      string,
      { blockedUntil: number | null; bannedUntil: number | null; deleted: boolean }
    >()
    if (rows.length > 0) {
      const flagPlaceholders = rows.map(() => "?").join(",")
      const rawFlags = db.prepare(
        `SELECT user_id, blocked_until, banned_until, deleted
         FROM user_admin_flags
         WHERE user_id IN (${flagPlaceholders})`,
      ).all(...rows.map((r) => r.user_id)) as Array<{
        user_id: string
        blocked_until: number | null
        banned_until: number | null
        deleted: number
      }>
      for (const f of rawFlags) {
        flagsByUserId.set(f.user_id, {
          blockedUntil: typeof f.blocked_until === "number" ? f.blocked_until : null,
          bannedUntil: typeof f.banned_until === "number" ? f.banned_until : null,
          deleted: Boolean(f.deleted),
        })
      }
    }

    // live presence snapshot
    const liveByUserKey = new Map<string, { tableId: number; updatedAt: number; playerId: number }>()
    const redis = getRedis()
    const rawLive = redis ? await getLiveTablesRawRedis(redis) : await getLiveTablesRawMemory()
    const state = deserializeLiveTablesState(rawLive)
    for (const [playerId, pres] of state.playersById.entries()) {
      const key = pres.player.authUserId
        ? `u:${pres.player.authUserId}`
        : pres.player.vkUserId
          ? `vk:${pres.player.vkUserId}`
          : `pid:${playerId}`
      liveByUserKey.set(key, { tableId: pres.tableId, updatedAt: pres.updatedAt, playerId })
    }

    const out = rows.map((r) => {
      const key = r.vk_user_id != null ? `vk:${r.vk_user_id}` : `u:${r.user_id}`
      const live = liveByUserKey.get(key) ?? null
      return {
        userId: r.user_id,
        isDbUser: true,
        username: r.username,
        vkUserId: r.vk_user_id ?? undefined,
        displayName: r.display_name ?? r.username,
        avatarUrl: r.avatar_url ?? undefined,
        gender: r.gender ?? undefined,
        age: r.age ?? undefined,
        purpose: r.purpose ?? undefined,
        voiceBalance: r.voice_balance ?? 0,
        vkGroupBonusClaimed: Boolean(r.vk_group_bonus_claimed),
        flags: flagsByUserId.get(r.user_id) ?? null,
        live,
      }
    })

    // Добавить live-only игроков (тестовые, офлайн-VK, и т.п.), которых нет в users таблице
    const knownKeys = new Set<string>()
    for (const r of rows) {
      knownKeys.add(r.vk_user_id != null ? `vk:${r.vk_user_id}` : `u:${r.user_id}`)
    }

    // Добавить VK-пользователей, которые есть только в vk_user_game_state
    // (например, вход в dev-режиме без серверной VK-сессии).
    const vkStateVkGroupClaimedSelect = hasVkStateVkGroupClaimed
      ? "COALESCE(vk_group_bonus_claimed, 0) AS vk_group_bonus_claimed"
      : "0 AS vk_group_bonus_claimed"
    const vkStateRows = db.prepare(
      `SELECT vk_user_id, voice_balance, updated_at, ${vkStateVkGroupClaimedSelect}
       FROM vk_user_game_state
       ORDER BY updated_at DESC
       LIMIT 500`,
    ).all() as Array<{ vk_user_id: number; voice_balance: number; updated_at: number; vk_group_bonus_claimed: number }>
    for (const r of vkStateRows) {
      const key = `vk:${r.vk_user_id}`
      if (knownKeys.has(key)) continue
      knownKeys.add(key)
      out.push({
        userId: `vk:${r.vk_user_id}`,
        isDbUser: false,
        username: `vk_${r.vk_user_id}`,
        vkUserId: r.vk_user_id,
        displayName: `VK пользователь ${r.vk_user_id}`,
        avatarUrl: undefined,
        gender: undefined,
        age: undefined,
        purpose: undefined,
        voiceBalance: r.voice_balance ?? 0,
        vkGroupBonusClaimed: Boolean(r.vk_group_bonus_claimed),
        flags: null,
        live: liveByUserKey.get(key) ?? null,
      })
    }

    const unresolvedLiveVkIds: number[] = []
    for (const key of liveByUserKey.keys()) {
      if (knownKeys.has(key)) continue
      if (!key.startsWith("vk:")) continue
      const vkFromKey = Number(key.slice(3))
      if (Number.isFinite(vkFromKey) && vkFromKey > 0) unresolvedLiveVkIds.push(vkFromKey)
    }
    const linkedUsersByVkId = new Map<number, { id: string; username: string }>()
    if (unresolvedLiveVkIds.length > 0) {
      const uniqueVkIds = Array.from(new Set(unresolvedLiveVkIds))
      const vkPlaceholders = uniqueVkIds.map(() => "?").join(",")
      const linkedRows = db.prepare(
        `SELECT id, username, vk_user_id
         FROM users
         WHERE vk_user_id IN (${vkPlaceholders})`,
      ).all(...uniqueVkIds) as Array<{ id: string; username: string; vk_user_id: number | null }>
      for (const linked of linkedRows) {
        if (typeof linked.vk_user_id === "number" && Number.isInteger(linked.vk_user_id) && linked.vk_user_id > 0) {
          linkedUsersByVkId.set(linked.vk_user_id, { id: linked.id, username: linked.username })
        }
      }
      const linkedUserIds = linkedRows.map((l) => l.id)
      if (linkedUserIds.length > 0) {
        const linkedFlagPlaceholders = linkedUserIds.map(() => "?").join(",")
        const linkedFlags = db.prepare(
          `SELECT user_id, blocked_until, banned_until, deleted
           FROM user_admin_flags
           WHERE user_id IN (${linkedFlagPlaceholders})`,
        ).all(...linkedUserIds) as Array<{
          user_id: string
          blocked_until: number | null
          banned_until: number | null
          deleted: number
        }>
        for (const f of linkedFlags) {
          flagsByUserId.set(f.user_id, {
            blockedUntil: typeof f.blocked_until === "number" ? f.blocked_until : null,
            bannedUntil: typeof f.banned_until === "number" ? f.banned_until : null,
            deleted: Boolean(f.deleted),
          })
        }
      }
    }

    for (const [key, live] of liveByUserKey.entries()) {
      if (knownKeys.has(key)) continue
      const vkFromKey = key.startsWith("vk:") ? Number(key.slice(3)) : null
      const linkedDbUser =
        vkFromKey != null && Number.isFinite(vkFromKey) ? linkedUsersByVkId.get(vkFromKey) : undefined
      const resolvedUserId = linkedDbUser?.id ?? `live:${key}`
      const resolvedFlags = linkedDbUser?.id ? (flagsByUserId.get(linkedDbUser.id) ?? null) : null
      out.push({
        userId: resolvedUserId,
        // Если user в live присутствии появился раньше, чем в выборке rows, но в users уже есть запись — модерировать можно.
        isDbUser: Boolean(linkedDbUser),
        username: linkedDbUser?.username ?? "—",
        vkUserId: vkFromKey ?? undefined,
        displayName: (() => {
          const pid = live.playerId
          const pres = state.playersById.get(pid as any)
          return pres?.player?.name ? pres.player.name : `Live игрок (${key})`
        })(),
        avatarUrl: undefined,
        gender: undefined,
        age: undefined,
        purpose: undefined,
        voiceBalance: 0,
        vkGroupBonusClaimed: false,
        flags: resolvedFlags,
        live,
      })
    }

    // Stats by live table (lightweight: counts from gameLog)
    const liveTableIds = Array.from(
      new Set(
        out
          .map((u) => u.live?.tableId ?? null)
          .filter((tableId): tableId is number => typeof tableId === "number" && Number.isInteger(tableId) && tableId > 0),
      ),
    )
    const tableSnapshots = await Promise.all(
      liveTableIds.map(async (liveTableId) => [liveTableId, await getTableAuthoritySnapshot(liveTableId)] as const),
    )
    const tables = new Map<number, Awaited<ReturnType<typeof getTableAuthoritySnapshot>>>(tableSnapshots)
    const usersWithStats = out.map((u) => {
      const snap = u.live?.tableId != null ? tables.get(u.live.tableId) ?? null : null
      if (!snap || !u.live?.playerId) return { ...u, stats: null as null }
      const pid = u.live.playerId
      const counts: Record<string, number> = {}
      for (const e of snap.gameLog ?? []) {
        if (e.fromPlayer?.id !== pid) continue
        const t = String(e.type)
        counts[t] = (counts[t] ?? 0) + 1
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      return {
        ...u,
        stats: {
          totalActions: total,
          counts,
        },
      }
    })

    // Подписка VK: выполняется только по запросу с includeVkMembership=1,
    // чтобы список пользователей появлялся сразу.
    const uniqueVkIds = Array.from(
      new Set(
        out
          .map((u) => (typeof u.vkUserId === "number" && Number.isInteger(u.vkUserId) && u.vkUserId > 0 ? u.vkUserId : null))
          .filter((v): v is number => v != null),
      ),
    ).slice(0, VK_MEMBERSHIP_CHECK_LIMIT)

    const vkMembershipById = new Map<number, boolean | null>()
    let vkMembershipCheckError: string | null = null
    if (includeVkMembership) {
      const vkDeadline = Date.now() + VK_MEMBERSHIP_BUDGET_MS
      try {
        for (let i = 0; i < uniqueVkIds.length; i++) {
          if (Date.now() > vkDeadline) {
            if (!vkMembershipCheckError) vkMembershipCheckError = "vk_check_budget"
            break
          }
          const vkUserId = uniqueVkIds[i]!
          if (i > 0) {
            await new Promise<void>((r) => setTimeout(r, VK_MEMBERSHIP_DELAY_MS))
          }
          if (Date.now() > vkDeadline) break
          const check = await vkGroupsIsMemberOnce({ groupId: VK_COMMUNITY_GROUP_ID, userId: vkUserId })
          if (!check.ok) {
            vkMembershipById.set(vkUserId, null)
            if (!vkMembershipCheckError) vkMembershipCheckError = check.reason
            if (check.reason === "missing_service_token") break
            continue
          }
          vkMembershipById.set(vkUserId, check.member)
        }
      } catch {
        if (!vkMembershipCheckError) vkMembershipCheckError = "vk_check_failed"
      }
    }

    const usersWithVkStatus = usersWithStats.map((u) => ({
      ...u,
      vkGroupMember:
        typeof u.vkUserId === "number" && Number.isInteger(u.vkUserId) && u.vkUserId > 0
          ? (vkMembershipById.get(u.vkUserId) ?? null)
          : null,
      vkGroupCheckError: vkMembershipCheckError,
    }))

    return NextResponse.json({ ok: true, users: usersWithVkStatus }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

