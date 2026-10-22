import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MARKETS, combinedOdds, money, parlayStatus, type Leg, type Member, type Parlay, type Result } from '../lib/parlay'

type Props = { parlay: Parlay; index: number; members: Member[]; userId: string; defaultOpen: boolean; onDeleted: () => void }

export default function ParlayCard({ parlay, index, members, userId, defaultOpen, onDeleted }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [legs, setLegs] = useState<Leg[]>([])
  const [stake, setStake] = useState(String(parlay.stake))
  const [payout, setPayout] = useState(String(parlay.payout))
  const [slipOdds, setSlipOdds] = useState(parlay.slip_odds == null ? '' : String(parlay.slip_odds))
  const [form, setForm] = useState({ member_id: userId, description: '', market: MARKETS[0], odds: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('legs').select('*').eq('parlay_id', parlay.id).order('created_at')
    setLegs(data ?? [])
  }, [parlay.id])
  useEffect(() => { load() }, [load])

  const name = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'
  const status = parlayStatus(legs)
  // Prefer the odds printed on the bookie's slip. A pushed leg changes the real price, so then fall back to the legs.
  const slip = slipOdds === '' ? null : Number(slipOdds)
  const multiplier = slip != null && !legs.some(l => l.result === 'push') ? slip : combinedOdds(legs)
  const expected = multiplier == null ? null : (Number(stake) || 0) * multiplier

  async function addLeg(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('legs').insert({
      parlay_id: parlay.id, member_id: form.member_id, description: form.description,
      market: form.market, odds: form.odds === '' ? null : Number(form.odds),
    })
    setForm({ ...form, description: '', odds: '' }); load()
  }
  async function setResult(id: string, result: Result) { await supabase.from('legs').update({ result }).eq('id', id); load() }
  async function removeLeg(id: string) { if (confirm('Delete this leg?')) { await supabase.from('legs').delete().eq('id', id); load() } }
  async function saveMoney() {
    await supabase.from('parlays').update({ stake: Number(stake) || 0, payout: Number(payout) || 0, slip_odds: slipOdds === '' ? null : Number(slipOdds) }).eq('id', parlay.id)
  }
  async function removeParlay() {
    if (confirm('Delete this whole parlay and its legs?')) { await supabase.from('parlays').delete().eq('id', parlay.id); onDeleted() }
  }

  return (
    <section className="parlay">
      <header className="phead">
        <button className="toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="ptitle">{parlay.name || `Parlay ${index + 1}`}</span>
          <span className={`chip ${status}`}>{status === 'empty' ? 'No legs' : status}</span>
          {multiplier != null && <span className="mult">×{multiplier.toFixed(2)}</span>}
          <span className="meta">{legs.length} {legs.length === 1 ? 'leg' : 'legs'} · Net {money((Number(payout) || 0) - (Number(stake) || 0))}</span>
        </button>
        {open && <button className="x" aria-label="Delete parlay" onClick={removeParlay}>Delete parlay</button>}
      </header>

      {open && (<>
      <ul className="slip">
        {legs.map(l => (
          <li key={l.id} className={l.result}>
            <div className="who">{name(l.member_id)}</div>
            <div className="what"><strong>{l.description}</strong><span>{l.market}{l.odds != null && ` · ×${Number(l.odds).toFixed(2)}`}</span></div>
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
        <h3>Add a leg</h3>
        <select value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input required placeholder="Derrick Henry anytime TD" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <select value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select>
        <input type="number" step="0.01" min="1.01" placeholder="Odds (1.40)" value={form.odds} onChange={e => setForm({ ...form, odds: e.target.value })} />
        <button className="primary">Add leg</button>
      </form>

      <div className="card row">
        <h3>Money</h3>
        <label>Stake<input type="number" step="0.01" value={stake} onChange={e => setStake(e.target.value)} onBlur={saveMoney} /></label>
        <label>Slip odds<input type="number" step="0.01" min="1.01" placeholder="2.77" value={slipOdds} onChange={e => setSlipOdds(e.target.value)} onBlur={saveMoney} /></label>
        <label>Total returned<input type="number" step="0.01" value={payout} onChange={e => setPayout(e.target.value)} onBlur={saveMoney} /></label>
        {expected != null && status === 'hit' && <button type="button" onClick={() => { setPayout(expected.toFixed(2)); setTimeout(saveMoney, 0) }}>Use {money(expected)}</button>}
        <span className="net">
          Net {money((Number(payout) || 0) - (Number(stake) || 0))}
          {expected != null && status !== 'hit' && status !== 'missed' && ` · pays ${money(expected)} if it lands`}
        </span>
      </div>
      </>)}
    </section>
  )
}
