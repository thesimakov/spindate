import { NextResponse } from "next/server"
import { getMaintenanceMode } from "@/lib/maintenance-mode-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  try {
    const row = getMaintenanceMode()
    return NextResponse.json(
      {
        ok: true,
        enabled: row.enabled,
        updatedAt: row.updatedAt,
      },
      { headers: NO_CACHE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg, enabled: false }, { status: 500, headers: NO_CACHE })
  }
}
