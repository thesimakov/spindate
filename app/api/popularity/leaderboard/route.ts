import { NextResponse } from "next/server"
import { utcMonthKey } from "@/lib/popularity-rules"
import { queryMonthlyPopularityLeaderboard } from "@/lib/popularity-store"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rawMonth = url.searchParams.get("month")
  const now = Date.now()
  const monthKey =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth.trim()) ? rawMonth.trim() : utcMonthKey(now)
  const limitRaw = url.searchParams.get("limit")
  const limit = limitRaw ? Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 20)) : 20

  const rows = queryMonthlyPopularityLeaderboard(monthKey, limit)

  return NextResponse.json({ ok: true, monthKey, rows })
}
