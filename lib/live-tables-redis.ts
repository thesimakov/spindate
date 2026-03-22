import type { LivePlayer } from "@/lib/live-tables-core"
import {
  deserializeLiveTablesState,
  joinOrSyncLiveTableOnState,
  leaveLiveTableOnState,
  getTableInfoFromState,
  LIVE_TABLES_REDIS_KEY,
  serializeLiveTablesState,
} from "@/lib/live-tables-core"
import { readModifyWriteKey } from "@/lib/redis-rmw"
import type Redis from "ioredis"

export async function joinOrSyncLiveTableRedis(
  redis: Redis,
  args: {
    player: LivePlayer
    maxTableSize: number
    requestedTableId?: number | null
    forceNew?: boolean
  },
) {
  let result!: ReturnType<typeof joinOrSyncLiveTableOnState>
  await readModifyWriteKey(redis, LIVE_TABLES_REDIS_KEY, (raw) => {
    const state = deserializeLiveTablesState(raw)
    result = joinOrSyncLiveTableOnState(state, args)
    return serializeLiveTablesState(state)
  })
  return result
}

export async function leaveLiveTableRedis(redis: Redis, userId: number) {
  await readModifyWriteKey(redis, LIVE_TABLES_REDIS_KEY, (raw) => {
    const state = deserializeLiveTablesState(raw)
    leaveLiveTableOnState(state, userId)
    return serializeLiveTablesState(state)
  })
}

export async function getTableInfoRedis(redis: Redis, tableId: number) {
  const raw = await redis.get(LIVE_TABLES_REDIS_KEY)
  const state = deserializeLiveTablesState(raw)
  return getTableInfoFromState(state, tableId, Date.now())
}
