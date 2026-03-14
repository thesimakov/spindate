import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sha256Base64 } from "@/lib/auth/session"

export async function POST(req: Request) {
  const token = req.headers.get("cookie")?.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? null

  if (token) {
    const tokenHash = sha256Base64(decodeURIComponent(token))
    const db = getDb()
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash)
  }

  const res = NextResponse.json({ ok: true })
  const isProd = process.env.NODE_ENV === "production"
  res.cookies.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires: new Date(0),
  })
  return res
}

