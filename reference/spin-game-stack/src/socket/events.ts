/**
 * Канонические имена событий Socket.io (клиент ↔ сервер).
 * Namespace по умолчанию: /
 */

/** Клиент → сервер */
export const ClientEvents = {
  joinRoom: "join_room",
  leaveRoom: "leave_room",
  spinBottle: "spin_bottle",
  kissPlayer: "kiss_player",
  sendGift: "send_gift",
  chatMessage: "chat_message",
} as const

/** Сервер → клиент */
export const ServerEvents = {
  roomState: "room_state",
  spinResult: "spin_result",
  kissResult: "kiss_result",
  giftSent: "gift_sent",
  chatMessage: "chat_message",
  secretKissNotification: "secret_kiss_notification",
  error: "error",
  missionProgress: "mission_progress",
} as const

export type JoinRoomPayload = { roomId: string }
export type LeaveRoomPayload = { roomId: string }
export type SpinBottlePayload = { roomId: string }
export type KissPlayerPayload = {
  roomId: string
  targetUserId: string
  action: "kiss" | "reject" | "gift"
  giftCatalogId?: string
  anonymous?: boolean
}
export type SendGiftPayload = { roomId: string; targetUserId: string; giftCatalogId: string }
export type ChatMessagePayload = { roomId: string; text: string }

export type RoomStatePayload = {
  roomId: string
  name: string
  maxPlayers: number
  currentPlayers: number
  playerIds: string[]
}

export type SpinResultPayload = {
  roomId: string
  spinnerUserId: string
  targetUserId: string
}

export type ChatBroadcastPayload = {
  roomId: string
  userId: string
  username: string
  text: string
  ts: number
}
