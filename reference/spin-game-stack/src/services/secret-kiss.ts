import { prisma } from "../db/prisma.js"
import { recalcPopularity } from "./user-service.js"

const REVEAL_COST = 50

export async function createSecretKiss(senderId: string, receiverId: string) {
  if (senderId === receiverId) throw new Error("invalid_target")
  await prisma.secretKiss.create({
    data: { senderId, receiverId, revealed: false },
  })
  await notifyReceiverSecretKiss(receiverId)
}

export async function revealSecretKiss(userId: string, secretKissId: string) {
  await prisma.$transaction(async (tx) => {
    const row = await tx.secretKiss.findUnique({ where: { id: secretKissId } })
    if (!row || row.receiverId !== userId) throw new Error("forbidden")
    if (row.revealed) return
    const u = await tx.user.findUnique({ where: { id: userId } })
    if (!u || u.coins < REVEAL_COST) throw new Error("insufficient_coins")
    await tx.user.update({
      where: { id: userId },
      data: { coins: { decrement: REVEAL_COST } },
    })
    await tx.secretKiss.update({
      where: { id: secretKissId },
      data: { revealed: true },
    })
  })
}

export async function notifyReceiverSecretKiss(receiverId: string): Promise<void> {
  await prisma.user.update({
    where: { id: receiverId },
    data: { kissesReceived: { increment: 1 } },
  })
  await recalcPopularity(receiverId)
}
