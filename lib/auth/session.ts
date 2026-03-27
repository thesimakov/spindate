import crypto from "node:crypto"
import type { NextResponse } from "next/server"

export function newId() {
  return crypto.randomUUID()
}

export function newSessionToken() {
  // raw token goes to cookie
  return crypto.randomBytes(32).toString("base64url")
}

export function sha256Base64(input: string) {
  return crypto.createHash("sha256").update(input).digest("base64")
}

/**
 * В iframe VK (и др.) с SameSite=Lax сессия часто не прилипает к запросам.
 * В production: None + Secure (требование для None).
 */
export function setSessionCookie(res: NextResponse, token: string, expiresAtMs: number) {
  const isProd = process.env.NODE_ENV === "production"
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    expires: new Date(expiresAtMs),
  })
}

export function clearSessionCookie(res: NextResponse) {
  const isProd = process.env.NODE_ENV === "production"
  res.cookies.set("session", "", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    expires: new Date(0),
  })
}

/** Cookie или заголовок (для VK iframe, где cookie может не сохраняться). */
export function getSessionTokenFromRequest(req: Request): string | null {
  const fromHeader = req.headers.get("x-session-token")?.trim()
  if (fromHeader) return fromHeader
  const auth = req.headers.get("authorization")?.trim()
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  const raw = req.headers.get("cookie")?.match(/(?:^|;\s*)session=([^;]+)/)?.[1]
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

