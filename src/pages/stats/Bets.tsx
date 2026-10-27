import { useState } from 'react'
import { agg, groupBy, isSettled, shapeRows } from '../../lib/stats'
import { Scroll, odds, pct, pts, tone, units, type StatsData } from './ui'

const BANDS = [
  { label: 'Under 1.30', min: 0, max: 1.3 }, { label: '1.30 to 1.59', min: 1.3, max: 1.6 },
  { label: '1.60 to 1.99', min: 1.6, max: 2 }, { label: '2.00 to 2.99', min: 2, max: 3 },
  { label: '3.00 and up', min: 3, max: Infinity },
]

export default function Bets({ legs, members }: StatsData) {
  const [bandPerson, setBandPerson] = useState('all')

  const markets = [...groupBy(legs.filter(isSettled), l => l.market).entries()].map(([k, ls]) => ({ k, ...agg(ls) })).sort((a, b) => b.rate - a.rate || b.n - a.n)
  const shapes = shapeRows(legs)
  const priced = legs.filter(l => isSettled(l) && l.odds != null)
  const bands = BANDS.map(b => ({
    label: b.label,
    ...agg(priced.filter(l => (bandPerson === 'all' || l.member_id === bandPerson) && Number(l.odds) >= b.min && Number(l.odds) < b.max)),
  })).filter(x => x.n)

  const cols = (a: ReturnType<typeof agg>) => (
    <><td>{odds(a.avgOdds)}</td><td>{a.priced ? pct(a.implied) : '–'}</td><td className={tone(a.edge)}>{pts(a.edge)}</td><td className={a.priced ? tone(a.flat) : ''}>{a.priced ? units(a.flat) : '–'}</td></>
  )

  return (
    <>
      <section className="card">
        <h2>Hit rate by market</h2>
        <Scroll>
          <table>
            <thead><tr><th>Market</th><th>Hit rate</th><th>Legs</th><th>Avg odds</th><th>Odds imply</th><th>Edge</th><th>Flat $1</th></tr></thead>
            <tbody>{markets.map(m => <tr key={m.k}><td>{m.k}</td><td>{pct(m.rate)}</td><td>{m.n}</td>{cols(m)}</tr>)}</tbody>
          </table>
        </Scroll>
        {!markets.length && <p className="note">Settle some legs to see this table.</p>}
      </section>

      <section className="card">
        <h2>Hit rate by bet type</h2>
        <Scroll>
          <table>
            <thead><tr><th>Bet type</th><th>Hit rate</th><th>Legs</th><th>Avg odds</th><th>Odds imply</th><th>Edge</th><th>Flat $1</th></tr></thead>
            <tbody>{shapes.map(s => <tr key={s.label}><td>{s.label}</td><td>{pct(s.rate)}</td><td>{s.n}</td>{cols(s)}</tr>)}</tbody>
          </table>
        </Scroll>
        {!shapes.length && <p className="note">Settle some legs to see this table.</p>}
        <p className="note">Worked out from the leg text. Overs and Unders are "over 39.5" style legs, X+ is "40+" style, TD scorer is anytime and first TD, and Sides is spreads and head to heads.</p>
      </section>

      <section className="card">
        <h2>Hit rate by odds</h2>
        <label className="inline">Person
          <select value={bandPerson} onChange={e => setBandPerson(e.target.value)}>
            <option value="all">Everyone</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <Scroll>
          <table>
            <thead><tr><th>Odds</th><th>Legs</th><th>Hit rate</th><th>Odds imply</th><th>Edge</th><th>Flat $1 bets</th></tr></thead>
            <tbody>{bands.map(b => (
              <tr key={b.label}><td>{b.label}</td><td>{b.n}</td><td>{pct(b.rate)}</td><td>{pct(b.implied)}</td>
                <td className={tone(b.edge)}>{pts(b.edge)}</td><td className={tone(b.flat)}>{units(b.flat)}</td></tr>
            ))}</tbody>
          </table>
        </Scroll>
        {!bands.length && <p className="note">Nothing to show yet for this person.</p>}
        <p className="note">Odds imply is the chance the price suggests (1 ÷ odds). A positive edge means a higher hit rate than the odds say. Only settled legs with odds count.</p>
      </section>
    </>
  )
}
