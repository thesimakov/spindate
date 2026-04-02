import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getStatusLine, updateStatusLine } from "@/lib/status-line-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const row = getStatusLine()
    return NextResponse.json({ ok: true, row }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const row = updateStatusLine({
      text: typeof body?.text === "string" ? body.text : undefined,
      published: typeof body?.published === "boolean" ? body.published : undefined,
      deleted: typeof body?.deleted === "boolean" ? body.deleted : undefined,
    })
    return NextResponse.json({ ok: true, row }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

