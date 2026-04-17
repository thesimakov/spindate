import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getDb } from "@/lib/db"
import { getAdminFlagsForUserId } from "@/lib/admin-flags"
import { getRedis } from "@/lib/redis"
import { deserializeLiveTablesState } from "@/lib/live-tables-core"
import { getLiveTablesRawMemory } from "@/lib/live-tables-memory"
import { getLiveTablesRawRedis } from "@/lib/live-tables-redis"
import { getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { vkGroupsIsMember } from "@/lib/vk-groups-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }
const VK_COMMUNITY_GROUP_ID = 236519647
/** Не больше одного groups.isMember в ~333 мс, иначе VK отвечает error 6. */
const VK_MEMBERSHIP_CHECK_LIMIT = 80
const VK_MEMBERSHIP_DELAY_MS = 350

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
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
      const flags = getAdminFlagsForUserId(r.user_id)
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
        flags,
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

    for (const [key, live] of liveByUserKey.entries()) {
      if (knownKeys.has(key)) continue
      const vkFromKey = key.startsWith("vk:") ? Number(key.slice(3)) : null
      const linkedDbUser =
        vkFromKey != null && Number.isFinite(vkFromKey)
          ? (db
              .prepare(`SELECT id, username FROM users WHERE vk_user_id = ? LIMIT 1`)
              .get(vkFromKey) as { id: string; username: string } | undefined)
          : undefined
      const resolvedUserId = linkedDbUser?.id ?? `live:${key}`
      const resolvedFlags = linkedDbUser?.id ? getAdminFlagsForUserId(linkedDbUser.id) : null
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

    // Проверка фактической подписки на VK-группу (по VK API) для первых N VK-пользователей.
    const uniqueVkIds = Array.from(
      new Set(
        out
          .map((u) => (typeof u.vkUserId === "number" && Number.isInteger(u.vkUserId) && u.vkUserId > 0 ? u.vkUserId : null))
          .filter((v): v is number => v != null),
      ),
    ).slice(0, VK_MEMBERSHIP_CHECK_LIMIT)
    const vkMembershipById = new Map<number, boolean | null>()
    let vkMembershipCheckError: string | null = null
    for (let i = 0; i < uniqueVkIds.length; i++) {
      const vkUserId = uniqueVkIds[i]!
      if (i > 0) {
        await new Promise<void>((r) => setTimeout(r, VK_MEMBERSHIP_DELAY_MS))
      }
      const check = await vkGroupsIsMember({ groupId: VK_COMMUNITY_GROUP_ID, userId: vkUserId })
      if (!check.ok) {
        vkMembershipById.set(vkUserId, null)
        if (!vkMembershipCheckError) vkMembershipCheckError = check.reason
        if (check.reason === "missing_service_token") break
        continue
      }
      vkMembershipById.set(vkUserId, check.member)
    }

    // Stats by live table (lightweight: counts from gameLog)
    const tables = new Map<number, Awaited<ReturnType<typeof getTableAuthoritySnapshot>>>()
    for (const u of out) {
      if (u.live?.tableId != null && !tables.has(u.live.tableId)) {
        tables.set(u.live.tableId, await getTableAuthoritySnapshot(u.live.tableId))
      }
    }
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

