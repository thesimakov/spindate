import { prisma } from "../db/prisma.js"

const REWARD_EACH = 25

export async function registerInvite(inviterUserId: string, inviteeVkId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.invite.findUnique({
      where: {
        inviterId_inviteeVkId: { inviterId: inviterUserId, inviteeVkId },
      },
    })
    if (existing) return
    await tx.invite.create({
      data: { inviterId: inviterUserId, inviteeVkId, rewardGiven: false },
    })
  })
}

/** Вызывать, когда приглашённый друг впервые зашёл по инвайту (по vk id). */
export async function completeInviteAndReward(inviteeVkId: string): Promise<void> {
  const pending = await prisma.invite.findFirst({
    where: { inviteeVkId, rewardGiven: false },
  })
  if (!pending) return
  await prisma.$transaction(async (tx) => {
    await tx.invite.update({
      where: { id: pending.id },
      data: { rewardGiven: true },
    })
    await tx.user.update({
      where: { id: pending.inviterId },
      data: { coins: { increment: REWARD_EACH } },
    })
    const invitee = await tx.user.findUnique({ where: { vkId: inviteeVkId } })
    if (invitee) {
      await tx.user.update({
        where: { id: invitee.id },
        data: { coins: { increment: REWARD_EACH } },
      })
    }
  })
}
