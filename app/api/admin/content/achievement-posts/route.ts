import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { listAchievementPostTemplates, upsertAchievementPostTemplate } from "@/lib/achievement-posts-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const rows = listAchievementPostTemplates()
    return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const achievementKey = typeof body?.achievementKey === "string" ? body.achievementKey : ""
    if (!achievementKey) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
    }
    upsertAchievementPostTemplate({
      achievementKey,
      imageUrl: body?.imageUrl,
      postTextTemplate: body?.postTextTemplate,
      vkEnabled: body?.vkEnabled,
      published: body?.published,
    })
    const rows = listAchievementPostTemplates()
    return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg === "unknown_achievement_key" || msg === "invalid_image_url" ? 400 : 500
    return NextResponse.json({ ok: false, error: msg }, { status, headers: NO_CACHE })
  }
}
