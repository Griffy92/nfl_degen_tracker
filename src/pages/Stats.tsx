import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, parlayStatus, type Leg, type Member, type Parlay } from '../lib/parlay'

const BANDS = [
  { label: 'Under 1.30', min: 0, max: 1.3 }, { label: '1.30 to 1.59', min: 1.3, max: 1.6 },
  { label: '1.60 to 1.99', min: 1.6, max: 2 }, { label: '2.00 to 2.99', min: 2, max: 3 },
  { label: '3.00 and up', min: 3, max: Infinity },
]

// Hit rate vs what the odds imply (1 / odds), plus the return from betting $1 flat on each leg alone.
function summarize(xs: Leg[]) {
  const n = xs.length
  const hits = xs.filter(l => l.result === 'hit').length
  const rate = n ? hits / n : 0
  const implied = n ? xs.reduce((t, l) => t + 1 / Number(l.odds), 0) / n : 0
  const avg = n ? xs.reduce((t, l) => t + Number(l.odds), 0) / n : 0
  const flat = xs.reduce((t, l) => t + (l.result === 'hit' ? Number(l.odds) - 1 : -1), 0)
  return { n, rate, implied, avg, edge: rate - implied, flat }
}

export default function Stats() {
  const [legs, setLegs] = useState<Leg[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [season, setSeason] = useState<number | 'all'>('all')
  const [bandPerson, setBandPerson] = useState('all')

  useEffect(() => {
    (async () => {
      const [l, m, p] = await Promise.all([
        supabase.from('legs').select('*').order('created_at'),
        supabase.from('members').select('id,name'),
        supabase.from('parlays').select('*'),
      ])
      setLegs(l.data ?? []); setMembers(m.data ?? []); setParlays(p.data ?? [])
    })()
  }, [])

  const s = useMemo(() => {
    const ps = parlays.filter(p => season === 'all' || p.season === season)
    const ids = new Set(ps.map(p => p.id))
    const ls = legs.filter(l => ids.has(l.parlay_id))
    const byParlay = (id: string) => ls.filter(l => l.parlay_id === id)

    const people = members.map(m => {
      const mine = ls.filter(l => l.member_id === m.id && (l.result === 'hit' || l.result === 'miss'))
      const hits = mine.filter(l => l.result === 'hit').length
      let streak = 0
      for (let i = mine.length - 1; i >= 0 && mine[i].result === 'hit'; i--) streak++
      const killed = ps.filter(p => {
        const pl = byParlay(p.id)
        const misses = pl.filter(l => l.result === 'miss')
        return misses.length === 1 && misses[0].member_id === m.id && !pl.some(l => l.result === 'pending')
      }).length
      const denied = ps.filter(p => byParlay(p.id).some(l => l.member_id === m.id && l.result === 'miss')).length
      return { m, hits, total: mine.length, rate: mine.length ? hits / mine.length : 0, streak, killed, denied }
    }).sort((a, b) => b.rate - a.rate)

    const markets = [...new Set(ls.map(l => l.market))].map(k => {
      const x = ls.filter(l => l.market === k && (l.result === 'hit' || l.result === 'miss'))
      return { k, total: x.length, rate: x.length ? x.filter(l => l.result === 'hit').length / x.length : 0 }
    }).filter(x => x.total).sort((a, b) => b.rate - a.rate)

    const settled = ps.filter(p => { const st = parlayStatus(byParlay(p.id)); return st === 'hit' || st === 'missed' })
    const won = settled.filter(p => parlayStatus(byParlay(p.id)) === 'hit').length
    const denied = ps.filter(p => parlayStatus(byParlay(p.id)) === 'missed').length
    const net = settled.reduce((t, p) => t + Number(p.payout) - Number(p.stake), 0)
    const priced = ls.filter(l => l.odds != null && (l.result === 'hit' || l.result === 'miss'))
    const oddsPeople = members.map(m => ({ m, ...summarize(priced.filter(l => l.member_id === m.id)) }))
      .filter(x => x.n).sort((a, b) => b.edge - a.edge)
    const bands = BANDS.map(b => ({
      label: b.label,
      ...summarize(priced.filter(l => (bandPerson === 'all' || l.member_id === bandPerson) && Number(l.odds) >= b.min && Number(l.odds) < b.max)),
    })).filter(x => x.n)

    return { people, markets, oddsPeople, bands, settled: settled.length, won, denied, net }
  }, [legs, members, parlays, season, bandPerson])

  const seasons = [...new Set(parlays.map(p => p.season))].sort()
  const pct = (n: number) => Math.round(n * 100) + '%'
  const pts = (e: number) => `${e >= 0 ? '+' : ''}${Math.round(e * 100)} pts`
  const units = (u: number) => `${u >= 0 ? '+' : '-'}$${Math.abs(u).toFixed(2)}`
  const tone = (n: number) => (n >= 0 ? 'pos' : 'neg')

  return (
    <main>
      <div className="picker">
        <label>Season
          <select value={season} onChange={e => setSeason(e.target.value === 'all' ? 'all' : +e.target.value)}>
            <option value="all">All time</option>{seasons.map(x => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>

      <section className="card">
        <h2>Syndicate</h2>
        <p className="big">{s.won} of {s.settled} parlays hit · net {money(s.net)}</p>
        <p className="big">{s.denied} parlays denied</p>
      </section>

      <section className="card">
        <h2>Leg hit rate by person</h2>
        <table>
          <thead><tr><th>Name</th><th>Hit rate</th><th>Record</th><th>Streak</th><th>Parlays killed</th><th>Parlays denied</th></tr></thead>
          <tbody>{s.people.map(p => (
            <tr key={p.m.id}><td>{p.m.name}</td><td>{pct(p.rate)}</td><td>{p.hits}-{p.total - p.hits}</td><td>{p.streak}</td><td>{p.killed}</td><td>{p.denied}</td></tr>
          ))}</tbody>
        </table>
        <p className="note">Parlays killed means you had the only missed leg on a settled parlay. Parlays denied counts every parlay that missed because of a missed leg (for a person, every parlay where one of their legs missed, even if others missed too).</p>
      </section>

      <section className="card">
        <h2>Hit rate by market</h2>
        <table>
          <thead><tr><th>Market</th><th>Hit rate</th><th>Legs</th></tr></thead>
          <tbody>{s.markets.map(x => <tr key={x.k}><td>{x.k}</td><td>{pct(x.rate)}</td><td>{x.total}</td></tr>)}</tbody>
        </table>
      </section>
    
      <section className="card">
        <h2>Odds vs results by person</h2>
        <table>
          <thead><tr><th>Name</th><th>Legs</th><th>Avg odds</th><th>Hit rate</th><th>Odds imply</th><th>Edge</th><th>Flat $1 bets</th></tr></thead>
          <tbody>{s.oddsPeople.map(p => (
            <tr key={p.m.id}><td>{p.m.name}</td><td>{p.n}</td><td>×{p.avg.toFixed(2)}</td><td>{pct(p.rate)}</td><td>{pct(p.implied)}</td>
              <td className={tone(p.edge)}>{pts(p.edge)}</td><td className={tone(p.flat)}>{units(p.flat)}</td></tr>
          ))}</tbody>
        </table>
        {!s.oddsPeople.length && <p className="note">Add odds to your legs and settle them to see this table.</p>}
        <p className="note">Odds imply is the chance the price suggests (1 ÷ odds). A positive edge means you hit more often than the odds say. Flat $1 bets is what betting $1 on each of your legs on its own would have returned. Only settled legs with odds count, and small samples are mostly noise.</p>
      </section>

      <section className="card">
        <h2>Hit rate by odds</h2>
        <label className="inline">Person
          <select value={bandPerson} onChange={e => setBandPerson(e.target.value)}>
            <option value="all">Everyone</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <table>
          <thead><tr><th>Odds</th><th>Legs</th><th>Hit rate</th><th>Odds imply</th><th>Edge</th><th>Flat $1 bets</th></tr></thead>
          <tbody>{s.bands.map(b => (
            <tr key={b.label}><td>{b.label}</td><td>{b.n}</td><td>{pct(b.rate)}</td><td>{pct(b.implied)}</td>
              <td className={tone(b.edge)}>{pts(b.edge)}</td><td className={tone(b.flat)}>{units(b.flat)}</td></tr>
          ))}</tbody>
        </table>
        {!s.bands.length && <p className="note">Nothing to show yet for this person.</p>}
      </section>
    </main>
  )
}