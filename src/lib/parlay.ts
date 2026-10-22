export type Result = 'pending' | 'hit' | 'miss' | 'push'
export type Member = { id: string; name: string }
export type Leg = { id: string; parlay_id: string; member_id: string; description: string; market: string; odds: number | null; result: Result; created_at: string }
export type Parlay = { id: string; season: number; week: number; stake: number; payout: number }

export const MARKETS = ['Passing yards', 'Rushing yards', 'Receiving yards', 'Anytime TD', 'Spread', 'Moneyline', 'Total', 'Other']

export type Status = 'empty' | 'live' | 'hit' | 'missed'
export function parlayStatus(legs: Leg[]): Status {
  if (!legs.length) return 'empty'
  if (legs.some(l => l.result === 'miss')) return 'missed'
  if (legs.some(l => l.result === 'pending')) return 'live'
  return 'hit' // every leg hit or pushed
}
export const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toFixed(2)
