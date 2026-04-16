import type { LivePlayer } from "@/lib/live-tables-core"
import {
  createEmptyLiveTablesState,
  type LiveTablesState,
  joinOrSyncLiveTableOnState,
  joinSpecificRoomOnState,
  leaveLiveTableOnState,
  getTableInfoFromState,
  serializeLiveTablesState,
} from "@/lib/live-tables-core"

declare global {
  var __spindateLiveTablesMemory: LiveTablesState | undefined
}

const memoryLiveTablesOpTail = new Map<string, Promise<unknown>>()

function getMemoryState(): LiveTablesState {
  if (!globalThis.__spindateLiveTablesMemory) {
    globalThis.__spindateLiveTablesMemory = createEmptyLiveTablesState()
  }
  return globalThis.__spindateLiveTablesMemory
}

function runMemoryLiveTablesOp<T>(key: string, op: () => Promise<T> | T): Promise<T> {
  const prev = memoryLiveTablesOpTail.get(key) ?? Promise.resolve()
  const result = prev.then(() => op())
  memoryLiveTablesOpTail.set(
    key,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
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
  return runMemoryLiveTablesOp("joinOrSync", () => joinOrSyncLiveTableOnState(getMemoryState(), args))
}

export async function joinSpecificRoomMemory(args: {
  player: LivePlayer
  roomId: number
  maxTableSize: number
}) {
  return runMemoryLiveTablesOp(`room:${args.roomId}`, () => joinSpecificRoomOnState(getMemoryState(), args))
}

export async function leaveLiveTableMemory(userId: number) {
  await runMemoryLiveTablesOp(`leave:${userId}`, () => leaveLiveTableOnState(getMemoryState(), userId))
}

export async function getTableInfoMemory(tableId: number) {
  return getTableInfoFromState(getMemoryState(), tableId, Date.now())
}
