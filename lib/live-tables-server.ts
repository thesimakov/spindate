import type { Player } from "@/lib/game-types"

type LivePlayer = Omit<Player, "isBot" | "online">

type Presence = {
  player: LivePlayer
  tableId: number
  maxTableSize: number
  updatedAt: number
}

type LiveTablesState = {
  playersById: Map<number, Presence>
  tableUsers: Map<number, Set<number>>
  nextTableId: number
}

const TABLE_ID_MIN = 7000
const TABLE_ID_MAX = 7999
const PRESENCE_TTL_MS = 45_000

declare global {
  var __spindateLiveTablesState: LiveTablesState | undefined
}

function getState(): LiveTablesState {
  if (!globalThis.__spindateLiveTablesState) {
    globalThis.__spindateLiveTablesState = {
      playersById: new Map<number, Presence>(),
      tableUsers: new Map<number, Set<number>>(),
      nextTableId: TABLE_ID_MIN,
    }
  }
  return globalThis.__spindateLiveTablesState
}

function pickNextTableId(state: LiveTablesState): number {
  for (let i = 0; i <= TABLE_ID_MAX - TABLE_ID_MIN; i++) {
    const candidate = state.nextTableId + i > TABLE_ID_MAX ? TABLE_ID_MIN + ((state.nextTableId + i - TABLE_ID_MIN) % (TABLE_ID_MAX - TABLE_ID_MIN + 1)) : state.nextTableId + i
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

function cleanupStale(state: LiveTablesState, now: number) {
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

  let bestTableId: number | null = null
  let bestSize = -1

  for (const [tableId, userSet] of state.tableUsers.entries()) {
    if (!isCompatibleTable(tableId)) continue
    const size = userSet.size
    if (size >= maxTableSize) continue
    if (size > bestSize) {
      bestSize = size
      bestTableId = tableId
    }
  }

  if (!forceNew && bestTableId != null) return bestTableId
  return pickNextTableId(state)
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

export function joinOrSyncLiveTable(args: {
  player: LivePlayer
  maxTableSize: number
  requestedTableId?: number | null
  forceNew?: boolean
}) {
  const state = getState()
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

export function leaveLiveTable(userId: number) {
  const state = getState()
  const presence = state.playersById.get(userId)
  if (!presence) return
  state.playersById.delete(userId)
  removeFromTable(state, userId, presence.tableId)
}

/** Живые игроки и размер стола (для авторитетного состояния игры) */
export function getTableInfo(tableId: number): { livePlayers: LivePlayer[]; maxTableSize: number } | null {
  const state = getState()
  cleanupStale(state, Date.now())
  const set = state.tableUsers.get(tableId)
  if (!set || set.size === 0) return null
  const firstUid = [...set.values()][0]
  const pres = state.playersById.get(firstUid)
  const maxTableSize = pres?.maxTableSize ?? 10
  return { livePlayers: tableLivePlayers(state, tableId), maxTableSize }
}
