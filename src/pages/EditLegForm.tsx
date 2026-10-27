import { useEffect, useId, useRef, useState } from 'react'
import { MARKETS, subjectOf, type Leg, type Member } from '../lib/parlay'

export type LegEdit = { member_id: string; description: string; subject: string | null; market: string; odds: number | null }
type Props = {
  leg: Leg
  members: Member[]
  players: string[]                              // names used in past legs, for autocomplete
  onSave: (edit: LegEdit) => Promise<string | null> // resolves to an error message, or null on success
  onCancel: () => void
}

// Inline editor for a leg that's already been added. Description is plain text here because older legs were typed
// freely and can't always be split back into player / line / market. The hit / miss result is not touched.
export default function EditLegForm({ leg, members, players, onSave, onCancel }: Props) {
  const [memberId, setMemberId] = useState(leg.member_id)
  const [market, setMarket] = useState(leg.market)
  const [description, setDescription] = useState(leg.description)
  // Older legs have no saved name yet, so start from the guess; saving stores it.
  const [subject, setSubject] = useState(subjectOf(leg) ?? '')
  const listId = useId()
  const [odds, setOdds] = useState(leg.odds == null ? '' : String(leg.odds))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)
  useEffect(() => { descRef.current?.focus() }, [])

  const oddsNum = odds === '' ? null : Number(odds)
  const oddsOk = oddsNum == null || oddsNum > 1
  const canSave = description.trim() !== '' && oddsOk && !busy
  const markets = MARKETS.includes(market) ? MARKETS : [market, ...MARKETS]   // keep a market that's no longer in the list selectable

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true); setError('')
    const err = await onSave({ member_id: memberId, description: description.trim(), subject: subject.trim() || null, market, odds: oddsNum })
    setBusy(false)
    if (err) setError(`Couldn't save: ${err}`)   // on success the parent closes this editor
  }

  return (
    <form className="editleg" onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onCancel() }}>
      <label>Description
        <input ref={descRef} required value={description} onChange={e => setDescription(e.target.value)} />
      </label>
      <label>Player or team (used for stats)
        <input list={listId} autoComplete="off" autoCapitalize="words" placeholder="Derrick Henry" value={subject} onChange={e => setSubject(e.target.value)} />
        <datalist id={listId}>{players.slice(0, 200).map(p => <option key={p} value={p} />)}</datalist>
      </label>
      <div className="erow">
        <label>Who picked it
          <select value={memberId} onChange={e => setMemberId(e.target.value)}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>Market
          <select value={market} onChange={e => setMarket(e.target.value)}>
            {markets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <label>Odds (optional)
        <input type="number" inputMode="decimal" step="0.01" min="1.01" placeholder="1.40" value={odds} onChange={e => setOdds(e.target.value)} />
      </label>
      {!oddsOk && <p className="savemsg bad">Odds are a decimal multiplier above 1, like 1.40.</p>}
      <div className="btns">
        <button className="primary" disabled={!canSave}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error && <p className="savemsg bad">{error}</p>}
    </form>
  )
}
