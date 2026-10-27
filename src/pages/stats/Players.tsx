import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { nameKey, subjectOf } from '../../lib/parlay'
import { playerRows, profiles, type PlayerRow } from '../../lib/stats'
import { Scroll, odds, pct, plural, pts, tone, units, type StatsData } from './ui'

type Sort = 'backed' | 'rate' | 'cold' | 'edge' | 'killed'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'backed', label: 'Most backed' }, { id: 'rate', label: 'Best hit rate' }, { id: 'cold', label: 'Worst hit rate' },
  { id: 'edge', label: 'Best edge vs odds' }, { id: 'killed', label: 'Most parlays killed' },
]
const sorters: Record<Sort, (a: PlayerRow, b: PlayerRow) => number> = {
  backed: (a, b) => b.legs - a.legs || b.rate - a.rate,
  rate: (a, b) => b.rate - a.rate || b.n - a.n,
  cold: (a, b) => a.rate - b.rate || b.n - a.n,
  edge: (a, b) => (b.edge ?? -9) - (a.edge ?? -9) || b.n - a.n,
  killed: (a, b) => b.killed - a.killed || b.legs - a.legs,
}
const SHOWN = 25

// Writes a name onto many legs. Ids go in batches so the request URL stays short.
async function saveNames(updates: { ids: string[]; subject: string }[]): Promise<string | null> {
  for (const u of updates) {
    for (let i = 0; i < u.ids.length; i += 100) {
      const { error } = await supabase.from('legs').update({ subject: u.subject }).in('id', u.ids.slice(i, i + 100))
      if (error) return error.message
    }
  }
  return null
}

export default function Players({ legs, members, onChanged }: StatsData & { onChanged: () => void }) {
  const [sort, setSort] = useState<Sort>('backed')
  const [min, setMin] = useState(1)
  const [all, setAll] = useState(false)

  const rows = playerRows(legs, members)
  const shown = rows.filter(r => r.n >= min || (min === 1 && sort === 'backed')).sort(sorters[sort])
  const list = all ? shown : shown.slice(0, SHOWN)
  const profs = profiles(legs, members)

  return (
    <>
      <section className="card">
        <h2>Players and teams</h2>
        <div className="controls">
          <label>Sort by
            <select value={sort} onChange={e => setSort(e.target.value as Sort)}>{SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>
          <label>Min settled legs
            <select value={min} onChange={e => setMin(+e.target.value)}>{[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}+</option>)}</select>
          </label>
        </div>
        <Scroll>
          <table>
            <thead><tr><th>Player</th><th>Legs</th><th>Record</th><th>Hit rate</th><th>Avg odds</th><th>Edge</th><th>Flat $1</th><th>Killed</th><th>Backed by</th></tr></thead>
            <tbody>{list.map(r => (
              <tr key={r.key}>
                <td>{r.name}</td><td>{r.legs}</td><td>{r.hits}-{r.misses}</td><td>{r.n ? pct(r.rate) : '–'}</td><td>{odds(r.avgOdds)}</td>
                <td className={tone(r.edge)}>{pts(r.edge)}</td><td className={r.priced ? tone(r.flat) : ''}>{r.priced ? units(r.flat) : '–'}</td>
                <td>{r.killed || '–'}</td><td>{r.backers.slice(0, 2).map(b => `${b.name} ×${b.n}`).join(', ')}</td>
              </tr>
            ))}</tbody>
          </table>
        </Scroll>
        {!rows.length && <p className="note">No players yet. Add a leg with a player name, or use Tidy names below to save names for older legs.</p>}
        {shown.length > SHOWN && <button type="button" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${shown.length}`}</button>}
        {rows.length > 0 && shown.length === 0 && <p className="note">Nobody has {min}+ settled legs yet.</p>}
        <p className="note">Legs counts everything backed; Record, Hit rate, Edge and Flat $1 use settled legs only. Killed is how many parlays this player's leg was the only miss on. Edge compares hit rate with what the odds imply. With a small number of legs these are mostly noise, so raise Min settled legs when ranking.</p>
      </section>

      <section className="card">
        <h2>Who backs who</h2>
        <Scroll>
          <table>
            <thead><tr><th>Name</th><th>Most backed players</th></tr></thead>
            <tbody>{profs.map(p => (
              <tr key={p.m.id}><td>{p.m.name}</td><td>{p.topPlayers.length ? p.topPlayers.map(t => `${t.name} ×${t.n}${t.settled ? ` (${t.hits}-${t.settled - t.hits})` : ''}`).join(', ') : '–'}</td></tr>
            ))}</tbody>
          </table>
        </Scroll>
        <p className="note">The number is how many legs they put on that player, with their hit-miss record in brackets.</p>
      </section>

      <Tidy legs={legs} rows={rows} onChanged={onChanged} />
    </>
  )
}

// Save guessed names and merge spellings. Everything here writes the `subject` column on legs.
function Tidy({ legs, rows, onChanged }: { legs: StatsData['legs']; rows: PlayerRow[]; onChanged: () => void }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const idsFor = (key: string, onlyUnsaved = false) => legs.filter(l => { const s = subjectOf(l); return s && nameKey(s) === key && (!onlyUnsaved || !l.subject?.trim()) }).map(l => l.id)
  const unsaved = rows.reduce((t, r) => t + r.unsaved, 0)

  async function run(updates: { ids: string[]; subject: string }[], doneMsg: string) {
    setBusy(true); setMsg('')
    const err = await saveNames(updates)
    setBusy(false)
    if (err) { setMsg(`Couldn't save: ${err}`); return }
    setMsg(doneMsg); onChanged()
  }
  function saveGuesses() {
    if (!confirm(`Save the guessed player name on ${plural(unsaved, 'leg')}? You can still rename them afterwards.`)) return
    run(rows.filter(r => r.unsaved).map(r => ({ ids: idsFor(r.key, true), subject: r.name })), `Saved names on ${plural(unsaved, 'leg')}.`)
  }

  return (
    <details className="card tidy">
      <summary><h2>Tidy names</h2></summary>
      <p className="note">Player stats group legs by the name saved on them. Older legs don't have one yet, so a name is guessed from the description. Check the list, fix anything that looks off, then save. To merge two spellings, rename one to match the other (for example "D. Henry" to "Derrick Henry").</p>
      {unsaved > 0
        ? <button type="button" className="primary" disabled={busy} onClick={saveGuesses}>Save guessed names on {plural(unsaved, 'leg')}</button>
        : <p className="note">Every leg has a saved name.</p>}
      {msg && <p className={msg.startsWith("Couldn't") ? 'savemsg bad' : 'savemsg'}>{msg}</p>}
      <ul className="tidylist">
        {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map(r => (
          <TidyRow key={r.key} row={r} busy={busy} onRename={subject => {
            if (confirm(`Rename ${plural(r.legs, 'leg')} from "${r.name}" to "${subject}"?`)) run([{ ids: idsFor(r.key), subject }], `Renamed to ${subject}.`)
          }} />
        ))}
      </ul>
    </details>
  )
}

function TidyRow({ row, busy, onRename }: { row: PlayerRow; busy: boolean; onRename: (name: string) => void }) {
  const [value, setValue] = useState(row.name)
  const changed = value.trim() !== row.name
  const needsSave = row.unsaved > 0 || row.spellings > 1
  return (
    <li>
      <input aria-label={`Name for ${row.name}`} value={value} onChange={e => setValue(e.target.value)} />
      <span className="note">{plural(row.legs, 'leg')}{row.unsaved > 0 && ` · ${row.unsaved} guessed`}{row.spellings > 1 && ' · mixed spellings'}</span>
      <button type="button" disabled={busy || !value.trim() || (!changed && !needsSave)} onClick={() => onRename(value.trim())}>{changed ? 'Rename' : 'Save'}</button>
    </li>
  )
}
