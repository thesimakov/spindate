import { NextResponse } from "next/server"
import { getStatusLine } from "@/lib/status-line-server"
import { getCurrentTickerPlayerAd } from "@/lib/ticker-player-ads-server"

export async function GET() {
  const now = Date.now()
  const editorialRow = getStatusLine({ onlyPublished: true })
  const editorial = editorialRow
    ? {
        text: editorialRow.text,
        published: editorialRow.published,
        deleted: editorialRow.deleted,
        updatedAt: editorialRow.updatedAt,
      }
    : null
  const ad = getCurrentTickerPlayerAd(now)
  const player = ad ? { id: ad.id, text: ad.text, linkUrl: ad.linkUrl } : null

  return NextResponse.json({ ok: true, editorial, player })
}
