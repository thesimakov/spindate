import type { LivePlayer } from "@/lib/live-tables-core"
import {
  createEmptyLiveTablesState,
  type LiveTablesState,
  joinOrSyncLiveTableOnState,
  leaveLiveTableOnState,
  getTableInfoFromState,
  serializeLiveTablesState,
} from "@/lib/live-tables-core"

declare global {
  var __spindateLiveTablesMemory: LiveTablesState | undefined
}

function getMemoryState(): LiveTablesState {
  if (!globalThis.__spindateLiveTablesMemory) {
    globalThis.__spindateLiveTablesMemory = createEmptyLiveTablesState()
  }
  return globalThis.__spindateLiveTablesMemory
}

export async function getLiveTablesRawMemory(): Promise<string> {
  return serializeLiveTablesState(getMemoryState())
}

export async function joinOrSyncLiveTableMemory(args: {
  player: LivePlayer
  maxTableSize: number
  requestedTableId?: number | null
  forceNew?: boolean
}) {
  return joinOrSyncLiveTableOnState(getMemoryState(), args)
}

export async function leaveLiveTableMemory(userId: number) {
  leaveLiveTableOnState(getMemoryState(), userId)
}

export async function getTableInfoMemory(tableId: number) {
  return getTableInfoFromState(getMemoryState(), tableId, Date.now())
}
