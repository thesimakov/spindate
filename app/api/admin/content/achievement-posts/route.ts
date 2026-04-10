import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import {
  createCustomAchievementPostTemplate,
  listAchievementPostTemplates,
  upsertAchievementPostTemplate,
} from "@/lib/achievement-posts-server"

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
      displayTitle: body?.displayTitle,
      hintCustom: body?.hintCustom,
      defaultStatusCustom: body?.defaultStatusCustom,
      targetCount: body?.targetCount,
      statsKeyTitle: body?.statsKeyTitle,
    })
    const rows = listAchievementPostTemplates()
    return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status =
      msg === "unknown_achievement_key" ||
      msg === "invalid_image_url" ||
      msg === "invalid_achievement_key" ||
      msg === "stats_key_required" ||
      msg === "reserved_achievement_key"
        ? 400
        : 500
    return NextResponse.json({ ok: false, error: msg }, { status, headers: NO_CACHE })
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const achievementKey = createCustomAchievementPostTemplate({
      achievementKey: body?.achievementKey,
      statsKeyTitle: body?.statsKeyTitle,
      imageUrl: body?.imageUrl,
      postTextTemplate: body?.postTextTemplate,
      vkEnabled: body?.vkEnabled,
      published: body?.published,
      displayTitle: body?.displayTitle,
      hintCustom: body?.hintCustom,
      defaultStatusCustom: body?.defaultStatusCustom,
      targetCount: body?.targetCount,
    })
    const rows = listAchievementPostTemplates()
    return NextResponse.json({ ok: true, achievementKey, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status =
      msg === "invalid_achievement_key" ||
      msg === "stats_key_required" ||
      msg === "reserved_achievement_key" ||
      msg === "achievement_key_exists" ||
      msg === "invalid_image_url"
        ? 400
        : 500
    return NextResponse.json({ ok: false, error: msg }, { status, headers: NO_CACHE })
  }
}
