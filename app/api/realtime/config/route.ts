import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

/**
 * Подсказка клиенту: WebSocket-хост, шард realtime, диапазон столов для sticky LB.
 * Переменные: REALTIME_SHARD_ID, REALTIME_TABLE_ID_MIN, REALTIME_TABLE_ID_MAX, NEXT_PUBLIC_REALTIME_WS_URL
 */
export async function GET() {
  const shardId = (process.env.REALTIME_SHARD_ID ?? "").trim() || null
  const tableIdMin = Number.parseInt(process.env.REALTIME_TABLE_ID_MIN ?? "", 10)
  const tableIdMax = Number.parseInt(process.env.REALTIME_TABLE_ID_MAX ?? "", 10)
  const wsUrl = (process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? "").trim() || null

  return NextResponse.json(
    {
      ok: true,
      shardId,
      tableIdRange:
        Number.isFinite(tableIdMin) && Number.isFinite(tableIdMax)
          ? { min: tableIdMin, max: tableIdMax }
          : null,
      wsUrl,
    },
    { headers: NO_CACHE },
  )
}
