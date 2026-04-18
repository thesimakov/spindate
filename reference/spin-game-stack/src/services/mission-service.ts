import { prisma } from "../db/prisma.js"

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export async function ensureDefaultMissions(): Promise<void> {
  const defaults = [
    { key: "kiss_5", title: "Поцеловать 5 игроков", targetCount: 5, rewardCoins: 50 },
    { key: "gifts_2", title: "Отправить 2 подарка", targetCount: 2, rewardCoins: 30 },
    { key: "games_3", title: "Сыграть 3 раунда", targetCount: 3, rewardCoins: 40 },
  ]
  for (const m of defaults) {
    await prisma.dailyMission.upsert({
      where: { key: m.key },
      create: m,
      update: { title: m.title, targetCount: m.targetCount, rewardCoins: m.rewardCoins },
    })
  }
}

type MissionKind = "kiss" | "gift" | "spin"

export async function recordMissionProgress(
  userId: string,
  kind: MissionKind,
): Promise<{ completed: boolean; rewardCoins?: number; missionKey?: string } | null> {
  await ensureDefaultMissions()
  const day = utcDay()
  const keyMap: Record<MissionKind, string> = {
    kiss: "kiss_5",
    gift: "gifts_2",
    spin: "games_3",
  }
  const missionKey = keyMap[kind]
  const mission = await prisma.dailyMission.findUnique({ where: { key: missionKey } })
  if (!mission) return null

  return prisma.$transaction(async (tx) => {
    const existing = await tx.missionProgress.findUnique({
      where: {
        userId_missionId_day: { userId, missionId: mission.id, day },
      },
    })
    if (existing?.completed) {
      return { completed: false }
    }

    const nextProgress = (existing?.progress ?? 0) + 1
    const justCompleted = nextProgress >= mission.targetCount

    await tx.missionProgress.upsert({
      where: {
        userId_missionId_day: { userId, missionId: mission.id, day },
      },
      create: {
        userId,
        missionId: mission.id,
        day,
        progress: nextProgress,
        completed: justCompleted,
      },
      update: {
        progress: nextProgress,
        completed: justCompleted,
      },
    })

    if (justCompleted && !existing?.completed) {
      await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: mission.rewardCoins } },
      })
      return { completed: true, rewardCoins: mission.rewardCoins, missionKey }
    }

    return { completed: false }
  })
}
