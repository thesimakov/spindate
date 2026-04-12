import { getRedis } from "@/lib/redis"
import type { RoomMeta, RoomRegistryState } from "@/lib/rooms/types"
import {
  DEFAULT_ROOM_BOTTLE_SKIN,
  DEFAULT_ROOM_TABLE_STYLE,
  normalizeRoomBottleSkin,
  normalizeRoomTableStyle,
} from "@/lib/rooms/room-appearance"
import { roomsRegistryKey, userRoomVotesKey } from "@/lib/rooms/keys"
import { getTableInfo, leaveLiveTable } from "@/lib/live-tables-server"

const SEED_COUNT = 10
const USER_ROOM_TTL_MS = 24 * 60 * 60 * 1000

declare global {
  var __spindateRoomRegistryMemory: RoomRegistryState | undefined
}

function defaultSeed(): RoomRegistryState {
  const rooms: RoomMeta[] = []
  for (let i = 1; i <= SEED_COUNT; i++) {
    rooms.push({
      roomId: i,
      name: `Игровой стол #${i}`,
      bottleSkin: DEFAULT_ROOM_BOTTLE_SKIN,
      tableStyle: DEFAULT_ROOM_TABLE_STYLE,
    })
  }
  return { rooms, nextRoomId: SEED_COUNT + 1 }
}

function migrateLegacyRoomNames(state: RoomRegistryState): RoomRegistryState {
  let changed = false
  for (const r of state.rooms) {
    if (/^Room #\d+$/.test(r.name)) {
      r.name = r.name.replace(/^Room #/, "Игровой стол #")
      changed = true
    } else if (/^Комната #\d+$/.test(r.name)) {
      r.name = r.name.replace(/^Комната #/, "Игровой стол #")
      changed = true
    } else if (/^Игровые столы #\d+$/.test(r.name)) {
      r.name = r.name.replace(/^Игровые столы #/, "Игровой стол #")
      changed = true
    }
  }
  if (changed) {
    void saveRoomRegistry(state)
  }
  return state
}

function ensureUserRoomCreatedAt(state: RoomRegistryState, now: number): boolean {
  let changed = false
  for (const room of state.rooms) {
    if (!room.isUserRoom) continue
    if (typeof room.createdAtMs === "number" && Number.isFinite(room.createdAtMs)) continue
    room.createdAtMs = now
    changed = true
  }
  return changed
}

function ensureRoomAppearanceDefaults(state: RoomRegistryState): boolean {
  let changed = false
  for (const room of state.rooms) {
    const nextBottle = normalizeRoomBottleSkin(room.bottleSkin)
    const nextStyle = normalizeRoomTableStyle(room.tableStyle)
    if (room.bottleSkin !== nextBottle) {
      room.bottleSkin = nextBottle
      changed = true
    }
    if (room.tableStyle !== nextStyle) {
      room.tableStyle = nextStyle
      changed = true
    }
  }
  return changed
}

function extractExpiredUserRoomIds(state: RoomRegistryState, now: number): number[] {
  const out: number[] = []
  for (const room of state.rooms) {
    if (!room.isUserRoom) continue
    if (typeof room.createdAtMs !== "number" || !Number.isFinite(room.createdAtMs)) continue
    if (now - room.createdAtMs >= USER_ROOM_TTL_MS) out.push(room.roomId)
  }
  return out
}

function removeRoomsByIds(state: RoomRegistryState, ids: number[]): boolean {
  if (ids.length === 0) return false
  const drop = new Set(ids)
  const next = state.rooms.filter((r) => !drop.has(r.roomId))
  if (next.length === state.rooms.length) return false
  state.rooms = next
  return true
}

async function evictExpiredRooms(roomIds: number[]): Promise<void> {
  for (const roomId of roomIds) {
    const info = await getTableInfo(roomId)
    const users = info?.livePlayers ?? []
    for (const p of users) {
      await leaveLiveTable(p.id)
    }
  }
}

async function normalizeAndCleanupRegistry(state: RoomRegistryState): Promise<RoomRegistryState> {
  const now = Date.now()
  const migrated = migrateLegacyRoomNames(state)
  const changedCreatedAt = ensureUserRoomCreatedAt(migrated, now)
  const changedAppearance = ensureRoomAppearanceDefaults(migrated)
  const expiredIds = extractExpiredUserRoomIds(migrated, now)
  const changedExpired = removeRoomsByIds(migrated, expiredIds)

  if (changedCreatedAt || changedExpired || changedAppearance) {
    await saveRoomRegistry(migrated)
  }
  if (expiredIds.length > 0) {
    await evictExpiredRooms(expiredIds)
  }
  return migrated
}

function mem(): RoomRegistryState {
  if (!globalThis.__spindateRoomRegistryMemory) {
    globalThis.__spindateRoomRegistryMemory = defaultSeed()
  }
  return globalThis.__spindateRoomRegistryMemory
}

export async function loadRoomRegistry(): Promise<RoomRegistryState> {
  const r = getRedis()
  if (r) {
    const raw = await r.get(roomsRegistryKey())
    if (!raw) {
      const init = defaultSeed()
      await r.set(roomsRegistryKey(), JSON.stringify(init))
      return normalizeAndCleanupRegistry(init)
    }
    try {
      const o = JSON.parse(raw) as RoomRegistryState
      if (!Array.isArray(o.rooms) || typeof o.nextRoomId !== "number") {
        return normalizeAndCleanupRegistry(defaultSeed())
      }
      return normalizeAndCleanupRegistry(o)
    } catch {
      return normalizeAndCleanupRegistry(defaultSeed())
    }
  }
  return normalizeAndCleanupRegistry(mem())
}

export async function saveRoomRegistry(state: RoomRegistryState): Promise<void> {
  const r = getRedis()
  if (r) {
    await r.set(roomsRegistryKey(), JSON.stringify(state))
    return
  }
  globalThis.__spindateRoomRegistryMemory = state
}

export async function addUserRoom(name: string, createdByUserId: number): Promise<RoomMeta | null> {
  const state = await loadRoomRegistry()
  const votesKey = userRoomVotesKey(createdByUserId)
  const r = getRedis()
  let votes = 0
  if (r) {
    const v = await r.get(votesKey)
    votes = v ? Number(v) : 0
  } else {
    votes = Number((globalThis as unknown as { __votes?: Record<number, number> }).__votes?.[createdByUserId] ?? 0)
  }
  if (votes < 20) return null

  const roomId = state.nextRoomId++
  const trimmed = name.trim().slice(0, 64) || `Игровой стол #${roomId}`
  const meta: RoomMeta = {
    roomId,
    name: trimmed,
    bottleSkin: DEFAULT_ROOM_BOTTLE_SKIN,
    tableStyle: DEFAULT_ROOM_TABLE_STYLE,
    isUserRoom: true,
    createdByUserId,
    createdAtMs: Date.now(),
  }
  state.rooms.push(meta)
  await saveRoomRegistry(state)
  if (r) {
    await r.decrby(votesKey, 20)
  } else {
    const g = ((globalThis as unknown as { __votes?: Record<number, number> }).__votes ??= {})
    g[createdByUserId] = Math.max(0, votes - 20)
  }
  return meta
}

/** Стоимость создания пользовательского стола (сердечки), единая для всех. */
const CREATE_ROOM_COST_HEARTS = 50

export async function getCreateRoomCost(): Promise<number> {
  return CREATE_ROOM_COST_HEARTS
}

/** Создание пользовательской комнаты без оплаты «голосами» (оплата сердцами — в API). */
export async function createUserRoomPaid(
  name: string,
  createdByUserId: number,
  options?: { bottleSkin?: RoomMeta["bottleSkin"]; tableStyle?: RoomMeta["tableStyle"] },
): Promise<RoomMeta> {
  const state = await loadRoomRegistry()
  const roomId = state.nextRoomId++
  const trimmed = name.trim().slice(0, 64) || `Мой стол #${roomId}`
  const meta: RoomMeta = {
    roomId,
    name: trimmed,
    bottleSkin: normalizeRoomBottleSkin(options?.bottleSkin),
    tableStyle: normalizeRoomTableStyle(options?.tableStyle),
    isUserRoom: true,
    createdByUserId,
    createdAtMs: Date.now(),
  }
  state.rooms.push(meta)
  await saveRoomRegistry(state)
  return meta
}

/**
 * Модерация: отключить/включить пользовательский стол.
 * Системные столы (1…SEED_COUNT без isUserRoom) не трогаем.
 */
export async function setRoomDisabledByAdmin(
  roomId: number,
  disabled: boolean,
): Promise<{ ok: true; room: RoomMeta } | { ok: false; error: string }> {
  const tid = Math.floor(roomId)
  if (!Number.isInteger(tid) || tid <= 0) {
    return { ok: false, error: "Некорректный номер стола" }
  }
  const state = await loadRoomRegistry()
  const room = state.rooms.find((r) => r.roomId === tid)
  if (!room) return { ok: false, error: "Стол не найден" }
  if (room.isUserRoom !== true) {
    return { ok: false, error: "Можно отключать только столы, созданные игроками" }
  }
  room.disabledByAdmin = disabled
  await saveRoomRegistry(state)
  if (disabled) {
    const info = await getTableInfo(tid)
    for (const p of info?.livePlayers ?? []) {
      await leaveLiveTable(p.id)
    }
  }
  return { ok: true, room }
}

export function isRoomDisabledForJoin(meta: RoomMeta | undefined): boolean {
  return meta?.disabledByAdmin === true
}

/** Тест/админ: начислить «голоса» для создания комнаты */
export async function grantRoomVotes(userId: number, amount: number): Promise<void> {
  const r = getRedis()
  const key = userRoomVotesKey(userId)
  if (r) {
    await r.incrby(key, amount)
    return
  }
  const g = ((globalThis as unknown as { __votes?: Record<number, number> }).__votes ??= {})
  g[userId] = (g[userId] ?? 0) + amount
}
