import { QueueManager } from "@/lib/rooms/queue-manager"
import { RoomManager } from "@/lib/rooms/room-manager"
import { ChatService } from "@/lib/rooms/chat-service"
import { ReconnectService } from "@/lib/rooms/reconnect-service"

export type RoomServices = {
  queue: QueueManager
  rooms: RoomManager
  chat: ChatService
  reconnect: ReconnectService
}

declare global {
  var __spindateRoomServices: RoomServices | undefined
}

/** Один экземпляр на процесс Node: общий для WebSocket-сервера и Route Handlers. */
export function getRoomServices(): RoomServices {
  if (!globalThis.__spindateRoomServices) {
    const queue = new QueueManager()
    globalThis.__spindateRoomServices = {
      queue,
      rooms: new RoomManager(queue),
      chat: new ChatService(),
      reconnect: new ReconnectService(),
    }
  }
  return globalThis.__spindateRoomServices
}
