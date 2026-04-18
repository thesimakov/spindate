/** Синхронизировать с `lib/spin-game-events.ts` и reference/spin-game-stack. */

export const ClientEvents = {
  joinRoom: "join_room",
  leaveRoom: "leave_room",
  spinBottle: "spin_bottle",
  kissPlayer: "kiss_player",
  sendGift: "send_gift",
  chatMessage: "chat_message",
} as const

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
