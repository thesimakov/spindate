import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { clearSessionCookie, getSessionTokenFromRequest, sha256Base64 } from "@/lib/auth/session"

export async function POST(req: Request) {
  const token = getSessionTokenFromRequest(req)

  if (token) {
    const tokenHash = sha256Base64(token)
    const db = getDb()
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash)
  }

  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}

