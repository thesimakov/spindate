import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { removeAdminUploadedAssetIfExists } from "@/lib/admin-upload-cleanup"
import { deleteFrameCatalogEntry, listFrameCatalogRows, updateFrameCatalogEntry } from "@/lib/frame-catalog-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const rows = listFrameCatalogRows({ includeDeleted: true })
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
    const id = typeof body?.id === "string" ? body.id : ""
    if (!id) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
    }
    if (body?.deleted === true) {
      const { removedAssetPath } = deleteFrameCatalogEntry(id)
      if (removedAssetPath) await removeAdminUploadedAssetIfExists(removedAssetPath)
      const rows = listFrameCatalogRows({ includeDeleted: true })
      return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
    }
    updateFrameCatalogEntry({
      id,
      section: body?.section === "free" || body?.section === "paid" || body?.section === "vip" ? body.section : undefined,
      name: typeof body?.name === "string" ? body.name : undefined,
      border: typeof body?.border === "string" ? body.border : undefined,
      shadow: typeof body?.shadow === "string" ? body.shadow : undefined,
      animationClass: typeof body?.animationClass === "string" ? body.animationClass : undefined,
      svgPath: typeof body?.svgPath === "string" ? body.svgPath : undefined,
      cost: typeof body?.cost === "number" ? body.cost : undefined,
      published: typeof body?.published === "boolean" ? body.published : undefined,
    })
    const rows = listFrameCatalogRows({ includeDeleted: true })
    return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
