import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { listTableStyleCatalog, updateTableStyleCatalog } from "@/lib/table-style-catalog-server"
import type { RoomTableStyle } from "@/lib/rooms/room-appearance"
import { getTableStyleGlobal, setTableStyleGlobal } from "@/lib/table-style-global-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }
const STYLE_IDS = new Set<RoomTableStyle>([
  "classic_night",
  "sunset_lounge",
  "ocean_breeze",
  "violet_dream",
  "cosmic_rockets",
  "light_day",
  "nebula_mockup",
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
    const g = getTableStyleGlobal()
    return NextResponse.json(
      {
        ok: true,
        rows,
        globalSkin: { enabled: g.enabled, styleId: g.styleId, updatedAt: g.updatedAt },
      },
      { headers: NO_CACHE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

function mapRows() {
  return listTableStyleCatalog().map((r) => ({
    id: r.id,
    name: r.name,
    published: r.published,
    updatedAt: r.updatedAt,
    sortOrder: r.sortOrder,
  }))
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const globalRaw = body?.globalSkin
    const hasGlobal = globalRaw != null && typeof globalRaw === "object"
    if (hasGlobal && typeof globalRaw.styleId === "string" && globalRaw.styleId && !STYLE_IDS.has(globalRaw.styleId as RoomTableStyle)) {
      return NextResponse.json({ ok: false, error: "invalid_global_style_id" }, { status: 400, headers: NO_CACHE })
    }

    const id = typeof body?.id === "string" ? (body.id as RoomTableStyle) : null
    const hasRow = id != null && STYLE_IDS.has(id)

    if (!hasGlobal && !hasRow) {
      return NextResponse.json({ ok: false, error: "need_id_or_globalSkin" }, { status: 400, headers: NO_CACHE })
    }

    let rows = mapRows()
    if (hasRow && id) {
      rows = updateTableStyleCatalog(id, {
        name: typeof body?.name === "string" ? body.name : undefined,
        published: typeof body?.published === "boolean" ? body.published : undefined,
      }).map((r) => ({
        id: r.id,
        name: r.name,
        published: r.published,
        updatedAt: r.updatedAt,
        sortOrder: r.sortOrder,
      }))
    }

    let g = getTableStyleGlobal()
    if (hasGlobal) {
      g = setTableStyleGlobal({
        enabled: typeof globalRaw.enabled === "boolean" ? globalRaw.enabled : undefined,
        styleId: typeof globalRaw.styleId === "string" ? globalRaw.styleId : undefined,
      })
    }

    return NextResponse.json(
      {
        ok: true,
        rows,
        globalSkin: { enabled: g.enabled, styleId: g.styleId, updatedAt: g.updatedAt },
      },
      { headers: NO_CACHE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
