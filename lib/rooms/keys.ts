/** Префикс ключей Redis для подсистемы комнат (рядом с spindate:v1:...) */
export const ROOMS_PREFIX = "spindate:v1:rooms"

export function roomsRegistryKey(): string {
  return `${ROOMS_PREFIX}:registry`
}

export function roomChatKey(roomId: number): string {
  return `${ROOMS_PREFIX}:chat:${roomId}`
}

export function roomQueueKey(): string {
  return `${ROOMS_PREFIX}:waitqueue`
}

export function reconnectSessionKey(userId: number): string {
  return `${ROOMS_PREFIX}:reconnect:${userId}`
}

export function userRoomVotesKey(userId: number): string {
  return `${ROOMS_PREFIX}:votes:${userId}`
}
