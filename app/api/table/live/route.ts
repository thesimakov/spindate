import { NextResponse } from "next/server"
import type { Player } from "@/lib/game-types"
import { joinOrSyncLiveTable, leaveLiveTable } from "@/lib/live-tables-server"
import { ensureTableAuthority } from "@/lib/table-authority-server"

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
  const name = typeof p.name === "string" ? p.name : ""
  const avatar = typeof p.avatar === "string" ? p.avatar : ""
  const gender = p.gender === "female" ? "female" : p.gender === "male" ? "male" : null
  const age = Number(p.age)
  const purpose = p.purpose === "relationships" || p.purpose === "communication" || p.purpose === "love"
    ? p.purpose
    : null
  if (!Number.isInteger(id) || id <= 0) return null
  if (!name || !avatar || !gender || !purpose) return null
  if (!Number.isFinite(age) || age < 18 || age > 120) return null

  return {
    id,
    name,
    avatar,
    gender,
    age: Math.floor(age),
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
      leaveLiveTable(userId)
    }
    return NextResponse.json({ ok: true })
  }

  const player = parsePlayer(body?.user)
  if (!player) {
    return NextResponse.json({ ok: false, error: "Некорректный пользователь" }, { status: 400 })
  }

  const maxTableSizeRaw = Number(body?.maxTableSize)
  const maxTableSize = Number.isFinite(maxTableSizeRaw) ? Math.max(1, Math.floor(maxTableSizeRaw)) : 10
  const requestedTableIdRaw = Number(body?.tableId)
  const requestedTableId = Number.isInteger(requestedTableIdRaw) ? requestedTableIdRaw : null
  const forceNew = body?.forceNew === true

  const result = joinOrSyncLiveTable({
    player,
    maxTableSize,
    requestedTableId: mode === "sync" ? requestedTableId : undefined,
    forceNew: mode === "join" ? forceNew : false,
  })

  ensureTableAuthority(result.tableId)

  return NextResponse.json({
    ok: true,
    tableId: result.tableId,
    livePlayers: result.livePlayers.map((p) => ({ ...p, isBot: false })),
    tablesCount: result.tablesCount,
  })
}
