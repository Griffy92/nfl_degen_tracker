import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MARKETS, money, parlayStatus, type Leg, type Member, type Parlay, type Result } from '../lib/parlay'

export default function Week({ userId }: { userId: string }) {
  const [season, setSeason] = useState(2026)
  const [week, setWeek] = useState(1)
  const [parlay, setParlay] = useState<Parlay | null>(null)
  const [legs, setLegs] = useState<Leg[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [stake, setStake] = useState('')
  const [payout, setPayout] = useState('')
  const [form, setForm] = useState({ member_id: userId, description: '', market: MARKETS[0], odds: '' })

  const load = useCallback(async () => {
    const { data: m } = await supabase.from('members').select('id,name').order('name')
    setMembers(m ?? [])
    const { data: p } = await supabase.from('parlays').select('*').eq('season', season).eq('week', week).maybeSingle()
    setParlay(p)
    setStake(p ? String(p.stake) : ''); setPayout(p ? String(p.payout) : '')
    if (p) {
      const { data: l } = await supabase.from('legs').select('*').eq('parlay_id', p.id).order('created_at')
      setLegs(l ?? [])
    } else setLegs([])
  }, [season, week])
  useEffect(() => { load() }, [load])

  const name = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'
  const status = parlayStatus(legs)

  async function createParlay() { await supabase.from('parlays').insert({ season, week }); load() }
  async function savePayout() {
    await supabase.from('parlays').update({ stake: Number(stake) || 0, payout: Number(payout) || 0 }).eq('id', parlay!.id); load()
  }
  async function addLeg(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('legs').insert({
      parlay_id: parlay!.id, member_id: form.member_id, description: form.description,
      market: form.market, odds: form.odds === '' ? null : Number(form.odds),
    })
    setForm({ ...form, description: '', odds: '' }); load()
  }
  async function setResult(id: string, result: Result) { await supabase.from('legs').update({ result }).eq('id', id); load() }
  async function removeLeg(id: string) { if (confirm('Delete this leg?')) { await supabase.from('legs').delete().eq('id', id); load() } }

  return (
    <main>
      <div className="picker">
        <label>Season<input type="number" value={season} onChange={e => setSeason(+e.target.value)} /></label>
        <label>Week<input type="number" min={1} max={22} value={week} onChange={e => setWeek(+e.target.value)} /></label>
        {parlay && <span className={`chip ${status}`}>{status === 'empty' ? 'No legs' : status}</span>}
      </div>

      {!parlay ? (
        <div className="empty">
          <p>No parlay for week {week} yet.</p>
          <button className="primary" onClick={createParlay}>Start week {week}</button>
        </div>
      ) : (
        <>
          <ul className="slip">
            {legs.map(l => (
              <li key={l.id} className={l.result}>
                <div className="who">{name(l.member_id)}</div>
                <div className="what"><strong>{l.description}</strong><span>{l.market}{l.odds != null && ` · ${l.odds > 0 ? '+' : ''}${l.odds}`}</span></div>
                <div className="acts">
                  {(['hit', 'miss', 'push', 'pending'] as Result[]).map(r => (
                    <button key={r} className={l.result === r ? 'on' : ''} onClick={() => setResult(l.id, r)}>{r === 'pending' ? 'reset' : r}</button>
                  ))}
                  <button className="x" aria-label="Delete leg" onClick={() => removeLeg(l.id)}>✕</button>
                </div>
              </li>
            ))}
            {!legs.length && <li className="blank">No legs yet. Add the first one below.</li>}
          </ul>

          <form className="card" onSubmit={addLeg}>
            <h2>Add a leg</h2>
            <select value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input required placeholder="Mahomes over 274.5 passing yards" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <select value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select>
            <input type="number" placeholder="Odds (-110)" value={form.odds} onChange={e => setForm({ ...form, odds: e.target.value })} />
            <button className="primary">Add leg</button>
          </form>

          <div className="card row">
            <h2>Money</h2>
            <label>Stake<input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} /></label>
            <label>Total returned<input type="number" step="0.01" value={payout} onChange={e => setPayout(e.target.value)} /></label>
            <button onClick={savePayout}>Save</button>
            <span className="net">Net {money((Number(payout) || 0) - (Number(stake) || 0))}</span>
          </div>
        </>
      )}
    </main>
  )
}
