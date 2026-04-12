import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"
import { notifyVkTickerModerationQueued } from "@/lib/admin-vk-notify"
import {
  createTickerPlayerAdOrder,
  normalizeTickerAdLink,
  parseTier,
} from "@/lib/ticker-player-ads-server"

export async function POST(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const text = typeof body?.body === "string" ? body.body : ""
  const linkRaw = typeof body?.linkUrl === "string" ? body.linkUrl : typeof body?.link_url === "string" ? body.link_url : ""
  const tier = body?.tier
  const authorDisplayName =
    typeof body?.authorDisplayName === "string"
      ? body.authorDisplayName
      : typeof body?.author_display_name === "string"
        ? body.author_display_name
        : ""

  const linkNorm = normalizeTickerAdLink(linkRaw)
  if (!linkNorm.ok) {
    return NextResponse.json({ ok: false, error: linkNorm.error }, { status: 400 })
  }

  const tariff = parseTier(tier)
  if (!tariff) {
    return NextResponse.json({ ok: false, error: "Некорректный тариф" }, { status: 400 })
  }

  const db = getDb()
  let resolvedUserId: string | null = auth.userId
  let resolvedVk: number | null = auth.vkUserId
  if (!resolvedUserId && auth.okUserId != null) {
    const row = db.prepare(`SELECT id FROM users WHERE ok_user_id = ?`).get(auth.okUserId) as
      | { id: string }
      | undefined
    resolvedUserId = row?.id ?? null
  }

  const result = createTickerPlayerAdOrder({
    userId: resolvedUserId,
    vkUserId: resolvedVk,
    authorDisplayName,
    body: text,
    linkUrl: linkNorm.url,
    durationMs: tariff.duration_ms,
    costHearts: tariff.cost_hearts,
  })

  if (!result.ok) {
    const status = result.code === "unauthorized" ? 401 : 400
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  await notifyVkTickerModerationQueued({
    adId: result.id,
    authorDisplayName: authorDisplayName.trim() || "—",
    body: text,
    linkUrl: linkNorm.url,
    costHearts: tariff.cost_hearts,
  })

  return NextResponse.json({ ok: true, id: result.id, newBalance: result.newBalance })
}
