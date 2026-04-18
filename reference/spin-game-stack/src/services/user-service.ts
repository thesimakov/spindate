import { prisma } from "../db/prisma.js"
import { computePopularity } from "../domain/popularity.js"
import type { VkAuthBody } from "../auth/vk.js"

export async function upsertUserFromVk(body: VkAuthBody) {
  const popularity = computePopularity({
    kissesReceived: 0,
    giftsReceived: 0,
    likes: 0,
  })
  return prisma.user.upsert({
    where: { vkId: body.vkUserId },
    create: {
      vkId: body.vkUserId,
      username: body.username,
      avatar: body.avatar ?? null,
      gender: body.gender ?? null,
      age: body.age ?? null,
      popularity,
    },
    update: {
      username: body.username,
      avatar: body.avatar ?? undefined,
      gender: body.gender ?? undefined,
      age: body.age ?? undefined,
    },
  })
}

export async function recalcPopularity(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId } })
  if (!u) return
  const popularity = computePopularity({
    kissesReceived: u.kissesReceived,
    giftsReceived: u.giftsReceived,
    likes: u.likes,
  })
  if (popularity !== u.popularity) {
    await prisma.user.update({ where: { id: userId }, data: { popularity } })
  }
}
