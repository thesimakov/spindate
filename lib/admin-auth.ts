import { NextResponse } from "next/server"

function expectedToken(): string {
  return process.env.ADMIN_LEMNITY_TOKEN ?? process.env.NEXT_PUBLIC_ADMIN_LEMNITY_TOKEN ?? "date_admin_2026_super_secret_1"
}

export function requireAdmin(req: Request): NextResponse | null {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!token || token !== expectedToken()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  return null
}

