import type { GeneralChatMessage, Player, TableAuthorityPayload } from "@/lib/game-types"
import type { BottleSkin } from "@/lib/game-types"
import type { RoomTableStyle } from "@/lib/rooms/room-appearance"

/** Метаданные комнаты в лобби (стол = roomId из live-tables / authority) */
export interface RoomMeta {
  roomId: number
  name: string
  bottleSkin?: BottleSkin
  tableStyle?: RoomTableStyle
  /** Создана пользователем после 20 голосов */
  isUserRoom?: boolean
  createdByUserId?: number
  /** Unix ms: время создания пользовательской комнаты (TTL 24ч). */
  createdAtMs?: number
}

export interface RoomRegistryState {
  rooms: RoomMeta[]
  nextRoomId: number
}

/** Снимок для клиента: лобби */
export interface LobbyRoomRow {
  roomId: number
  name: string
  bottleSkin?: BottleSkin
  tableStyle?: RoomTableStyle
  isUserRoom?: boolean
  createdByUserId?: number
  createdAtMs?: number
  livePlayerCount: number
  maxPlayers: number
}

/** Полное состояние комнаты для WS room_state */
export interface RoomStatePayload {
  roomId: number
  name: string
  maxPlayers: number
  livePlayers: Player[]
  /** Боты присутствуют только в authority; здесь флаг для UI */
  botCount: number
  gameState: TableAuthorityPayload | null
  chatId: string
}

export interface QueueEntry {
  userId: number
  player: Player
  /** Комната, в которую хотели изначально */
  requestedRoomId: number
  enqueuedAt: number
}

/** Сессия реконнекта (TTL 60 с на стороне Redis) */
export interface ReconnectSession {
  roomId: number
  disconnectedAt: number
}

/** Client → Server */
export type ClientToServerMessage =
  | { type: "join_room"; roomId: number; player: Player; clientRequestId?: string }
  | { type: "leave_room"; clientRequestId?: string }
  | { type: "switch_room"; targetRoomId: number; player: Player; clientRequestId?: string }
  | { type: "send_message"; text: string; clientRequestId?: string }
  | { type: "reconnect"; player: Player; lastRoomId?: number; disconnectedAt?: number; clientRequestId?: string }
  | { type: "create_room"; name: string; player: Player; clientRequestId?: string }

/** Server → Client */
export type ServerToClientMessage =
  | { type: "room_state"; state: RoomStatePayload; clientRequestId?: string }
  | { type: "player_joined"; player: Player; liveCount: number; clientRequestId?: string }
  | { type: "player_left"; userId: number; liveCount: number; clientRequestId?: string }
  | { type: "chat_history"; roomId: number; messages: GeneralChatMessage[]; clientRequestId?: string }
  | { type: "new_message"; roomId: number; message: GeneralChatMessage; clientRequestId?: string }
  | { type: "queue_update"; position: number | null; reason?: string; clientRequestId?: string }
  | { type: "lobby_snapshot"; rows: LobbyRoomRow[] }
  | { type: "error"; code: string; message: string; clientRequestId?: string }
  | { type: "joined_room"; roomId: number; redirectedFrom?: number; clientRequestId?: string }
  | { type: "room_created"; room: RoomMeta; clientRequestId?: string }
