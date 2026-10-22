// NFL weeks run Tuesday -> Monday (so Monday Night Football belongs to its own week).
// Week 1 starts on the Tuesday right after Labor Day (first Monday of September).
const DAY = 86_400_000

function week1Start(year: number): number {
  const sept1 = new Date(Date.UTC(year, 8, 1))
  const daysToMonday = (8 - sept1.getUTCDay()) % 7        // 0 if Sept 1 is a Monday
  return Date.UTC(year, 8, 1 + daysToMonday + 1)          // Labor Day + 1 = Tuesday
}

export function currentSeasonWeek(now = new Date()): { season: number; week: number } {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const year = now.getFullYear()
  const start = week1Start(year)
  if (today >= start) {
    return { season: year, week: Math.min(22, Math.floor((today - start) / (7 * DAY)) + 1) }
  }
  // Before this year's Week 1: Jan/Feb are still the previous season's playoffs, otherwise the offseason.
  if (now.getMonth() <= 1) {
    const prev = week1Start(year - 1)
    return { season: year - 1, week: Math.min(22, Math.floor((today - prev) / (7 * DAY)) + 1) }
  }
  return { season: year, week: 1 }
}
