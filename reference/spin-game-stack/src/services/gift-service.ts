import { prisma } from "../db/prisma.js"
import { recalcPopularity } from "./user-service.js"

export async function purchaseGift(userId: string, giftCatalogId: string) {
  const gift = await prisma.giftCatalog.findUnique({ where: { id: giftCatalogId } })
  if (!gift) throw new Error("gift_not_found")

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error("user_not_found")
    if (user.coins < gift.price) throw new Error("insufficient_coins")
    await tx.user.update({
      where: { id: userId },
      data: { coins: { decrement: gift.price } },
    })
    await tx.giftPurchase.create({
      data: { userId, giftId: giftCatalogId },
    })
  })
}

export async function applyGiftToReceiver(receiverId: string) {
  await prisma.user.update({
    where: { id: receiverId },
    data: {
      giftsReceived: { increment: 1 },
    },
  })
  await recalcPopularity(receiverId)
}
