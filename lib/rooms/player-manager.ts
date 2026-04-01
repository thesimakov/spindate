import type { WebSocket } from "ws"
import type { Player } from "@/lib/game-types"

/** Привязка WebSocket ↔ пользователь (в рамках одного процесса WS-сервера) */
export type ConnectionContext = {
  socket: WebSocket
  userId: number
  roomId: number | null
  player: Player | null
  /** Явный leave_room — не сохранять сессию реконнекта */
  cleanLeave?: boolean
}

export class PlayerManager {
  private bySocket = new Map<WebSocket, ConnectionContext>()

  register(ctx: ConnectionContext): void {
    this.bySocket.set(ctx.socket, ctx)
  }

  get(socket: WebSocket): ConnectionContext | undefined {
    return this.bySocket.get(socket)
  }

  updateRoom(socket: WebSocket, roomId: number | null): void {
    const c = this.bySocket.get(socket)
    if (c) c.roomId = roomId
  }

  remove(socket: WebSocket): void {
    this.bySocket.delete(socket)
  }

  /** Все сокеты, смотрящие в комнату (для broadcast) */
  socketsInRoom(roomId: number): WebSocket[] {
    const out: WebSocket[] = []
    for (const c of this.bySocket.values()) {
      if (c.roomId === roomId) out.push(c.socket)
    }
    return out
  }
}
