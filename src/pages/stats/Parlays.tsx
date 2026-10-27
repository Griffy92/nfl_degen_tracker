import { money } from '../../lib/parlay'
import { sizeRows, weekRows } from '../../lib/stats'
import { Scroll, pct, plural, tone, type StatsData } from './ui'

export default function Parlays({ infos }: StatsData) {
  const sizes = sizeRows(infos)
  const weeks = weekRows(infos).reverse()
  const m = (n: number) => <span className={tone(n)}>{money(n)}</span>

  return (
    <>
      <section className="card">
        <h2>By number of legs</h2>
        <Scroll>
          <table>
            <thead><tr><th>Legs</th><th>Parlays</th><th>Hit</th><th>Hit rate</th><th>Staked</th><th>Net</th></tr></thead>
            <tbody>{sizes.map(s => <tr key={s.size}><td>{s.size}</td><td>{s.parlays}</td><td>{s.won}</td><td>{pct(s.rate)}</td><td>{money(s.staked)}</td><td>{m(s.net)}</td></tr>)}</tbody>
          </table>
        </Scroll>
        {!sizes.length && <p className="note">Settle some parlays to see how size affects results.</p>}
        <p className="note">Settled parlays only. More legs pays more but lands less often, and this shows where the syndicate sits on that trade-off.</p>
      </section>

      <section className="card">
        <h2>Week by week</h2>
        <Scroll>
          <table>
            <thead><tr><th>Season</th><th>Week</th><th>Parlays</th><th>Hit</th><th>Net</th></tr></thead>
            <tbody>{weeks.map(w => <tr key={`${w.season}-${w.week}`}><td>{w.season}</td><td>{w.week}</td><td>{plural(w.parlays, 'parlay')}</td><td>{w.won}</td><td>{m(w.net)}</td></tr>)}</tbody>
          </table>
        </Scroll>
        {!weeks.length && <p className="note">Settled weeks appear here, newest first.</p>}
      </section>
    </>
  )
}
