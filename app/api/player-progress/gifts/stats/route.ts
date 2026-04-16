import { NextResponse } from "next/server"
import { queryGiftProgressStatsForPlayer } from "@/lib/gift-progress-store"
import { parsePlayerFromClientBody } from "@/lib/rooms/parse-live-player"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const player = parsePlayerFromClientBody(body?.player)
  if (!player) {
    return NextResponse.json({ ok: false, error: "bad_player" }, { status: 400, headers: NO_CACHE })
  }
  return NextResponse.json({ ok: true, stats: queryGiftProgressStatsForPlayer(player) }, { headers: NO_CACHE })
}
