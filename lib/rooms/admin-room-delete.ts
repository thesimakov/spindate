import { getTableInfo, leaveLiveTable } from "@/lib/live-tables-server"
import { purgeTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { purgeTableEventsArchive } from "@/lib/live-table-events-server"
import { purgeRoomChatHistory } from "@/lib/rooms/chat-service"
import { getRoomServices } from "@/lib/rooms/room-services"
import { loadRoomRegistry, saveRoomRegistry } from "@/lib/rooms/room-registry"

/**
 * Полное удаление пользовательского стола: live → авторитет → события → чат комнаты → очередь → реестр.
 */
export async function deleteUserRoomCompletely(
  roomId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tid = Math.floor(roomId)
  if (!Number.isInteger(tid) || tid <= 0) {
    return { ok: false, error: "Некорректный номер стола" }
  }

  const state = await loadRoomRegistry()
  const room = state.rooms.find((r) => r.roomId === tid)
  if (!room) return { ok: false, error: "Стол не найден" }
  if (room.isUserRoom !== true) {
    return { ok: false, error: "Можно удалять только столы, созданные игроками" }
  }

  const info = await getTableInfo(tid)
  for (const p of info?.livePlayers ?? []) {
    await leaveLiveTable(p.id)
  }

  await purgeTableAuthoritySnapshot(tid)
  await purgeTableEventsArchive(tid)
  await purgeRoomChatHistory(tid)
  await getRoomServices().queue.removeEntriesForRequestedRoom(tid)

  const filtered = state.rooms.filter((r) => r.roomId !== tid)
  if (filtered.length === state.rooms.length) {
    return { ok: false, error: "Стол не найден в реестре" }
  }
  state.rooms = filtered
  await saveRoomRegistry(state)
  return { ok: true }
}
