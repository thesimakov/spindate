import { NextResponse } from "next/server"
import { recordGiftProgressEvent } from "@/lib/gift-progress-store"
import { parsePlayerFromClientBody } from "@/lib/rooms/parse-live-player"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const fromPlayer = parsePlayerFromClientBody(body?.fromPlayer)
  if (!fromPlayer) {
    return NextResponse.json({ ok: false, error: "bad_from_player" }, { status: 400, headers: NO_CACHE })
  }
  const toPlayer = body?.toPlayer ? parsePlayerFromClientBody(body.toPlayer) : null
  const giftId = typeof body?.giftId === "string" ? body.giftId.trim() : ""
  const dedupeId = typeof body?.dedupeId === "string" ? body.dedupeId.trim() : ""
  if (!giftId || !dedupeId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
  }
  const heartsCost = typeof body?.heartsCost === "number" ? body.heartsCost : undefined
  const rosesCost = typeof body?.rosesCost === "number" ? body.rosesCost : undefined
  const createdAtMs = typeof body?.createdAtMs === "number" ? body.createdAtMs : undefined
  const result = recordGiftProgressEvent({
    dedupeId,
    fromPlayer,
    toPlayer,
    giftId,
    heartsCost,
    rosesCost,
    createdAtMs,
  })
  return NextResponse.json(
    { ok: true, stats: result.stats, achievementUnlockedNow: result.achievementUnlockedNow },
    { headers: NO_CACHE },
  )
}
