import { getRedis } from "@/lib/redis"
import * as memory from "@/lib/live-tables-memory"
import * as redis from "@/lib/live-tables-redis"

export async function joinOrSyncLiveTable(args: Parameters<typeof memory.joinOrSyncLiveTableMemory>[0]) {
  const r = getRedis()
  if (r) return redis.joinOrSyncLiveTableRedis(r, args)
  return memory.joinOrSyncLiveTableMemory(args)
}

export async function joinSpecificRoom(args: Parameters<typeof memory.joinSpecificRoomMemory>[0]) {
  const r = getRedis()
  if (r) return redis.joinSpecificRoomRedis(r, args)
  return memory.joinSpecificRoomMemory(args)
}

export async function leaveLiveTable(userId: number) {
  const r = getRedis()
  if (r) return redis.leaveLiveTableRedis(r, userId)
  return memory.leaveLiveTableMemory(userId)
}

export async function getTableInfo(tableId: number) {
  const r = getRedis()
  if (r) return redis.getTableInfoRedis(r, tableId)
  return memory.getTableInfoMemory(tableId)
}
