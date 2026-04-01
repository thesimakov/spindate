import { NextResponse } from "next/server"
import { getRoomServices } from "@/lib/rooms/room-services"
import { getCreateRoomCost } from "@/lib/rooms/room-registry"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  const [rows, createCost] = await Promise.all([
    getRoomServices().rooms.getLobbyRows(),
    getCreateRoomCost(),
  ])
  return NextResponse.json({ ok: true, rows, createCost }, { headers: NO_CACHE })
}
