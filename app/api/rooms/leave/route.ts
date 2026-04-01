import { NextResponse } from "next/server"
import { getRoomServices } from "@/lib/rooms/room-services"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректный userId" }, { status: 400, headers: NO_CACHE })
  }
  const { rooms } = getRoomServices()
  await rooms.leaveRoom(userId)
  await rooms.admitNextFromQueue()
  return NextResponse.json({ ok: true }, { headers: NO_CACHE })
}
