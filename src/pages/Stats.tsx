import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Leg, Member, Parlay } from '../lib/parlay'
import { parlayInfos } from '../lib/stats'
import Overview from './stats/Overview'
import People from './stats/People'
import Players from './stats/Players'
import Bets from './stats/Bets'
import Parlays from './stats/Parlays'

// The database returns at most 1000 rows per request, so read big tables a page at a time.
async function fetchAll<T>(table: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order('created_at').order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return out
  }
}

type Raw = { legs: Leg[]; members: Member[]; parlays: Parlay[] }

export default function Stats() {
  const [raw, setRaw] = useState<Raw | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [legs, parlays, m] = await Promise.all([fetchAll<Leg>('legs'), fetchAll<Parlay>('parlays'), supabase.from('members').select('id,name')])
      if (m.error) throw new Error(m.error.message)
      setRaw({ legs, parlays, members: m.data ?? [] }); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
  }, [])
  useEffect(() => { load() }, [load])

  if (error) return <main><p className="savemsg bad">Couldn't load stats: {error}</p></main>
  if (!raw) return <main><p className="note">Loading stats…</p></main>
  return <StatsView {...raw} onChanged={load} />
}

const TABS = ['Overview', 'People', 'Players', 'Bets', 'Parlays'] as const
type Tab = typeof TABS[number]

export function StatsView({ legs: allLegs, parlays: allParlays, members, onChanged }: Raw & { onChanged: () => void }) {
  const [season, setSeason] = useState<number | 'all'>('all')
  const [tab, setTab] = useState<Tab>('Overview')

  const data = useMemo(() => {
    const parlays = allParlays.filter(p => season === 'all' || p.season === season)
    const ids = new Set(parlays.map(p => p.id))
    const legs = allLegs.filter(l => ids.has(l.parlay_id))
    return { parlays, legs, members, infos: parlayInfos(parlays, legs) }
  }, [allLegs, allParlays, members, season])

  const seasons = [...new Set(allParlays.map(p => p.season))].sort()

  return (
    <main>
      <div className="picker">
        <label>Season
          <select value={season} onChange={e => setSeason(e.target.value === 'all' ? 'all' : +e.target.value)}>
            <option value="all">All time</option>{seasons.map(x => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="pills tabs" role="group" aria-label="Stats sections">
        {TABS.map(t => <button type="button" key={t} className={tab === t ? 'on' : ''} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Overview' && <Overview {...data} />}
      {tab === 'People' && <People {...data} />}
      {tab === 'Players' && <Players {...data} onChanged={onChanged} />}
      {tab === 'Bets' && <Bets {...data} />}
      {tab === 'Parlays' && <Parlays {...data} />}
    </main>
  )
}
