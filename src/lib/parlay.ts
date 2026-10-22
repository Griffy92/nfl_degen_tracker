export type Result = 'pending' | 'hit' | 'miss' | 'push'
export type Member = { id: string; name: string }
export type Leg = { id: string; parlay_id: string; member_id: string; description: string; market: string; odds: number | null; result: Result; created_at: string }
export type Parlay = { id: string; season: number; week: number; name: string | null; slip_odds: number | null; stake: number; payout: number }

export const MARKETS = [
  'Anytime TD', 'First TD', '2+ TDs', 'Passing yards', 'Passing TDs', 'Pass completions', 'Rushing yards',
  'Receiving yards', 'Rushing Attempts', 'Receptions', 'Rush + rec yards', 'Combined TDs', 'Combined Rushing Yards', 'Combined Receiving Yards', 'Interceptions', 'Sacks', 'Tackles', 'Kicker points',
  'Line / spread', 'Head to head', 'Total points', 'Other',
]

export type Status = 'empty' | 'live' | 'hit' | 'missed'
export function parlayStatus(legs: Leg[]): Status {
  if (!legs.length) return 'empty'
  if (legs.some(l => l.result === 'miss')) return 'missed'
  if (legs.some(l => l.result === 'pending')) return 'live'
  return 'hit' // every leg hit or pushed
}

// Multiplier for the whole parlay: legs multiplied together, pushed legs count as 1.00.
export function combinedOdds(legs: Leg[]): number | null {
  const live = legs.filter(l => l.result !== 'push')
  if (!legs.length || live.some(l => l.odds == null)) return null
  return live.reduce((t, l) => t * Number(l.odds), 1)
}
export const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2)
