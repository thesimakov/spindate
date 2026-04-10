/**
 * Календарные границы периодов в часовом поясе Europe/Moscow (фиксированный UTC+3).
 */

export const RATING_TIMEZONE = "Europe/Moscow"
const MSK_OFFSET = "+03:00"

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Календарная дата (год, месяц 1–12, день) в MSK для момента `ref`. */
export function mskCalendarParts(ref: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RATING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref)
  const y = Number(parts.find((p) => p.type === "year")?.value)
  const m = Number(parts.find((p) => p.type === "month")?.value)
  const d = Number(parts.find((p) => p.type === "day")?.value)
  return { y, m, d }
}

/** Мгновение UTC (ms): календарные Y-M-D и время в MSK как на стенных часах. */
function mskWallToUtcMs(y: number, m: number, d: number, hh: number, mm: number, ss: number, ms: number): number {
  const iso = `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}.${String(ms).padStart(3, "0")}${MSK_OFFSET}`
  return Date.parse(iso)
}

/** Понедельник = 0 … воскресенье = 6 (по календарю MSK для этого момента). */
function mskWeekdayMon0Sun6(ref: Date): number {
  const short = new Intl.DateTimeFormat("en-GB", {
    timeZone: RATING_TIMEZONE,
    weekday: "short",
  }).format(ref)
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  return map[short] ?? 0
}

export type RatingPeriod = "day" | "week" | "month"

/**
 * Полуинтервал [startMs, endMs) в UTC для календарного периода, содержащего `ref`, в MSK.
 */
export function getRatingPeriodBounds(ref: Date, period: RatingPeriod): { startMs: number; endMs: number } {
  const { y, m, d } = mskCalendarParts(ref)

  if (period === "day") {
    const startMs = mskWallToUtcMs(y, m, d, 0, 0, 0, 0)
    const endMs = startMs + 24 * 60 * 60 * 1000
    return { startMs, endMs }
  }

  if (period === "month") {
    const startMs = mskWallToUtcMs(y, m, 1, 0, 0, 0, 0)
    const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
    const endMs = mskWallToUtcMs(nextMonth.y, nextMonth.m, 1, 0, 0, 0, 0)
    return { startMs, endMs }
  }

  // week: календарная неделя пн 00:00 – вс (след. пн не вкл.) по MSK
  let cur = mskWallToUtcMs(y, m, d, 0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const w = mskWeekdayMon0Sun6(new Date(cur + 12 * 60 * 60 * 1000))
    if (w === 0) {
      const weekStart = cur
      return { startMs: weekStart, endMs: weekStart + 7 * 24 * 60 * 60 * 1000 }
    }
    cur -= 24 * 60 * 60 * 1000
  }
  const fallback = mskWallToUtcMs(y, m, d, 0, 0, 0, 0)
  return { startMs: fallback, endMs: fallback + 7 * 24 * 60 * 60 * 1000 }
}
