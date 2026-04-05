import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

/** Текущая сборка клиента; сравнивается с `NEXT_PUBLIC_BUILD_ID` в бандле для авто-перезагрузки после деплоя. */
export async function GET() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID?.trim() || "unknown"
  return NextResponse.json({ ok: true, buildId }, { headers: NO_STORE })
}
