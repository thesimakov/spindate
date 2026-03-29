import { NextResponse } from "next/server"
import { ensureTableAuthority, getTableAuthoritySnapshot } from "@/lib/table-authority-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const tableId = Math.floor(Number(body?.tableId))
  const sinceRevision = Math.floor(Number(body?.sinceRevision ?? 0))

  if (!Number.isInteger(tableId) || tableId <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректный tableId" }, { status: 400, headers: NO_CACHE })
  }

  await ensureTableAuthority(tableId)
  const snapshot = await getTableAuthoritySnapshot(tableId)
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "Стол не найден" }, { status: 404, headers: NO_CACHE })
  }

  const changed = snapshot.revision > sinceRevision
  return NextResponse.json({
    ok: true,
    revision: snapshot.revision,
    changed,
    snapshot,
  }, { headers: NO_CACHE })
}
