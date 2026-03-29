import { NextResponse } from "next/server"
import type { Player } from "@/lib/game-types"
import { joinOrSyncLiveTable, leaveLiveTable } from "@/lib/live-tables-server"
import { ensureTableAuthority } from "@/lib/table-authority-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

type Mode = "join" | "sync" | "leave"

function parseMode(raw: unknown): Mode {
  if (raw === "sync") return "sync"
  if (raw === "leave") return "leave"
  return "join"
}

function parsePlayer(raw: unknown): Player | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Record<string, unknown>
  const id = Number(p.id)
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : ""
  const avatar = typeof p.avatar === "string" ? p.avatar.trim() : ""
  const gender = p.gender === "female" ? "female" : p.gender === "male" ? "male" : null
  const ageRaw = Number(p.age)
  const age = Number.isFinite(ageRaw) ? Math.min(120, Math.max(18, Math.floor(ageRaw))) : 18
  const purpose = p.purpose === "relationships" || p.purpose === "communication" || p.purpose === "love"
    ? p.purpose
    : "communication"
  if (!Number.isInteger(id) || id <= 0) return null
  if (!gender) return null

  return {
    id,
    name: name || `Игрок ${id}`,
    avatar,
    gender,
    age,
    purpose,
    lookingFor: p.lookingFor === "male" || p.lookingFor === "female" ? p.lookingFor : undefined,
    authProvider: p.authProvider === "vk" || p.authProvider === "login" ? p.authProvider : undefined,
    city: typeof p.city === "string" ? p.city : undefined,
    interests: typeof p.interests === "string" ? p.interests : undefined,
    zodiac: typeof p.zodiac === "string" ? p.zodiac : undefined,
    isVip: typeof p.isVip === "boolean" ? p.isVip : undefined,
    isBot: false,
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const mode = parseMode(body?.mode)

  if (mode === "leave") {
    const userId = Number(body?.userId)
    if (Number.isInteger(userId) && userId > 0) {
      await leaveLiveTable(userId)
    }
    return NextResponse.json({ ok: true }, { headers: NO_CACHE })
  }

  const player = parsePlayer(body?.user)
  if (!player) {
    return NextResponse.json({ ok: false, error: "Некорректный пользователь" }, { status: 400, headers: NO_CACHE })
  }

  const maxTableSizeRaw = Number(body?.maxTableSize)
  const maxTableSize = Number.isFinite(maxTableSizeRaw) ? Math.max(1, Math.floor(maxTableSizeRaw)) : 10
  const requestedTableIdRaw = Number(body?.tableId)
  const requestedTableId = Number.isInteger(requestedTableIdRaw) ? requestedTableIdRaw : null
  const forceNew = body?.forceNew === true

  const result = await joinOrSyncLiveTable({
    player,
    maxTableSize,
    requestedTableId: mode === "sync" ? requestedTableId : undefined,
    forceNew: mode === "join" ? forceNew : false,
  })

  await ensureTableAuthority(result.tableId)

  return NextResponse.json({
    ok: true,
    tableId: result.tableId,
    livePlayers: result.livePlayers.map((p) => ({ ...p, isBot: false })),
    tablesCount: result.tablesCount,
  }, { headers: NO_CACHE })
}
