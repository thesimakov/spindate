import { NextResponse } from "next/server"
import { getRoomServices } from "@/lib/rooms/room-services"
import { parsePlayerFromClientBody } from "@/lib/rooms/parse-live-player"
import { loadRoomRegistry } from "@/lib/rooms/room-registry"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET(req: Request) {
  const url = new URL(req.url)
  const roomId = Number(url.searchParams.get("roomId"))
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return NextResponse.json({ ok: false, error: "roomId" }, { status: 400, headers: NO_CACHE })
  }
  const reg = await loadRoomRegistry()
  if (!reg.rooms.some((r) => r.roomId === roomId)) {
    return NextResponse.json({ ok: false, error: "Комната не активна" }, { status: 404, headers: NO_CACHE })
  }
  const messages = await getRoomServices().chat.getHistory(roomId)
  return NextResponse.json({ ok: true, messages }, { headers: NO_CACHE })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const player = parsePlayerFromClientBody(body?.user)
  const roomId = Number(body?.roomId)
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : ""
  if (!player || !Number.isInteger(roomId) || roomId <= 0 || !text) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
  }
  const reg = await loadRoomRegistry()
  if (!reg.rooms.some((r) => r.roomId === roomId)) {
    return NextResponse.json({ ok: false, error: "Комната не активна" }, { status: 404, headers: NO_CACHE })
  }
  const msg = await getRoomServices().chat.appendMessage(roomId, {
    senderId: player.id,
    senderName: player.name,
    text,
    timestamp: Date.now(),
  })
  return NextResponse.json({ ok: true, message: msg }, { headers: NO_CACHE })
}
