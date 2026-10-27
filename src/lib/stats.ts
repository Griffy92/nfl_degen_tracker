import { combinedOdds, nameKey, parlayStatus, subjectOf, type Leg, type Member, type Parlay, type Status } from './parlay'

// Everything here is plain functions over legs / parlays / members so the Stats page stays thin and this can be tested.
// A leg counts toward hit rates only once it is settled (hit or miss). Pushes and pending legs don't.

export const isSettled = (l: Leg) => l.result === 'hit' || l.result === 'miss'

export function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const bucket = out.get(k)
    if (bucket) bucket.push(x); else out.set(k, [x])
  }
  return out
}

const byTime = (a: Leg, b: Leg) => a.created_at.localeCompare(b.created_at)
const mostCommon = (xs: string[]) => {
  const c = new Map<string, number>()
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

// ---------- Hit rate vs what the odds imply ----------
export type Agg = {
  n: number          // settled legs
  hits: number
  rate: number       // hits / settled
  priced: number     // settled legs that have odds
  avgOdds: number    // average odds across priced legs (0 if none)
  implied: number    // average chance the odds imply (1 / odds) across priced legs
  edge: number | null // hit rate of priced legs minus implied chance; null when nothing is priced
  flat: number       // result of betting $1 on each priced leg on its own
}
export function agg(xs: Leg[]): Agg {
  const done = xs.filter(isSettled)
  const hits = done.filter(l => l.result === 'hit').length
  const priced = done.filter(l => l.odds != null)
  const pricedHits = priced.filter(l => l.result === 'hit').length
  const implied = priced.length ? priced.reduce((t, l) => t + 1 / Number(l.odds), 0) / priced.length : 0
  return {
    n: done.length, hits, rate: done.length ? hits / done.length : 0,
    priced: priced.length,
    avgOdds: priced.length ? priced.reduce((t, l) => t + Number(l.odds), 0) / priced.length : 0,
    implied,
    edge: priced.length ? pricedHits / priced.length - implied : null,
    flat: priced.reduce((t, l) => t + (l.result === 'hit' ? Number(l.odds) - 1 : -1), 0),
  }
}

// ---------- Streaks ----------
export type Runs = { bestHit: number; bestMiss: number; current: { type: 'hit' | 'miss'; n: number } | null }
export function runs(legs: Leg[]): Runs {
  let bestHit = 0, bestMiss = 0, n = 0
  let type: 'hit' | 'miss' | null = null
  for (const l of legs.filter(isSettled).sort(byTime)) {
    const r = l.result as 'hit' | 'miss'
    if (r === type) n++; else { type = r; n = 1 }
    if (type === 'hit') bestHit = Math.max(bestHit, n); else bestMiss = Math.max(bestMiss, n)
  }
  return { bestHit, bestMiss, current: type ? { type, n } : null }
}

// ---------- Players (and teams) ----------
export type PlayerRow = Agg & {
  key: string
  name: string
  legs: number                              // every leg on this name, settled or not
  misses: number
  killed: number                            // parlays this name's leg was the only miss on
  backers: { name: string; n: number }[]    // who picked this name, most first
  unsaved: number                           // legs whose name is only a guess from the description
  spellings: number                         // distinct spellings in use ("Derrick Henry" vs "derrick henry")
}
export function playerRows(legs: Leg[], members: Member[]): PlayerRow[] {
  const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'
  const groups = new Map<string, Leg[]>()
  for (const l of legs) {
    const s = subjectOf(l)
    if (!s) continue
    const k = nameKey(s)
    const bucket = groups.get(k)
    if (bucket) bucket.push(l); else groups.set(k, [l])
  }

  const killed = new Map<string, number>()
  for (const pl of groupBy(legs, l => l.parlay_id).values()) {
    const missed = pl.filter(l => l.result === 'miss')
    if (missed.length !== 1 || pl.some(l => l.result === 'pending')) continue
    const s = subjectOf(missed[0])
    if (s) killed.set(nameKey(s), (killed.get(nameKey(s)) ?? 0) + 1)
  }

  return [...groups.entries()].map(([key, ls]) => {
    const a = agg(ls)
    const backers = [...groupBy(ls, l => l.member_id).entries()].map(([id, x]) => ({ name: nameOf(id), n: x.length })).sort((p, q) => q.n - p.n)
    return {
      ...a, key, name: mostCommon(ls.map(l => subjectOf(l) as string)),
      legs: ls.length, misses: a.n - a.hits, killed: killed.get(key) ?? 0, backers,
      unsaved: ls.filter(l => !l.subject?.trim()).length,
      spellings: new Set(ls.map(l => subjectOf(l))).size,
    }
  })
}

// ---------- Per-person profile ----------
type Mark = { k: string; rate: number; n: number }
// Best and worst of a set of rates, ignoring anything with too few settled legs to mean much.
function extremes(rows: Mark[], min: number): { best: Mark | null; worst: Mark | null } {
  const ok = rows.filter(r => r.n >= min).sort((a, b) => b.rate - a.rate || b.n - a.n)
  if (!ok.length) return { best: null, worst: null }
  const best = ok[0], worst = ok[ok.length - 1]
  return { best, worst: worst === best || worst.rate === best.rate ? null : worst }
}
export type Profile = {
  m: Member
  legs: number
  a: Agg
  runs: Runs
  favMarket: { k: string; n: number } | null
  bestMarket: Mark | null
  worstMarket: Mark | null
  favPlayer: { name: string; n: number; rate: number; settled: number } | null
  topPlayers: { name: string; n: number; hits: number; settled: number }[]
  bestPlayer: Mark | null
  worstPlayer: Mark | null
  longshot: Leg | null                      // their highest-odds leg that hit
}
export const MIN_MARKET_LEGS = 3
export const MIN_PLAYER_LEGS = 2
export function profiles(legs: Leg[], members: Member[]): Profile[] {
  return members.map(m => {
    const mine = legs.filter(l => l.member_id === m.id)
    const done = mine.filter(isSettled)

    const markets = [...groupBy(mine, l => l.market).entries()].map(([k, ls]) => ({ k, n: ls.length, a: agg(ls) })).sort((x, y) => y.n - x.n)
    const mk = extremes(markets.map(x => ({ k: x.k, rate: x.a.rate, n: x.a.n })), MIN_MARKET_LEGS)

    const named = mine.filter(l => subjectOf(l))
    const players = [...groupBy(named, l => nameKey(subjectOf(l) as string)).values()].map(ls => {
      const a = agg(ls)
      return { name: mostCommon(ls.map(l => subjectOf(l) as string)), n: ls.length, hits: a.hits, settled: a.n, rate: a.rate }
    }).sort((x, y) => y.n - x.n || y.rate - x.rate)
    const pl = extremes(players.map(x => ({ k: x.name, rate: x.rate, n: x.settled })), MIN_PLAYER_LEGS)

    const landed = done.filter(l => l.result === 'hit' && l.odds != null).sort((x, y) => Number(y.odds) - Number(x.odds))
    return {
      m, legs: mine.length, a: agg(mine), runs: runs(mine),
      favMarket: markets[0] ? { k: markets[0].k, n: markets[0].n } : null,
      bestMarket: mk.best, worstMarket: mk.worst,
      favPlayer: players[0] ? { name: players[0].name, n: players[0].n, rate: players[0].rate, settled: players[0].settled } : null,
      topPlayers: players.slice(0, 3).map(p => ({ name: p.name, n: p.n, hits: p.hits, settled: p.settled })),
      bestPlayer: pl.best ? { ...pl.best } : null, worstPlayer: pl.worst ? { ...pl.worst } : null,
      longshot: landed[0] ?? null,
    }
  })
}

// Hit rate for every market, split by person (rows are markets, one cell per member id).
export type MatrixRow = { market: string; total: number; byMember: Record<string, Agg> }
export function marketMatrix(legs: Leg[], members: Member[]): MatrixRow[] {
  return [...groupBy(legs.filter(isSettled), l => l.market).entries()].map(([market, ls]) => ({
    market, total: ls.length,
    byMember: Object.fromEntries(members.map(m => [m.id, agg(ls.filter(l => l.member_id === m.id))])),
  })).sort((a, b) => b.total - a.total)
}

// ---------- What kind of bet it was ----------
export function betShape(l: Leg): string {
  const d = l.description
  if (/\bunder\s+\d/i.test(d)) return 'Unders'
  if (/\bover\s+\d/i.test(d)) return 'Overs'
  if (/\d+(\.\d+)?\s*\+/.test(d)) return 'X+ (alternate lines)'
  if (l.market === 'Anytime TD' || l.market === 'First TD') return 'TD scorer'
  if (l.market === 'Line / spread' || l.market === 'Head to head') return 'Sides (spread / head to head)'
  return 'Other'
}
export function shapeRows(legs: Leg[]): ({ label: string } & Agg)[] {
  return [...groupBy(legs, betShape).entries()].map(([label, ls]) => ({ label, ...agg(ls) })).filter(r => r.n).sort((a, b) => b.n - a.n)
}

// ---------- Parlays ----------
export type ParlayInfo = { p: Parlay; legs: Leg[]; status: Status; net: number }
export function parlayInfos(parlays: Parlay[], legs: Leg[]): ParlayInfo[] {
  const by = groupBy(legs, l => l.parlay_id)
  return parlays.map(p => {
    const ls = by.get(p.id) ?? []
    return { p, legs: ls, status: parlayStatus(ls), net: (Number(p.payout) || 0) - (Number(p.stake) || 0) }
  })
}
export const isDone = (i: ParlayInfo) => i.status === 'hit' || i.status === 'missed'
const inOrder = (a: ParlayInfo, b: ParlayInfo) => a.p.season - b.p.season || a.p.week - b.p.week || (a.p.created_at ?? '').localeCompare(b.p.created_at ?? '')

// Parlay-level hit rate by how many legs it had.
export function sizeRows(infos: ParlayInfo[]) {
  const done = infos.filter(isDone)
  const bucket = (n: number) => (n >= 6 ? '6+' : String(n))
  return [...groupBy(done, i => bucket(i.legs.length)).entries()].map(([size, xs]) => {
    const won = xs.filter(i => i.status === 'hit').length
    return { size, parlays: xs.length, won, rate: won / xs.length, net: xs.reduce((t, i) => t + i.net, 0), staked: xs.reduce((t, i) => t + (Number(i.p.stake) || 0), 0) }
  }).sort((a, b) => parseInt(a.size) - parseInt(b.size))
}

export type WeekRow = { season: number; week: number; parlays: number; won: number; net: number }
export function weekRows(infos: ParlayInfo[]): WeekRow[] {
  return [...groupBy(infos.filter(isDone), i => `${i.p.season}-${i.p.week}`).values()].map(xs => ({
    season: xs[0].p.season, week: xs[0].p.week, parlays: xs.length,
    won: xs.filter(i => i.status === 'hit').length, net: xs.reduce((t, i) => t + i.net, 0),
  })).sort((a, b) => a.season - b.season || a.week - b.week)
}

// Running total of net winnings, one point per settled parlay in the order they were played.
export function runningNet(infos: ParlayInfo[]): number[] {
  let total = 0
  return infos.filter(isDone).sort(inOrder).map(i => (total += i.net))
}

// ---------- Close calls: parlays that lost on exactly one leg ----------
export type CloseCall = { info: ParlayInfo; killer: Leg; wouldHavePaid: number | null }
export function closeCalls(infos: ParlayInfo[]): CloseCall[] {
  const out: CloseCall[] = []
  for (const info of infos) {
    const missed = info.legs.filter(l => l.result === 'miss')
    if (info.legs.length < 2 || missed.length !== 1 || info.legs.some(l => l.result === 'pending')) continue
    // Same rule the parlay card uses: the bookie's slip odds, unless a push changed the real price.
    const slip = info.p.slip_odds == null ? null : Number(info.p.slip_odds)
    const mult = slip != null && !info.legs.some(l => l.result === 'push') ? slip : combinedOdds(info.legs)
    const stake = Number(info.p.stake) || 0
    out.push({ info, killer: missed[0], wouldHavePaid: mult != null && stake > 0 ? stake * mult : null })
  }
  return out.sort((a, b) => (b.wouldHavePaid ?? 0) - (a.wouldHavePaid ?? 0))
}

// ---------- Overview numbers ----------
export type Totals = { settled: number; won: number; denied: number; net: number; staked: number; roi: number | null }
export function totals(infos: ParlayInfo[]): Totals {
  const done = infos.filter(isDone)
  const net = done.reduce((t, i) => t + i.net, 0)
  const staked = done.reduce((t, i) => t + (Number(i.p.stake) || 0), 0)
  return {
    settled: done.length, won: done.filter(i => i.status === 'hit').length,
    denied: infos.filter(i => i.status === 'missed').length,
    net, staked, roi: staked > 0 ? net / staked : null,
  }
}

export type Highlights = {
  biggestWin: ParlayInfo | null
  biggestLoss: ParlayInfo | null
  biggestParlay: ParlayInfo | null          // most legs in a parlay that landed
  longshot: Leg | null                      // highest odds leg that hit
}
export function highlights(infos: ParlayInfo[], legs: Leg[]): Highlights {
  const won = infos.filter(i => i.status === 'hit')
  const lost = infos.filter(i => i.status === 'missed' && i.net < 0)
  return {
    biggestWin: won.filter(i => i.net > 0).sort((a, b) => b.net - a.net)[0] ?? null,
    biggestLoss: lost.sort((a, b) => a.net - b.net)[0] ?? null,
    biggestParlay: won.sort((a, b) => b.legs.length - a.legs.length)[0] ?? null,
    longshot: legs.filter(l => l.result === 'hit' && l.odds != null).sort((a, b) => Number(b.odds) - Number(a.odds))[0] ?? null,
  }
}
