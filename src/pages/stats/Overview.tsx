import { money } from '../../lib/parlay'
import { agg, closeCalls, groupBy, highlights, playerRows, runningNet, shapeRows, totals } from '../../lib/stats'
import { RunningNet, Scroll, odds, parlayLabel, pct, plural, type StatsData } from './ui'

export default function Overview({ legs, members, infos }: StatsData) {
  const t = totals(infos)
  const h = highlights(infos, legs)
  const calls = closeCalls(infos)
  const players = playerRows(legs, members)
  const who = (id: string) => members.find(m => m.id === id)?.name ?? 'Unknown'

  const mostBacked = [...players].sort((a, b) => b.legs - a.legs)[0]
  const reliable = players.filter(p => p.n >= 3).sort((a, b) => b.rate - a.rate || b.n - a.n)[0]
  const cursed = players.filter(p => p.killed > 0).sort((a, b) => b.killed - a.killed || b.legs - a.legs)[0]
  const topMarket = [...groupBy(legs, l => l.market).entries()].sort((a, b) => b[1].length - a[1].length)[0]
  const topShape = shapeRows(legs)[0]
  const settledLegs = agg(legs)
  const onTable = calls.reduce((s, c) => s + (c.wouldHavePaid ?? 0), 0)

  return (
    <>
      <section className="card">
        <h2>Syndicate</h2>
        <p className="big">{t.won} of {t.settled} parlays hit · net {money(t.net)}</p>
        <p className="big">{t.denied} parlays denied</p>
        <p className="note">
          Cash staked {money(t.staked)} on settled parlays{t.roi != null && <> · return {t.roi >= 0 ? '+' : ''}{Math.round(t.roi * 100)}%</>}
          {settledLegs.n > 0 && <> · {pct(settledLegs.rate)} of {plural(settledLegs.n, 'settled leg')} hit</>}
        </p>
        {t.bonus.placed > 0 && (
          <p className="note">
            Bonus bets: {plural(t.bonus.placed, 'settled parlay')}, {t.bonus.won} won · {money(t.bonus.net)} from free money.
            {' '}Without them the net is {money(t.cashNet)}.
          </p>
        )}
        <RunningNet points={runningNet(infos)} />
      </section>

      <section className="card">
        <h2>Quick facts</h2>
        <dl className="kv">
          {mostBacked && <><dt>Most backed player</dt><dd>{mostBacked.name} <span className="note">{plural(mostBacked.legs, 'leg')}</span></dd></>}
          {reliable && <><dt>Most reliable (3+ legs)</dt><dd>{reliable.name} <span className="note">{reliable.hits}-{reliable.n - reliable.hits}, {pct(reliable.rate)}</span></dd></>}
          {cursed && <><dt>Parlay killer</dt><dd>{cursed.name} <span className="note">sole miss on {plural(cursed.killed, 'parlay')}</span></dd></>}
          {topMarket && <><dt>Favourite market</dt><dd>{topMarket[0]} <span className="note">{plural(topMarket[1].length, 'leg')}</span></dd></>}
          {topShape && <><dt>Favourite bet type</dt><dd>{topShape.label} <span className="note">{plural(topShape.n, 'settled leg')}, {pct(topShape.rate)} hit</span></dd></>}
        </dl>
        {!players.length && <p className="note">Player stats appear once legs have player names. Older legs get a name guessed from their description. See Players, then Tidy names, to save them.</p>}
      </section>

      <section className="card">
        <h2>Highlights</h2>
        <dl className="kv">
          {h.biggestWin && <><dt>Biggest win</dt><dd>{money(h.biggestWin.net)} <span className="note">{parlayLabel(h.biggestWin.p)}</span></dd></>}
          {h.biggestLoss && <><dt>Biggest loss</dt><dd>{money(h.biggestLoss.net)} <span className="note">{parlayLabel(h.biggestLoss.p)}</span></dd></>}
          {h.biggestParlay && <><dt>Biggest parlay landed</dt><dd>{plural(h.biggestParlay.legs.length, 'leg')} <span className="note">{parlayLabel(h.biggestParlay.p)}</span></dd></>}
          {h.longshot && <><dt>Longest odds leg landed</dt><dd>{h.longshot.description} {odds(Number(h.longshot.odds))} <span className="note">{who(h.longshot.member_id)}</span></dd></>}
        </dl>
        {!h.biggestWin && !h.biggestLoss && !h.longshot && <p className="note">Highlights show up once parlays are settled.</p>}
      </section>

      {calls.length > 0 && (
        <section className="card">
          <h2>Close calls</h2>
          <p className="big">{plural(calls.length, 'parlay')} lost by exactly one leg{onTable > 0 && <> · {money(onTable)} would have paid</>}</p>
          <Scroll>
            <table>
              <thead><tr><th>Parlay</th><th>Killed by</th><th>Leg</th><th>Would have paid</th></tr></thead>
              <tbody>{calls.slice(0, 6).map(c => (
                <tr key={c.info.p.id}><td>{parlayLabel(c.info.p)}</td><td>{who(c.killer.member_id)}</td><td>{c.killer.description}</td><td>{c.wouldHavePaid == null ? '–' : money(c.wouldHavePaid)}</td></tr>
              ))}</tbody>
            </table>
          </Scroll>
          {calls.length > 6 && <p className="note">Showing the 6 biggest of {calls.length}.</p>}
          <p className="note">Needs stake and odds filled in to work out what it would have paid. Slip odds are used when set.</p>
        </section>
      )}
    </>
  )
}
