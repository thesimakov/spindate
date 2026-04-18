import { prisma } from "../db/prisma.js"

export async function joinRoom(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) throw new Error("room_not_found")
  if (room.currentPlayers >= room.maxPlayers) throw new Error("room_full")

  await prisma.$transaction(async (tx) => {
    const existing = await tx.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    })
    if (existing) return
    await tx.roomMember.create({ data: { roomId, userId } })
    await tx.room.update({
      where: { id: roomId },
      data: { currentPlayers: { increment: 1 } },
    })
  })
}

export async function leaveRoom(roomId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    })
    if (!existing) return
    await tx.roomMember.delete({ where: { roomId_userId: { roomId, userId } } })
    await tx.room.update({
      where: { id: roomId },
      data: { currentPlayers: { decrement: 1 } },
    })
  })
}

export async function getRoomPlayerIds(roomId: string): Promise<string[]> {
  const rows = await prisma.roomMember.findMany({
    where: { roomId },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

export async function getRoomSnapshot(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) return null
  const playerIds = await getRoomPlayerIds(roomId)
  return {
    roomId: room.id,
    name: room.name,
    maxPlayers: room.maxPlayers,
    currentPlayers: room.currentPlayers,
    playerIds,
  }
}
