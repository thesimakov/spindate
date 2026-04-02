import { NextResponse } from "next/server"
import { getMainBottleId, listBottleCatalogRows } from "@/lib/bottle-catalog-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  try {
    const rows = listBottleCatalogRows({ onlyPublished: true })
    const mainBottleId = getMainBottleId()
    return NextResponse.json({ ok: true, rows, mainBottleId }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
