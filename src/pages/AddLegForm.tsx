import { useId, useMemo, useRef, useState } from 'react'
import { MARKETS, TOP_MARKETS, marketCfg, playerFrom, subjectOf, type Leg, type Member } from '../lib/parlay'

type Side = 'over' | 'under' | 'plus'
export type NewLeg = { member_id: string; description: string; subject: string | null; market: string; odds: number | null }
type Props = {
  members: Member[]
  userId: string
  legs: Leg[]                                   // legs already in this parlay, used for quick-pick names
  players: string[]                             // names used in past legs, used for autocomplete
  onAdd: (leg: NewLeg) => Promise<string | null> // resolves to an error message, or null on success
}

export default function AddLegForm({ members, userId, legs, players, onAdd }: Props) {
  const [memberId, setMemberId] = useState(userId)
  const [market, setMarket] = useState(TOP_MARKETS[0])
  const [subject, setSubject] = useState('')
  const [side, setSide] = useState<Side>('over')
  const [line, setLine] = useState('')
  const [free, setFree] = useState('')
  const [odds, setOdds] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)
  const listId = useId()

  const cfg = marketCfg(market)
  const who = subject.trim()
  let description = ''
  if (cfg.kind === 'free') description = free.trim()
  else if (cfg.kind === 'td') description = who ? `${who} ${cfg.label}` : ''
  else if (line.trim() && (who || cfg.subjectOptional)) {
    // "40+" style legs read "<player> 40+ receiving yards"; over/under legs read "<player> over 39.5 receiving yards".
    const amount = side === 'plus' ? `${line.trim()}+` : `${side} ${line.trim()}`
    description = [who, amount, cfg.label].filter(Boolean).join(' ')
  }

  // The name saved for stats. Game totals and combined props save none; spreads and head-to-heads fall back to the
  // name at the start of the text ("Chiefs -3.5" -> Chiefs); "Other" only saves one if you type it.
  const subjectValue: string | null = cfg.noSubject ? null
    : cfg.kind === 'free' ? (who || (market === 'Other' ? null : playerFrom(free)))
    : (who || null)

  const oddsNum = odds === '' ? null : Number(odds)
  const oddsOk = oddsNum == null || oddsNum > 1
  const canAdd = !!description && oddsOk && !busy

  // Names already in this parlay come first (handy for same game parlays), then the all-time list for autocomplete.
  const inParlay = useMemo(() => [...new Set(legs.map(subjectOf).filter((p): p is string => !!p))].slice(0, 8), [legs])
  const suggestions = useMemo(() => [...new Set([...inParlay, ...players])].slice(0, 200), [inParlay, players])
  const moreMarkets = MARKETS.filter(m => !TOP_MARKETS.includes(m))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canAdd) return
    setBusy(true); setError('')
    const err = await onAdd({ member_id: memberId, description, subject: subjectValue, market, odds: oddsNum })
    setBusy(false)
    if (err) { setError(`Couldn't add leg: ${err}`); return }
    // Keep who / market / over-under so the next leg is quick; clear the bits that change every time.
    setSubject(''); setLine(''); setFree(''); setOdds('')
    firstField.current?.focus()
  }

  return (
    <form className="card addleg" onSubmit={submit}>
      <h3>Add a leg</h3>

      <div className="field">
        <span className="flabel">Who picked it</span>
        <div className="pills" role="group" aria-label="Who picked it">
          {members.map(m => (
            <button type="button" key={m.id} className={memberId === m.id ? 'on' : ''} aria-pressed={memberId === m.id} onClick={() => setMemberId(m.id)}>{m.name}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="flabel">Market</span>
        <div className="pills" role="group" aria-label="Market">
          {TOP_MARKETS.map(m => (
            <button type="button" key={m} className={market === m ? 'on' : ''} aria-pressed={market === m} onClick={() => setMarket(m)}>{m}</button>
          ))}
          <select aria-label="More markets" className={!TOP_MARKETS.includes(market) ? 'on' : ''} value={TOP_MARKETS.includes(market) ? '' : market} onChange={e => e.target.value && setMarket(e.target.value)}>
            <option value="">More markets…</option>
            {moreMarkets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {cfg.kind === 'free' && (
        <label>Leg
          <input ref={firstField} required placeholder={cfg.placeholder} value={free} onChange={e => setFree(e.target.value)} />
        </label>
      )}
      <label>{cfg.kind === 'free' ? 'Player or team (optional, for stats)' : cfg.subjectOptional ? 'Game (optional)' : cfg.subjectLabel ?? 'Player'}
        <input ref={cfg.kind === 'free' ? undefined : firstField} list={listId} autoComplete="off" autoCapitalize="words" required={cfg.kind !== 'free' && !cfg.subjectOptional}
          placeholder={cfg.kind === 'free' ? (market === 'Other' ? 'Derrick Henry' : playerFrom(free) ? `Auto: ${playerFrom(free)}` : 'Chiefs') : cfg.subjectOptional ? 'Chiefs @ Bills' : cfg.subjectPlaceholder ?? 'Derrick Henry'}
          value={subject} onChange={e => setSubject(e.target.value)} />
        <datalist id={listId}>{suggestions.map(p => <option key={p} value={p} />)}</datalist>
      </label>
      {inParlay.length > 0 && !cfg.noSubject && (
        <div className="pills small" aria-label="Players already in this parlay">
          {inParlay.map(p => <button type="button" key={p} onClick={() => setSubject(p)}>{p}</button>)}
        </div>
      )}

      {cfg.kind === 'line' && (
        <div className="lineRow">
          <div className="pills seg" role="group" aria-label="Over, under or plus">
            {(['over', 'under', 'plus'] as const).map(sd => (
              <button type="button" key={sd} className={side === sd ? 'on' : ''} aria-pressed={side === sd} onClick={() => setSide(sd)}>
                {sd === 'plus' ? `${line.trim() || 'X'}+` : sd}
              </button>
            ))}
          </div>
          <label>{side === 'plus' ? 'Yards / amount' : 'Line'}
            <input required type="number" inputMode="decimal" step="0.5" min="0" placeholder={side === 'plus' ? '40' : '249.5'} value={line} onChange={e => setLine(e.target.value)} />
          </label>
        </div>
      )}

      <label>Odds (optional)
        <input type="number" inputMode="decimal" step="0.01" min="1.01" placeholder="1.40" value={odds} onChange={e => setOdds(e.target.value)} />
      </label>
      {!oddsOk && <p className="savemsg bad">Odds are a decimal multiplier above 1, like 1.40.</p>}

      <p className="preview" aria-live="polite">{description ? <>Adds: <strong>{description}</strong>{oddsNum != null && oddsOk && ` · ×${oddsNum.toFixed(2)}`}</> : 'Fill in the details above to build the leg.'}</p>
      <button className="primary" disabled={!canAdd}>{busy ? 'Adding…' : 'Add leg'}</button>
      {error && <p className="savemsg bad">{error}</p>}
    </form>
  )
}
