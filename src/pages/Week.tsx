import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, Parlay } from '../lib/parlay'
import ParlayCard from './ParlayCard'

export default function Week({ userId }: { userId: string }) {
  const [season, setSeason] = useState(2026)
  const [week, setWeek] = useState(1)
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
        <label>Season<input type="number" value={season} onChange={e => setSeason(+e.target.value)} /></label>
        <label>Week<input type="number" min={1} max={22} value={week} onChange={e => setWeek(+e.target.value)} /></label>
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
