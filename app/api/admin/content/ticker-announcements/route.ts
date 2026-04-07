import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import {
  listTickerPlayerAdsForAdmin,
  rejectTickerPlayerAd,
  schedulePublishedTickerAd,
  softDeleteTickerPlayerAd,
} from "@/lib/ticker-player-ads-server"

export async function GET(req: Request) {
  const deny = requireAdmin(req)
  if (deny) return deny

  const items = listTickerPlayerAdsForAdmin().map((r) => ({
    id: r.id,
    authorDisplayName: r.authorDisplayName,
    body: r.body,
    linkUrl: r.linkUrl,
    durationMs: r.durationMs,
    costHearts: r.costHearts,
    status: r.status,
    paidAt: r.paidAt,
    queueStartMs: r.queueStartMs,
    queueEndMs: r.queueEndMs,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    rejectReason: r.rejectReason,
    ownerUserId: r.ownerUserId,
    ownerVkUserId: r.ownerVkUserId,
  }))

  return NextResponse.json({ ok: true, items })
}

export async function POST(req: Request) {
  const deny = requireAdmin(req)
  if (deny) return deny

  const body = await req.json().catch(() => null)
  const action = typeof body?.action === "string" ? body.action : ""
  const id = typeof body?.id === "number" ? body.id : Number(body?.id)

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректный id" }, { status: 400 })
  }

  if (action === "publish") {
    const r = schedulePublishedTickerAd(id)
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === "delete") {
    const r = softDeleteTickerPlayerAd(id)
    if (!r.ok) return NextResponse.json({ ok: false, error: "Не удалось удалить" }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === "reject") {
    const reason = typeof body?.reason === "string" ? body.reason : null
    const r = rejectTickerPlayerAd(id, reason)
    if (!r.ok) return NextResponse.json({ ok: false, error: "Не удалось отклонить" }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: "Неизвестное действие" }, { status: 400 })
}
