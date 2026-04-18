import { Logger } from "@nestjs/common"
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets"
import type { Server, Socket } from "socket.io"
import { ClientEvents, ServerEvents } from "./spin-events"

/**
 * Каркас: те же имена событий, что у Express-стека.
 * Подключите Prisma, Redis и guards (JWT из handshake.auth.token) по аналогии с ws-room-server.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket"],
})
export class GameGateway {
  private readonly log = new Logger(GameGateway.name)

  @WebSocketServer()
  server!: Server

  @SubscribeMessage(ClientEvents.joinRoom)
  joinRoom(@MessageBody() body: { roomId: string }, @ConnectedSocket() client: Socket) {
    void client.join(body.roomId)
    return { ok: true }
  }

  @SubscribeMessage(ClientEvents.leaveRoom)
  leaveRoom(@MessageBody() body: { roomId: string }, @ConnectedSocket() client: Socket) {
    void client.leave(body.roomId)
    return { ok: true }
  }

  @SubscribeMessage(ClientEvents.spinBottle)
  spinBottle(@MessageBody() body: { roomId: string }, @ConnectedSocket() client: Socket) {
    this.log.debug(`spin_bottle room=${body.roomId} socket=${client.id}`)
    this.server.to(body.roomId).emit(ServerEvents.spinResult, {
      roomId: body.roomId,
      spinnerUserId: "stub",
      targetUserId: "stub",
    })
    return { ok: true }
  }

  @SubscribeMessage(ClientEvents.chatMessage)
  chat(@MessageBody() body: { roomId: string; text: string }, @ConnectedSocket() client: Socket) {
    this.server.to(body.roomId).emit(ServerEvents.chatMessage, {
      roomId: body.roomId,
      userId: client.id,
      username: "player",
      text: String(body.text).slice(0, 500),
      ts: Date.now(),
    })
    return { ok: true }
  }
}
