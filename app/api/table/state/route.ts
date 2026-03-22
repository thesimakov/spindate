import { NextResponse } from "next/server"
import { ensureTableAuthority, getTableAuthoritySnapshot } from "@/lib/table-authority-server"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const tableId = Math.floor(Number(body?.tableId))
  const sinceRevision = Math.floor(Number(body?.sinceRevision ?? 0))

  if (!Number.isInteger(tableId) || tableId <= 0) {
    return NextResponse.json({ ok: false, error: "Некорректный tableId" }, { status: 400 })
  }

  await ensureTableAuthority(tableId)
  const snapshot = await getTableAuthoritySnapshot(tableId)
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "Стол не найден" }, { status: 404 })
  }

  const changed = snapshot.revision > sinceRevision
  return NextResponse.json({
    ok: true,
    revision: snapshot.revision,
    changed,
    snapshot,
  })
}
