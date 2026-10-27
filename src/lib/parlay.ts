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

// How each market turns into a leg description, so the add-leg form can build the text instead of the user typing it.
//   td   -> "<player> <label>"                      e.g. "Derrick Henry anytime TD"
//   line -> "<player> over|under <line> <label>"    e.g. "Josh Allen over 249.5 passing yards"
//   free -> the user types the whole description    e.g. "Chiefs -3.5"
export type MarketKind = 'td' | 'line' | 'free'
export type MarketCfg = { kind: MarketKind; label?: string; placeholder?: string; subjectOptional?: boolean }
const line = (label: string, subjectOptional = false): MarketCfg => ({ kind: 'line', label, subjectOptional })
export const MARKET_CFG: Record<string, MarketCfg> = {
  'Anytime TD': { kind: 'td', label: 'anytime TD' },
  'First TD': { kind: 'td', label: 'first TD' },
  '2+ TDs': { kind: 'td', label: '2+ TDs' },
  'Passing yards': line('passing yards'),
  'Passing TDs': line('passing TDs'),
  'Pass completions': line('pass completions'),
  'Rushing yards': line('rushing yards'),
  'Receiving yards': line('receiving yards'),
  'Rushing Attempts': line('rushing attempts'),
  'Receptions': line('receptions'),
  'Rush + rec yards': line('rush + rec yards'),
  'Combined TDs': line('combined TDs'),
  'Combined Rushing Yards': line('combined rushing yards'),
  'Combined Receiving Yards': line('combined receiving yards'),
  'Interceptions': line('interceptions'),
  'Sacks': line('sacks'),
  'Tackles': line('tackles'),
  'Kicker points': line('kicker points'),
  'Total points': line('total points', true),
  'Line / spread': { kind: 'free', placeholder: 'Chiefs -3.5' },
  'Head to head': { kind: 'free', placeholder: 'Chiefs to beat Bills' },
  'Other': { kind: 'free', placeholder: 'Describe the leg' },
}
export const marketCfg = (m: string): MarketCfg => MARKET_CFG[m] ?? { kind: 'free', placeholder: 'Describe the leg' }

// One-tap markets. Everything else lives in the "More markets" dropdown.
export const TOP_MARKETS = ['Anytime TD', 'Passing yards', 'Rushing yards', 'Receiving yards', 'Receptions', 'Line / spread']

// Pull the player or team name off the front of a description ("Derrick Henry anytime TD" -> "Derrick Henry").
// Only used for suggestions, so a rough match is fine.
export function playerFrom(description: string): string | null {
  const m = description.trim().match(/^([A-Z][\w'.\-]*(?:\s+[A-Z][\w'.\-]*){0,2})/)
  return m ? m[1] : null
}

// Most frequently used names first.
export function topPlayers(descriptions: string[]): string[] {
  const counts = new Map<string, number>()
  for (const d of descriptions) { const p = playerFrom(d); if (p) counts.set(p, (counts.get(p) ?? 0) + 1) }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p)
}
