import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { listTableStyleCatalog, updateTableStyleCatalog } from "@/lib/table-style-catalog-server"
import type { RoomTableStyle } from "@/lib/rooms/room-appearance"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }
const STYLE_IDS = new Set<RoomTableStyle>([
  "classic_night",
  "sunset_lounge",
  "ocean_breeze",
  "violet_dream",
  "cosmic_rockets",
])

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
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

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const id = typeof body?.id === "string" ? (body.id as RoomTableStyle) : null
    if (!id || !STYLE_IDS.has(id)) {
      return NextResponse.json({ ok: false, error: "invalid_style_id" }, { status: 400, headers: NO_CACHE })
    }
    const rows = updateTableStyleCatalog(id, {
      name: typeof body?.name === "string" ? body.name : undefined,
      published: typeof body?.published === "boolean" ? body.published : undefined,
    }).map((r) => ({
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
