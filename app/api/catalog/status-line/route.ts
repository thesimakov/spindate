import { NextResponse } from "next/server"
import { getStatusLine } from "@/lib/status-line-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  try {
    const row = getStatusLine({ onlyPublished: true })
    return NextResponse.json({ ok: true, row }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

