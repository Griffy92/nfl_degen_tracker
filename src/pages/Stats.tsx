import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, parlayStatus, type Leg, type Member, type Parlay } from '../lib/parlay'

export default function Stats() {
  const [legs, setLegs] = useState<Leg[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [season, setSeason] = useState<number | 'all'>('all')

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
      return { m, hits, total: mine.length, rate: mine.length ? hits / mine.length : 0, streak, killed }
    }).sort((a, b) => b.rate - a.rate)

    const markets = [...new Set(ls.map(l => l.market))].map(k => {
      const x = ls.filter(l => l.market === k && (l.result === 'hit' || l.result === 'miss'))
      return { k, total: x.length, rate: x.length ? x.filter(l => l.result === 'hit').length / x.length : 0 }
    }).filter(x => x.total).sort((a, b) => b.rate - a.rate)

    const settled = ps.filter(p => { const st = parlayStatus(byParlay(p.id)); return st === 'hit' || st === 'missed' })
    const won = settled.filter(p => parlayStatus(byParlay(p.id)) === 'hit').length
    const net = settled.reduce((t, p) => t + Number(p.payout) - Number(p.stake), 0)
    return { people, markets, settled: settled.length, won, net }
  }, [legs, members, parlays, season])

  const seasons = [...new Set(parlays.map(p => p.season))].sort()
  const pct = (n: number) => Math.round(n * 100) + '%'

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
      </section>

      <section className="card">
        <h2>Leg hit rate by person</h2>
        <table>
          <thead><tr><th>Name</th><th>Hit rate</th><th>Record</th><th>Streak</th><th>Parlays killed</th></tr></thead>
          <tbody>{s.people.map(p => (
            <tr key={p.m.id}><td>{p.m.name}</td><td>{pct(p.rate)}</td><td>{p.hits}-{p.total - p.hits}</td><td>{p.streak}</td><td>{p.killed}</td></tr>
          ))}</tbody>
        </table>
        <p className="note">Parlays killed means you had the only missed leg on a settled parlay.</p>
      </section>

      <section className="card">
        <h2>Hit rate by market</h2>
        <table>
          <thead><tr><th>Market</th><th>Hit rate</th><th>Legs</th></tr></thead>
          <tbody>{s.markets.map(x => <tr key={x.k}><td>{x.k}</td><td>{pct(x.rate)}</td><td>{x.total}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  )
}
