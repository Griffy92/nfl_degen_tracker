import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, Parlay } from '../lib/parlay'
import ParlayCard from './ParlayCard'
import { currentSeasonWeek } from '../lib/currentWeek'

const THIS_YEAR = new Date().getFullYear()
const SEASONS = Array.from({ length: 4 }, (_, i) => THIS_YEAR - 2 + i)   // e.g. 2024 to 2027
const PLAYOFFS: Record<number, string> = { 19: 'Wild Card', 20: 'Divisional', 21: 'Conference', 22: 'Super Bowl' }
const WEEKS = Array.from({ length: 22 }, (_, i) => i + 1)

export default function Week({ userId }: { userId: string }) {
  const [{ season: initialSeason, week: initialWeek }] = useState(() => currentSeasonWeek())
  const [season, setSeason] = useState(initialSeason)
  const [week, setWeek] = useState(initialWeek)
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const { data: m } = await supabase.from('members').select('id,name').order('name')
    setMembers(m ?? [])
    const { data: p } = await supabase.from('parlays').select('*').eq('season', season).eq('week', week).order('created_at')
    setParlays(p ?? [])
  }, [season, week])
  useEffect(() => { load() }, [load])

  async function addParlay(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('parlays').insert({ season, week, name: newName.trim() || null })
    setNewName(''); load()
  }

  return (
    <main>
      <div className="picker">
        <label>Season
          <select value={season} onChange={e => setSeason(+e.target.value)}>
            {(SEASONS.includes(season) ? SEASONS : [season, ...SEASONS]).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label>Week
          <select value={week} onChange={e => setWeek(+e.target.value)}>
            {WEEKS.map(w => <option key={w} value={w}>{PLAYOFFS[w] ? `${PLAYOFFS[w]} (${w})` : `Week ${w}`}</option>)}
          </select>
        </label>
      </div>

      {parlays.map((p, i) => <ParlayCard key={p.id} parlay={p} index={i} members={members} userId={userId} defaultOpen={i === parlays.length - 1} onDeleted={load} />)}
      {!parlays.length && <p className="empty">No parlays for week {week} yet.</p>}

      <form className="newparlay" onSubmit={addParlay}>
        <input placeholder="Name (optional), e.g. Sunday SGP" value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="primary">{parlays.length ? 'Add another parlay' : `Start week ${week}`}</button>
      </form>
    </main>
  )
}
