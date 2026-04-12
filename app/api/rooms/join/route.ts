import { NextResponse } from "next/server"
import { getRoomServices } from "@/lib/rooms/room-services"
import { isRoomDisabledForJoin, loadRoomRegistry } from "@/lib/rooms/room-registry"
import { parsePlayerFromClientBody } from "@/lib/rooms/parse-live-player"
import { getTableInfo } from "@/lib/live-tables-server"
import { getDb } from "@/lib/db"
import { getAdminFlagsForUserId, isRestricted } from "@/lib/admin-flags"
import { normalizeRoomBottleSkin } from "@/lib/rooms/room-appearance"
import { resolveEffectiveTableStyle } from "@/lib/table-style-global-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const player = parsePlayerFromClientBody(body?.user)
  if (!player) {
    return NextResponse.json({ ok: false, error: "Некорректный пользователь" }, { status: 400, headers: NO_CACHE })
  }

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
    // ignore
  }

  const roomId = Number(body?.roomId)
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректная комната" }, { status: 400, headers: NO_CACHE })
  }
  const regBeforeJoin = await loadRoomRegistry()
  if (!regBeforeJoin.rooms.some((r) => r.roomId === roomId)) {
    return NextResponse.json({ ok: false, error: "Комната не активна (TTL 24ч)" }, { status: 410, headers: NO_CACHE })
  }
  const joinMeta = regBeforeJoin.rooms.find((r) => r.roomId === roomId)
  if (isRoomDisabledForJoin(joinMeta)) {
    return NextResponse.json(
      { ok: false, error: "Стол отключён модератором" },
      { status: 410, headers: NO_CACHE },
    )
  }

  const { rooms } = getRoomServices()
  const result = await rooms.tryEnterRoom(player, roomId)
  if (result.kind === "disabled") {
    return NextResponse.json(
      { ok: false, error: "Стол отключён модератором" },
      { status: 410, headers: NO_CACHE },
    )
  }
  if (result.kind === "queued") {
    return NextResponse.json(
      { ok: true, queued: true, position: result.position },
      { headers: NO_CACHE },
    )
  }

  const info = await getTableInfo(result.roomId)
  const reg = await loadRoomRegistry()
  const meta = reg.rooms.find((r) => r.roomId === result.roomId)
  const createdByUserId =
    typeof meta?.createdByUserId === "number" && Number.isFinite(meta.createdByUserId)
      ? meta.createdByUserId
      : undefined
  const bottleSkin = normalizeRoomBottleSkin(meta?.bottleSkin)
  const tableStyle = resolveEffectiveTableStyle(meta)
  return NextResponse.json(
    {
      ok: true,
      queued: false,
      roomId: result.roomId,
      tablesCount: result.tablesCount,
      livePlayers: info?.livePlayers ?? [],
      bottleSkin,
      tableStyle,
      ...(createdByUserId != null ? { createdByUserId } : {}),
    },
    { headers: NO_CACHE },
  )
}
