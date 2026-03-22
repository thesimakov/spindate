import type { Player } from "@/lib/game-types"

export type LivePlayer = Omit<Player, "isBot" | "online">

export type Presence = {
  player: LivePlayer
  tableId: number
  maxTableSize: number
  updatedAt: number
}

export type LiveTablesState = {
  playersById: Map<number, Presence>
  tableUsers: Map<number, Set<number>>
  nextTableId: number
}

export const TABLE_ID_MIN = 7000
export const TABLE_ID_MAX = 7999
export const PRESENCE_TTL_MS = 45_000

export function createEmptyLiveTablesState(): LiveTablesState {
  return {
    playersById: new Map<number, Presence>(),
    tableUsers: new Map<number, Set<number>>(),
    nextTableId: TABLE_ID_MIN,
  }
}

function pickNextTableId(state: LiveTablesState): number {
  for (let i = 0; i <= TABLE_ID_MAX - TABLE_ID_MIN; i++) {
    const candidate =
      state.nextTableId + i > TABLE_ID_MAX
        ? TABLE_ID_MIN + ((state.nextTableId + i - TABLE_ID_MIN) % (TABLE_ID_MAX - TABLE_ID_MIN + 1))
        : state.nextTableId + i
    if (!state.tableUsers.has(candidate)) {
      state.nextTableId = candidate + 1 > TABLE_ID_MAX ? TABLE_ID_MIN : candidate + 1
      return candidate
    }
  }
  const fallback = state.nextTableId
  state.nextTableId = fallback + 1 > TABLE_ID_MAX ? TABLE_ID_MIN : fallback + 1
  return fallback
}

function removeFromTable(state: LiveTablesState, userId: number, tableId: number) {
  const set = state.tableUsers.get(tableId)
  if (!set) return
  set.delete(userId)
  if (set.size === 0) state.tableUsers.delete(tableId)
}

export function cleanupStale(state: LiveTablesState, now: number) {
  const stale: Array<{ userId: number; tableId: number }> = []
  for (const [userId, presence] of state.playersById.entries()) {
    if (now - presence.updatedAt > PRESENCE_TTL_MS) {
      stale.push({ userId, tableId: presence.tableId })
    }
  }
  for (const item of stale) {
    state.playersById.delete(item.userId)
    removeFromTable(state, item.userId, item.tableId)
  }
}

function selectTargetTable(
  state: LiveTablesState,
  maxTableSize: number,
  currentTableId: number | null,
  forceNew: boolean,
): number {
  const isCompatibleTable = (tableId: number): boolean => {
    const set = state.tableUsers.get(tableId)
    if (!set || set.size === 0) return false
    for (const uid of set.values()) {
      const presence = state.playersById.get(uid)
      if (!presence) continue
      if (presence.maxTableSize !== maxTableSize) return false
    }
    return true
  }

  if (!forceNew && currentTableId != null) {
    const set = state.tableUsers.get(currentTableId)
    if (set && set.size < maxTableSize && isCompatibleTable(currentTableId)) return currentTableId
  }

  if (forceNew) {
    return pickNextTableId(state)
  }

  /** Подбираем стол с максимумом живых игроков (плотнее сажаем людей), при равенстве — меньший tableId. */
  const candidates: Array<{ tableId: number; size: number }> = []
  for (const [tableId, userSet] of state.tableUsers.entries()) {
    if (!isCompatibleTable(tableId)) continue
    const size = userSet.size
    if (size >= maxTableSize) continue
    candidates.push({ tableId, size })
  }

  if (candidates.length === 0) {
    return pickNextTableId(state)
  }

  candidates.sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size
    return a.tableId - b.tableId
  })

  return candidates[0].tableId
}

function tableLivePlayers(state: LiveTablesState, tableId: number): LivePlayer[] {
  const users = state.tableUsers.get(tableId)
  if (!users || users.size === 0) return []
  const players: LivePlayer[] = []
  for (const userId of users.values()) {
    const presence = state.playersById.get(userId)
    if (!presence) continue
    players.push({ ...presence.player })
  }
  return players
}

export function joinOrSyncLiveTableOnState(
  state: LiveTablesState,
  args: {
    player: LivePlayer
    maxTableSize: number
    requestedTableId?: number | null
    forceNew?: boolean
  },
) {
  const now = Date.now()
  cleanupStale(state, now)

  const userId = args.player.id
  const existing = state.playersById.get(userId)
  if (existing) {
    removeFromTable(state, userId, existing.tableId)
  }

  const targetTableId = selectTargetTable(
    state,
    Math.max(1, args.maxTableSize),
    args.requestedTableId ?? null,
    !!args.forceNew,
  )

  const nextPresence: Presence = {
    player: args.player,
    tableId: targetTableId,
    maxTableSize: Math.max(1, args.maxTableSize),
    updatedAt: now,
  }
  state.playersById.set(userId, nextPresence)
  const set = state.tableUsers.get(targetTableId) ?? new Set<number>()
  set.add(userId)
  state.tableUsers.set(targetTableId, set)

  return {
    tableId: targetTableId,
    livePlayers: tableLivePlayers(state, targetTableId),
    tablesCount: state.tableUsers.size,
  }
}

export function leaveLiveTableOnState(state: LiveTablesState, userId: number) {
  const presence = state.playersById.get(userId)
  if (!presence) return
  state.playersById.delete(userId)
  removeFromTable(state, userId, presence.tableId)
}

export function getTableInfoFromState(
  state: LiveTablesState,
  tableId: number,
  now: number,
): { livePlayers: LivePlayer[]; maxTableSize: number } | null {
  cleanupStale(state, now)
  const set = state.tableUsers.get(tableId)
  if (!set || set.size === 0) return null
  const firstUid = [...set.values()][0]
  const pres = state.playersById.get(firstUid)
  const maxTableSize = pres?.maxTableSize ?? 10
  return { livePlayers: tableLivePlayers(state, tableId), maxTableSize }
}

export function serializeLiveTablesState(state: LiveTablesState): string {
  const playersById: Record<string, Presence> = {}
  for (const [k, v] of state.playersById.entries()) {
    playersById[String(k)] = v
  }
  const tableUsers: Record<string, number[]> = {}
  for (const [k, v] of state.tableUsers.entries()) {
    tableUsers[String(k)] = [...v]
  }
  return JSON.stringify({
    playersById,
    tableUsers,
    nextTableId: state.nextTableId,
  })
}

export function deserializeLiveTablesState(raw: string | null): LiveTablesState {
  if (!raw) return createEmptyLiveTablesState()
  try {
    const o = JSON.parse(raw) as {
      playersById: Record<string, Presence>
      tableUsers: Record<string, number[]>
      nextTableId: number
    }
    const playersById = new Map<number, Presence>()
    for (const [k, v] of Object.entries(o.playersById ?? {})) {
      playersById.set(Number(k), v)
    }
    const tableUsers = new Map<number, Set<number>>()
    for (const [k, v] of Object.entries(o.tableUsers ?? {})) {
      tableUsers.set(Number(k), new Set(Array.isArray(v) ? v : []))
    }
    return {
      playersById,
      tableUsers,
      nextTableId: typeof o.nextTableId === "number" ? o.nextTableId : TABLE_ID_MIN,
    }
  } catch {
    return createEmptyLiveTablesState()
  }
}

export const LIVE_TABLES_REDIS_KEY = "spindate:v1:live:state"
