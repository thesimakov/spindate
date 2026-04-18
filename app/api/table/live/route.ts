import { NextResponse } from "next/server"
import type { Player } from "@/lib/game-types"
import { joinOrSyncLiveTable, leaveLiveTable } from "@/lib/live-tables-server"
import { ensureTableAuthority } from "@/lib/table-authority-server"
import { isRoomDisabledForJoin, loadRoomRegistry } from "@/lib/rooms/room-registry"
import { getDb } from "@/lib/db"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

type Mode = "join" | "sync" | "leave"

function parseMode(raw: unknown): Mode {
  if (raw === "sync") return "sync"
  if (raw === "leave") return "leave"
  return "join"
}

function parsePlayer(raw: unknown): Player | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const id = Number(p.id)
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : ""
  const avatar = typeof p.avatar === "string" ? p.avatar.trim() : ""
  const gender = p.gender === "female" ? "female" : p.gender === "male" ? "male" : null
  const ageRaw = Number(p.age)
  const age = Number.isFinite(ageRaw) ? Math.min(120, Math.max(18, Math.floor(ageRaw))) : 18
  const purpose = p.purpose === "relationships" || p.purpose === "communication" || p.purpose === "love"
    ? p.purpose
    : "communication"
  const status =
    typeof p.status === "string" && p.status.trim()
      ? p.status.trim().slice(0, 15)
      : undefined
  const authUserId = typeof p.authUserId === "string" && p.authUserId.trim() ? p.authUserId.trim() : undefined
  const vkUserIdRaw = Number(p.vkUserId)
  const vkUserId = Number.isInteger(vkUserIdRaw) && vkUserIdRaw > 0 ? vkUserIdRaw : undefined
  if (!Number.isInteger(id) || id <= 0) return null
  if (!gender) return null

  const showVkAfterCare = typeof p.showVkAfterCare === "boolean" ? p.showVkAfterCare : undefined
  const openToChatInvites = typeof p.openToChatInvites === "boolean" ? p.openToChatInvites : undefined

  return {
    id,
    name: name || `Игрок ${id}`,
    avatar,
    gender,
    age,
    purpose,
    lookingFor: p.lookingFor === "male" || p.lookingFor === "female" ? p.lookingFor : undefined,
    authProvider: p.authProvider === "vk" || p.authProvider === "login" ? p.authProvider : undefined,
    city: typeof p.city === "string" ? p.city : undefined,
    interests: typeof p.interests === "string" ? p.interests : undefined,
    zodiac: typeof p.zodiac === "string" ? p.zodiac : undefined,
    isVip: typeof p.isVip === "boolean" ? p.isVip : undefined,
    status,
    authUserId,
    vkUserId,
    isBot: false,
    ...(showVkAfterCare !== undefined ? { showVkAfterCare } : {}),
    ...(openToChatInvites !== undefined ? { openToChatInvites } : {}),
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const mode = parseMode(body?.mode)

  if (mode === "leave") {
    const userId = Number(body?.userId)
    if (Number.isInteger(userId) && userId > 0) {
      await leaveLiveTable(userId)
    }
    const leaveTableId = Number(body?.tableId)
    if (Number.isInteger(leaveTableId) && leaveTableId > 0) {
      await ensureTableAuthority(leaveTableId)
    }
    return NextResponse.json({ ok: true }, { headers: NO_CACHE })
  }

  const player = parsePlayer(body?.user)
  if (!player) {
    return NextResponse.json({ ok: false, error: "Некорректный пользователь" }, { status: 400, headers: NO_CACHE })
  }

  // server-side restrictions (админка)
  try {
    let userId: string | null = null
    if (player.authUserId) {
      userId = player.authUserId
    } else if (player.vkUserId) {
      const db = getDb()
      const row = db.prepare(`SELECT id FROM users WHERE vk_user_id = ?`).get(player.vkUserId) as { id: string } | undefined
      userId = row?.id ?? null
    }
    if (userId) {
      const flags = getAdminFlagsForUserId(userId)
      const r = isRestricted(flags)
      if (r.blocked) {
        return NextResponse.json({ ok: false, error: "Заблокирован администратором" }, { status: 403, headers: NO_CACHE })
      }
      if (r.banned) {
        return NextResponse.json({ ok: false, error: "Временный бан" }, { status: 403, headers: NO_CACHE })
      }
    }
  } catch {
    // ignore restriction errors
  }

  const maxTableSizeRaw = Number(body?.maxTableSize)
  const maxTableSize = Number.isFinite(maxTableSizeRaw) ? Math.max(1, Math.floor(maxTableSizeRaw)) : 10
  const requestedTableIdRaw = Number(body?.tableId)
  const requestedTableId = Number.isInteger(requestedTableIdRaw) ? requestedTableIdRaw : null
  const forceNew = body?.forceNew === true
  const reg = await loadRoomRegistry()

  if (requestedTableId != null) {
    const exists = reg.rooms.some((r) => r.roomId === requestedTableId)
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: "Комната больше не активна (TTL 24ч). Выберите другой стол." },
        { status: 410, headers: NO_CACHE },
      )
    }
    const roomMeta = reg.rooms.find((r) => r.roomId === requestedTableId)
    if (isRoomDisabledForJoin(roomMeta)) {
      return NextResponse.json(
        { ok: false, error: "Стол отключён модератором. Выберите другой стол в лобби." },
        { status: 410, headers: NO_CACHE },
      )
    }
  }

  const result = await joinOrSyncLiveTable({
    player,
    maxTableSize,
    requestedTableId: requestedTableId ?? undefined,
    forceNew: mode === "join" ? forceNew : false,
  })

  await ensureTableAuthority(result.tableId)

  const meta = reg.rooms.find((r) => r.roomId === result.tableId)
  const createdByUserId =
    typeof meta?.createdByUserId === "number" && Number.isFinite(meta.createdByUserId)
      ? meta.createdByUserId
      : null

  return NextResponse.json({
    ok: true,
    tableId: result.tableId,
    livePlayers: result.livePlayers.map((p) => ({ ...p, isBot: false })),
    tablesCount: result.tablesCount,
    createdByUserId,
  }, { headers: NO_CACHE })
}
