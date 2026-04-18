import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getSessionTokenFromRequest, sha256Base64 } from "@/lib/auth/session"
import { buildAuthMePayloadForUserId } from "@/lib/auth-me-payload"
import { getCachedAuthMeSuccess } from "@/lib/profile-cache"

export async function GET(req: Request) {
  const token = getSessionTokenFromRequest(req)
  if (!token) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const db = getDb()
  const tokenHash = sha256Base64(token)
  const now = Date.now()

  const session = db
    .prepare(
      `SELECT s.user_id FROM sessions s
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as { user_id: string } | undefined

  if (!session) {
    return NextResponse.json({ ok: false, error: "Сессия истекла" }, { status: 401 })
  }

  const payload = await getCachedAuthMeSuccess(session.user_id, () =>
    buildAuthMePayloadForUserId(db, session.user_id),
  )

  if (!payload.ok) {
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status })
  }

  return NextResponse.json(payload)
}
