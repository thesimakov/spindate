import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"
import { utcMonthKey } from "@/lib/popularity-rules"
import {
  MONTHLY_TOP_FRAME_LIMIT,
  computeMonthRank,
  popularityLevelFromLifetime,
  resolveActorKeyFromAuth,
  sumGlobalRatingTotal,
  sumPopularityLifetime,
  sumPopularityMonth,
} from "@/lib/popularity-store"

export async function GET(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const db = getDb()
  const actorKey = resolveActorKeyFromAuth(db, auth)
  if (!actorKey) {
    return NextResponse.json({ ok: false, error: "Не удалось определить профиль" }, { status: 400 })
  }

  const now = Date.now()
  const monthKey = utcMonthKey(now)
  const ratingTotal = sumGlobalRatingTotal(db, actorKey)
  const popularityLifetime = sumPopularityLifetime(db, actorKey)
  const popularityMonth = sumPopularityMonth(db, actorKey, monthKey)
  const level = popularityLevelFromLifetime(popularityLifetime)
  const monthRank = computeMonthRank(db, actorKey, monthKey, popularityMonth)
  const monthlyTopFrame =
    monthRank != null && monthRank <= MONTHLY_TOP_FRAME_LIMIT && popularityMonth > 0

  return NextResponse.json({
    ok: true,
    monthKey,
    ratingTotal,
    popularityMonth,
    popularityLifetime,
    level,
    monthRank,
    monthlyTopFrame,
  })
}
