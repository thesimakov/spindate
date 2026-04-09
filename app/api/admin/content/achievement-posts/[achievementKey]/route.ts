import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { deleteAchievementPostTemplate, listAchievementPostTemplates } from "@/lib/achievement-posts-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ achievementKey: string }> },
) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const { achievementKey } = await ctx.params
    if (!achievementKey) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
    }
    deleteAchievementPostTemplate(achievementKey)
    const rows = listAchievementPostTemplates()
    return NextResponse.json({ ok: true, rows }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
