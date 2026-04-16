export const GIFT_RATING_TYPE_IDS = [
  "rose",
  "flowers",
  "song",
  "diamond",
  "gift_voice",
  "tools",
  "lipstick",
  "toy_bear",
  "toy_car",
  "toy_ball",
  "souvenir_magnet",
  "souvenir_keychain",
  "plush_heart",
  "chocolate_box",
] as const

export const GIFT_RATING_TYPE_SET = new Set<string>(GIFT_RATING_TYPE_IDS)

export function isGiftRatingType(id: string): boolean {
  return GIFT_RATING_TYPE_SET.has(String(id ?? "").trim())
}

export const GIFT_ACHIEVEMENT_KEY = "gift_newbie" as const
export const GIFT_ACHIEVEMENT_TITLE = "Новичок"
export const GIFT_ACHIEVEMENT_TARGET = 1
export const GIFT_ACHIEVEMENT_IMAGE_PATH = "/assets/achievement-gift-newbie.png"

export type GiftAchievementProgress = {
  key: typeof GIFT_ACHIEVEMENT_KEY
  title: string
  current: number
  target: number
  unlocked: boolean
  unlockedAt: number | null
}

export type GiftProgressStats = {
  giftsSentCount: number
  heartsSpent: number
  rosesSpent: number
  achievement: GiftAchievementProgress
}
