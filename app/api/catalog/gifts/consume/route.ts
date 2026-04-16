import { NextResponse } from "next/server"
import { tryConsumeGiftStock } from "@/lib/gift-catalog-server"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  if (!getGameUserIdFromRequest(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_CACHE })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
  }
  const giftId = typeof (body as { giftId?: unknown })?.giftId === "string" ? (body as { giftId: string }).giftId.trim() : ""
  if (!giftId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_CACHE })
  }

  const result = tryConsumeGiftStock(giftId)
  if (!result.ok) {
    const status =
      result.reason === "out_of_stock" ? 409 : result.reason === "unpublished" ? 404 : 404
    return NextResponse.json({ ok: false, error: result.reason }, { status, headers: NO_CACHE })
  }
  if (result.unlimited) {
    return NextResponse.json({ ok: true, unlimited: true }, { headers: NO_CACHE })
  }
  return NextResponse.json({ ok: true, unlimited: false, stock: result.stockAfter }, { headers: NO_CACHE })
}
