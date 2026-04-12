import { NextResponse } from "next/server"
import { getLobbyAnnouncement } from "@/lib/lobby-announcement-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  try {
    const row = getLobbyAnnouncement({ onlyPublished: true })
    if (!row) {
      return NextResponse.json({ ok: true, announcement: null }, { headers: NO_CACHE })
    }
    return NextResponse.json(
      {
        ok: true,
        announcement: {
          title: row.title,
          body: row.body,
          buttonLabel: row.buttonLabel,
          imageUrl: row.imageUrl || null,
          updatedAt: row.updatedAt,
        },
      },
      { headers: NO_CACHE },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
