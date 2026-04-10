import { NextResponse } from "next/server"
import { queryGlobalLeaderboard } from "@/lib/global-rating-store"
import type { RatingCategory } from "@/lib/rating-global-rules"
import { getRatingPeriodBounds, type RatingPeriod } from "@/lib/rating-periods"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

function parsePeriod(raw: string | null): RatingPeriod | null {
  if (raw === "day" || raw === "week" || raw === "month") return raw
  return null
}

function parseTab(raw: string | null): RatingCategory | null {
  if (raw === "love" || raw === "gifts" || raw === "kind") {
    if (raw === "gifts") return "gift"
    return raw
  }
  return null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const period = parsePeriod(url.searchParams.get("period")) ?? "week"
  const tab = parseTab(url.searchParams.get("tab")) ?? "love"
  const { startMs, endMs } = getRatingPeriodBounds(new Date(), period)
  const rows = queryGlobalLeaderboard({
    startMs,
    endMs,
    category: tab,
    limit: 10,
  })
  return NextResponse.json({ ok: true, period, tab: tab === "gift" ? "gifts" : tab, startMs, endMs, rows }, { headers: NO_CACHE })
}
