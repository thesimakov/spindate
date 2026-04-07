import { NextResponse } from "next/server"
import { listTableStyleCatalog } from "@/lib/table-style-catalog-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  try {
    const rows = listTableStyleCatalog().map((r) => ({
      id: r.id,
      name: r.name,
      published: r.published,
      updatedAt: r.updatedAt,
      sortOrder: r.sortOrder,
    }))
    return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
