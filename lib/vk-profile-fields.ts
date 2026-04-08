/** Поля профиля VK (bridge): возраст, зодиак, пол. Без привязки к React / Node-only API. */

const ZODIAC_RANGES: [number, number, string][] = [
  [120, 219, "Водолей"],
  [220, 320, "Рыбы"],
  [321, 420, "Овен"],
  [421, 520, "Телец"],
  [521, 621, "Близнецы"],
  [622, 722, "Рак"],
  [723, 822, "Лев"],
  [823, 922, "Дева"],
  [923, 1022, "Весы"],
  [1023, 1121, "Скорпион"],
  [1122, 1221, "Стрелец"],
  [1222, 1319, "Козерог"],
]

function zodiacFromMonthDay(month: number, day: number): string {
  const code = month * 100 + day
  if (code >= 1222 || code <= 119) return "Козерог"
  for (const [from, to, sign] of ZODIAC_RANGES) {
    if (code >= from && code <= to) return sign
  }
  return ""
}

/** Пол из поля sex VK: 1 — женский, 2 — мужской */
export function vkGenderFromSex(sex: number | undefined): "male" | "female" | undefined {
  if (sex === 2) return "male"
  if (sex === 1) return "female"
  return undefined
}

/**
 * Дата рождения из VK: "D.M.YYYY" (полный год обязателен для возраста).
 */
export function parseAgeFromVkBdate(bdate: string): number | null {
  const parts = bdate.split(".")
  if (parts.length < 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)
  const yMax = new Date().getFullYear()
  if (!day || !month || !year || year < 1900 || year > yMax) return null
  const now = new Date()
  let age = now.getFullYear() - year
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--
  return age >= 14 && age <= 120 ? age : null
}

/** Знак по дню и месяцу ("D.M" или "D.M.YYYY"). */
export function parseZodiacFromVkBdate(bdate: string): string {
  const parts = bdate.split(".")
  if (parts.length < 2) return ""
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  if (!day || !month) return ""
  return zodiacFromMonthDay(month, day)
}
