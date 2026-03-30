import { NextResponse } from "next/server"

const FALLBACK_TOKEN = "date_admin_2026_super_secret_1"

function expectedToken(): string {
  return process.env.ADMIN_LEMNITY_TOKEN ?? process.env.NEXT_PUBLIC_ADMIN_LEMNITY_TOKEN ?? FALLBACK_TOKEN
}

export function requireAdmin(req: Request): NextResponse | null {
  const token = req.headers.get("x-admin-token") ?? ""
  // На некоторых серверах может быть задан ADMIN_LEMNITY_TOKEN — тогда fallback-пароль не совпадает.
  // Принимаем либо env-token, либо fallback (который вводят в UI как пароль).
  const ok = token && (token === expectedToken() || token === FALLBACK_TOKEN)
  if (!ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  return null
}

