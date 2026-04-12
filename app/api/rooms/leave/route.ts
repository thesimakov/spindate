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
  // #region agent log
  void fetch("http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1a9f11" },
    body: JSON.stringify({
      sessionId: "1a9f11",
      location: "api/rooms/leave:POST",
      message: "rooms leave",
      data: { userId, hypothesisId: "H3" },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  const { rooms } = getRoomServices()
  await rooms.leaveRoom(userId)
  await rooms.admitNextFromQueue()
  return NextResponse.json({ ok: true }, { headers: NO_CACHE })
}
