import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getTableInfo } from "@/lib/live-tables-server"
import { getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { deleteUserRoomCompletely } from "@/lib/rooms/admin-room-delete"
import { loadRoomRegistry, setRoomDisabledByAdmin } from "@/lib/rooms/room-registry"
import { normalizeRoomBottleSkin } from "@/lib/rooms/room-appearance"
import { resolveEffectiveTableStyle } from "@/lib/table-style-global-server"
import { ROOM_MAX_PLAYERS } from "@/lib/rooms/bot-manager"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const reg = await loadRoomRegistry()
    const userRooms = reg.rooms.filter((r) => r.isUserRoom === true)
    let liveTotal = 0
    let disabledCount = 0

    const rooms = await Promise.all(
      userRooms.map(async (m) => {
        const info = await getTableInfo(m.roomId)
        const n = info?.livePlayers.length ?? 0
        if (!m.disabledByAdmin) liveTotal += n
        if (m.disabledByAdmin) disabledCount += 1
        const snap = await getTableAuthoritySnapshot(m.roomId)
        return {
          roomId: m.roomId,
          name: m.name,
          createdByUserId: m.createdByUserId ?? null,
          createdAtMs: m.createdAtMs ?? null,
          disabledByAdmin: m.disabledByAdmin === true,
          livePlayerCount: n,
          maxPlayers: ROOM_MAX_PLAYERS,
          bottleSkin: normalizeRoomBottleSkin(m.bottleSkin),
          tableStyle: resolveEffectiveTableStyle(m),
          authorityRevision: snap?.revision ?? null,
          roundNumber: snap?.roundNumber ?? null,
        }
      }),
    )

    rooms.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))

    return NextResponse.json(
      {
        ok: true,
        rooms,
        stats: {
          userRoomsTotal: userRooms.length,
          userRoomsDisabled: disabledCount,
          userRoomsActive: userRooms.length - disabledCount,
          livePlayersOnActiveUserRooms: liveTotal,
        },
      },
      { headers: NO_CACHE },
    )
  } catch (e) {
    console.error("[api/admin/tables GET]", e)
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: NO_CACHE })
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const body = await req.json().catch(() => null)
    const roomId = Number(body?.roomId)
    const action = body?.action
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return NextResponse.json({ ok: false, error: "bad_room_id" }, { status: 400, headers: NO_CACHE })
    }
    if (action === "delete") {
      const del = await deleteUserRoomCompletely(roomId)
      if (!del.ok) {
        return NextResponse.json({ ok: false, error: del.error }, { status: 400, headers: NO_CACHE })
      }
      return NextResponse.json({ ok: true, deleted: true }, { headers: NO_CACHE })
    }

    if (action !== "disable" && action !== "enable") {
      return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400, headers: NO_CACHE })
    }

    const result = await setRoomDisabledByAdmin(roomId, action === "disable")
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400, headers: NO_CACHE })
    }
    return NextResponse.json({ ok: true, room: result.room }, { headers: NO_CACHE })
  } catch (e) {
    console.error("[api/admin/tables POST]", e)
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: NO_CACHE })
  }
}
