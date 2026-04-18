import type { WebSocket } from "ws"
import type { Player } from "@/lib/game-types"
import type { ClientToServerMessage, ServerToClientMessage } from "@/lib/rooms/types"
import { PlayerManager, type ConnectionContext } from "@/lib/rooms/player-manager"
import { RoomManager } from "@/lib/rooms/room-manager"
import { ChatService } from "@/lib/rooms/chat-service"
import { ReconnectService, RECONNECT_GRACE_SEC } from "@/lib/rooms/reconnect-service"
import { getRoomServices } from "@/lib/rooms/room-services"
import { getTableInfo, joinSpecificRoom } from "@/lib/live-tables-server"
import { toLivePlayer } from "@/lib/rooms/room-manager"
import { ROOM_MAX_PLAYERS } from "@/lib/rooms/bot-manager"
import { parsePlayerFromClientBody } from "@/lib/rooms/parse-live-player"
import { addUserRoom, loadRoomRegistry } from "@/lib/rooms/room-registry"
import { rateLimitWsRoomChat } from "@/lib/rate-limit-redis"
import { ensureWsRoomSubscriber, publishWsRoomMessage } from "@/lib/ws-room-redis"
import { getRedis } from "@/lib/redis"

function send(ws: WebSocket, msg: ServerToClientMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

export class WsRoomServer {
  readonly players = new PlayerManager()
  readonly queue: ReturnType<typeof getRoomServices>["queue"]
  readonly rooms: RoomManager
  readonly chat: ChatService
  readonly reconnect: ReconnectService
  private readonly lobbySockets = new Set<WebSocket>()

  constructor() {
    const s = getRoomServices()
    this.queue = s.queue
    this.rooms = s.rooms
    this.chat = s.chat
    this.reconnect = s.reconnect
    ensureWsRoomSubscriber((roomId, msg) => {
      this.deliverRoomLocal(roomId, msg)
    })
  }

  onConnection(ws: WebSocket): void {
    const ctx: ConnectionContext = { socket: ws, userId: 0, roomId: null, player: null }
    this.players.register(ctx)
    this.lobbySockets.add(ws)

    ws.on("message", (data) => {
      void this.onMessage(ws, data)
    })
    ws.on("close", () => {
      void this.onSocketClosed(ws)
    })

    void this.rooms.getLobbyRows().then((rows) => {
      send(ws, { type: "lobby_snapshot", rows })
    })
  }

  /**
   * Обрыв TCP/WebSocket не считается выходом из комнаты (требование: кик только по критическим причинам).
   * Сохраняем сессию реконнекта; состав live-стола обновится по таймауту live-tables или при явном leave_room.
   */
  private async onSocketClosed(ws: WebSocket): Promise<void> {
    const ctx = this.players.get(ws)
    this.lobbySockets.delete(ws)
    if (ctx?.player && ctx.roomId != null && !ctx.cleanLeave) {
      await this.reconnect.saveSession(ctx.player.id, ctx.roomId)
    }
    this.players.remove(ws)
  }

  private async onMessage(ws: WebSocket, raw: unknown): Promise<void> {
    let parsed: ClientToServerMessage
    try {
      const text = typeof raw === "string" ? raw : raw instanceof Buffer ? raw.toString("utf8") : ""
      parsed = JSON.parse(text) as ClientToServerMessage
    } catch {
      send(ws, { type: "error", code: "bad_json", message: "Некорректное JSON-сообщение" })
      return
    }

    const reqId = "clientRequestId" in parsed ? parsed.clientRequestId : undefined

    try {
      switch (parsed.type) {
        case "join_room":
          await this.handleJoinRoom(ws, parsed, reqId)
          break
        case "leave_room":
          await this.handleLeaveRoom(ws, reqId)
          break
        case "switch_room":
          await this.handleSwitchRoom(ws, parsed, reqId)
          break
        case "send_message":
          await this.handleSendMessage(ws, parsed, reqId)
          break
        case "reconnect":
          await this.handleReconnect(ws, parsed, reqId)
          break
        case "create_room":
          await this.handleCreateRoom(ws, parsed, reqId)
          break
        default:
          send(ws, { type: "error", code: "unknown_type", message: "Неизвестный тип сообщения", clientRequestId: reqId })
      }
    } catch (e) {
      send(ws, {
        type: "error",
        code: "server",
        message: e instanceof Error ? e.message : "Ошибка сервера",
        clientRequestId: reqId,
      })
    }
  }

  private async handleJoinRoom(
    ws: WebSocket,
    msg: Extract<ClientToServerMessage, { type: "join_room" }>,
    reqId: string | undefined,
  ): Promise<void> {
    const player = parsePlayerFromClientBody(msg.player)
    if (!player) {
      send(ws, { type: "error", code: "bad_player", message: "Некорректный профиль игрока", clientRequestId: reqId })
      return
    }
    const ctx = this.players.get(ws)!
    ctx.userId = player.id
    ctx.player = player

    const result = await this.rooms.tryEnterRoom(player, msg.roomId)
    if (result.kind === "disabled") {
      send(ws, {
        type: "error",
        code: "room_disabled",
        message: "Стол отключён модератором",
        clientRequestId: reqId,
      })
      await this.broadcastLobby()
      return
    }
    if (result.kind === "queued") {
      this.lobbySockets.add(ws)
      send(ws, {
        type: "queue_update",
        position: result.position,
        reason: "all_rooms_full",
        clientRequestId: reqId,
      })
      await this.broadcastLobby()
      return
    }

    this.lobbySockets.delete(ws)
    ctx.roomId = result.roomId
    await this.reconnect.clearSession(player.id)
    const state = await this.rooms.buildRoomState(result.roomId)
    const history = await this.chat.getHistory(result.roomId)
    send(ws, { type: "joined_room", roomId: result.roomId, clientRequestId: reqId })
    send(ws, { type: "room_state", state, clientRequestId: reqId })
    send(ws, { type: "chat_history", roomId: result.roomId, messages: history, clientRequestId: reqId })
    this.broadcastRoom(result.roomId, {
      type: "player_joined",
      player,
      liveCount: state.livePlayers.length,
      clientRequestId: reqId,
    })
    await this.broadcastLobby()
  }

  private async handleLeaveRoom(ws: WebSocket, reqId: string | undefined): Promise<void> {
    const ctx = this.players.get(ws)
    if (!ctx?.player || ctx.roomId == null) {
      send(ws, { type: "error", code: "not_in_room", message: "Не в комнате", clientRequestId: reqId })
      return
    }
    ctx.cleanLeave = true
    const roomId = ctx.roomId
    const userId = ctx.player.id
    await this.reconnect.clearSession(userId)
    await this.rooms.leaveRoom(userId)
    ctx.roomId = null
    this.lobbySockets.add(ws)
    this.broadcastRoom(roomId, {
      type: "player_left",
      userId,
      liveCount: (await this.rooms.buildRoomState(roomId)).livePlayers.length,
      clientRequestId: reqId,
    })
    const admitted = await this.rooms.admitNextFromQueue(roomId)
    if (admitted) await this.broadcastLobby()
    await this.broadcastLobby()
    send(ws, { type: "queue_update", position: null, clientRequestId: reqId })
  }

  private async handleSwitchRoom(
    ws: WebSocket,
    msg: Extract<ClientToServerMessage, { type: "switch_room" }>,
    reqId: string | undefined,
  ): Promise<void> {
    const player = parsePlayerFromClientBody(msg.player)
    if (!player) {
      send(ws, { type: "error", code: "bad_player", message: "Некорректный профиль игрока", clientRequestId: reqId })
      return
    }
    const ctx = this.players.get(ws)!
    ctx.player = player
    ctx.userId = player.id
    if (ctx.roomId != null) {
      const prev = ctx.roomId
      await this.rooms.leaveRoom(player.id)
      this.broadcastRoom(prev, {
        type: "player_left",
        userId: player.id,
        liveCount: (await this.rooms.buildRoomState(prev)).livePlayers.length,
      })
      const admitted = await this.rooms.admitNextFromQueue(prev)
      if (admitted) await this.broadcastLobby()
    }
    ctx.roomId = null
    await this.handleJoinRoom(ws, { type: "join_room", roomId: msg.targetRoomId, player }, reqId)
  }

  private async handleSendMessage(
    ws: WebSocket,
    msg: Extract<ClientToServerMessage, { type: "send_message" }>,
    reqId: string | undefined,
  ): Promise<void> {
    const ctx = this.players.get(ws)
    if (!ctx?.player || ctx.roomId == null) {
      send(ws, { type: "error", code: "not_in_room", message: "Не в комнате", clientRequestId: reqId })
      return
    }
    const text = typeof msg.text === "string" ? msg.text.trim().slice(0, 2000) : ""
    if (!text) return
    const rl = await rateLimitWsRoomChat(ctx.player.id)
    if (!rl.ok) {
      send(ws, { type: "error", code: "rate_limited", message: "Слишком много сообщений", clientRequestId: reqId })
      return
    }
    const full = await this.chat.appendMessage(ctx.roomId, {
      senderId: ctx.player.id,
      senderName: ctx.player.name,
      text,
      timestamp: Date.now(),
    })
    this.broadcastRoom(ctx.roomId, {
      type: "new_message",
      roomId: ctx.roomId,
      message: full,
      clientRequestId: reqId,
    })
  }

  private async handleCreateRoom(
    ws: WebSocket,
    msg: Extract<ClientToServerMessage, { type: "create_room" }>,
    reqId: string | undefined,
  ): Promise<void> {
    const player = parsePlayerFromClientBody(msg.player)
    if (!player) {
      send(ws, { type: "error", code: "bad_player", message: "Некорректный профиль игрока", clientRequestId: reqId })
      return
    }
    const name = typeof msg.name === "string" ? msg.name : ""
    const meta = await addUserRoom(name, player.id)
    if (!meta) {
      send(ws, {
        type: "error",
        code: "insufficient_votes",
        message: "Нужно не менее 20 голосов для своей комнаты",
        clientRequestId: reqId,
      })
      return
    }
    send(ws, { type: "room_created", room: meta, clientRequestId: reqId })
    await this.broadcastLobby()
  }

  private async handleReconnect(
    ws: WebSocket,
    msg: Extract<ClientToServerMessage, { type: "reconnect" }>,
    reqId: string | undefined,
  ): Promise<void> {
    const player = parsePlayerFromClientBody(msg.player)
    if (!player) {
      send(ws, { type: "error", code: "bad_player", message: "Некорректный профиль игрока", clientRequestId: reqId })
      return
    }
    const ctx = this.players.get(ws)!
    ctx.player = player
    ctx.userId = player.id

    const session = await this.reconnect.getSession(player.id)
    const now = Date.now()
    const lastRoom = session?.roomId ?? msg.lastRoomId
    if (lastRoom == null) {
      await this.broadcastLobby()
      return
    }

    const disconnectedAt =
      session?.disconnectedAt ??
      (typeof msg.disconnectedAt === "number" && Number.isFinite(msg.disconnectedAt) ? msg.disconnectedAt : null)
    const withinGrace =
      session != null ||
      (disconnectedAt != null && now - disconnectedAt < RECONNECT_GRACE_SEC * 1000)
    const reg = await loadRoomRegistry()
    if (!reg.rooms.some((r) => r.roomId === lastRoom)) {
      await this.reconnect.clearSession(player.id)
      send(ws, { type: "error", code: "room_expired", message: "Комната истекла (TTL 24ч). Выберите другой стол.", clientRequestId: reqId })
      await this.broadcastLobby()
      return
    }

    const tryRejoin = async (roomId: number): Promise<boolean> => {
      const r = await joinSpecificRoom({
        player: toLivePlayer(player),
        roomId,
        maxTableSize: ROOM_MAX_PLAYERS,
      })
      return r.ok
    }

    if (withinGrace && (await tryRejoin(lastRoom))) {
      await this.finishSuccessfulRoomJoin(ws, ctx, player, lastRoom, reqId)
      return
    }

    const info = await getTableInfo(lastRoom)
    const liveN = info?.livePlayers.length ?? 0
    if (!withinGrace && liveN < ROOM_MAX_PLAYERS && (await tryRejoin(lastRoom))) {
      await this.finishSuccessfulRoomJoin(ws, ctx, player, lastRoom, reqId)
      return
    }

    await this.reconnect.clearSession(player.id)
    await this.handleJoinRoom(ws, { type: "join_room", roomId: lastRoom, player }, reqId)
  }

  private async finishSuccessfulRoomJoin(
    ws: WebSocket,
    ctx: ConnectionContext,
    player: Player,
    roomId: number,
    reqId: string | undefined,
  ): Promise<void> {
    await this.reconnect.clearSession(player.id)
    this.lobbySockets.delete(ws)
    ctx.roomId = roomId
    const state = await this.rooms.buildRoomState(roomId)
    const history = await this.chat.getHistory(roomId)
    send(ws, { type: "joined_room", roomId, clientRequestId: reqId })
    send(ws, { type: "room_state", state, clientRequestId: reqId })
    send(ws, { type: "chat_history", roomId, messages: history, clientRequestId: reqId })
    await this.broadcastLobby()
  }

  /** Доставка только локальным сокетам (в т.ч. из Redis Pub/Sub на других узлах). */
  private deliverRoomLocal(roomId: number, msg: ServerToClientMessage): void {
    const payload = JSON.stringify(msg)
    for (const sock of this.players.socketsInRoom(roomId)) {
      if (sock.readyState === sock.OPEN) sock.send(payload)
    }
  }

  private broadcastRoom(roomId: number, msg: ServerToClientMessage): void {
    if (getRedis()) {
      void publishWsRoomMessage(roomId, msg)
      return
    }
    this.deliverRoomLocal(roomId, msg)
  }

  private async broadcastLobby(): Promise<void> {
    const rows = await this.rooms.getLobbyRows()
    const payload = JSON.stringify({ type: "lobby_snapshot", rows } satisfies ServerToClientMessage)
    for (const sock of this.lobbySockets) {
      if (sock.readyState === sock.OPEN) sock.send(payload)
    }
  }
}

/** Глобальный синглтон для процесса WS (custom server) */
declare global {
  var __spindateWsRoomServer: WsRoomServer | undefined
}

export function getWsRoomServer(): WsRoomServer {
  if (!globalThis.__spindateWsRoomServer) {
    globalThis.__spindateWsRoomServer = new WsRoomServer()
  }
  return globalThis.__spindateWsRoomServer
}
