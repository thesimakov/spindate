/** Ежедневная серия: дни 1–6 — «сердца» (голоса), день 7 — розы, день 8 — супер-рамка (начисление — отдельно). */

export const DAILY_STREAK_DAY_COUNT = 8

export type DailyStreakReward =
  | { kind: "hearts"; amount: number }
  | { kind: "roses"; amount: number }
  /** Косметическая рамка; начисление в игру подключается отдельно */
  | { kind: "frame"; id: "super" }

export const DAILY_STREAK_REWARDS: readonly DailyStreakReward[] = [
  { kind: "hearts", amount: 150 },
  { kind: "hearts", amount: 200 },
  { kind: "hearts", amount: 250 },
  { kind: "hearts", amount: 300 },
  { kind: "hearts", amount: 450 },
  { kind: "hearts", amount: 500 },
  { kind: "roses", amount: 30 },
  { kind: "frame", id: "super" },
]

export function getDailyStreakReward(day: number): DailyStreakReward | undefined {
  if (day < 1 || day > DAILY_STREAK_DAY_COUNT) return undefined
  return DAILY_STREAK_REWARDS[day - 1]
}

/** Следующий активный день серии до клейма сегодня (не после клейма). */
export function computeNextStreakDay(
  lastClaimDate: string | undefined,
  streakDay: number,
  todayKey: string,
  yesterdayKey: string,
): number {
  if (lastClaimDate === todayKey) {
    return Math.min(DAILY_STREAK_DAY_COUNT, Math.max(1, streakDay || 1))
  }
  if (lastClaimDate === yesterdayKey) {
    if (streakDay >= DAILY_STREAK_DAY_COUNT) return 1
    return Math.min(DAILY_STREAK_DAY_COUNT, (streakDay || 0) + 1)
  }
  return 1
}
