import { agg, isSettled, marketMatrix, profiles, runs } from '../../lib/stats'
import { Scroll, odds, pct, plural, pts, tone, units, type StatsData } from './ui'

const runText = (r: ReturnType<typeof runs>['current']) => (r ? plural(r.n, r.type) : '–')

export default function People({ legs, members, infos }: StatsData) {
  const profs = profiles(legs, members)
  const people = members.map(m => {
    const mine = legs.filter(l => l.member_id === m.id && isSettled(l))
    const hits = mine.filter(l => l.result === 'hit').length
    const killed = infos.filter(i => {
      const misses = i.legs.filter(l => l.result === 'miss')
      return misses.length === 1 && misses[0].member_id === m.id && !i.legs.some(l => l.result === 'pending')
    }).length
    const denied = infos.filter(i => i.legs.some(l => l.member_id === m.id && l.result === 'miss')).length
    return { m, hits, total: mine.length, rate: mine.length ? hits / mine.length : 0, now: runs(legs.filter(l => l.member_id === m.id)).current, killed, denied }
  }).sort((a, b) => b.rate - a.rate)

  const priced = legs.filter(l => isSettled(l) && l.odds != null)
  const oddsPeople = members.map(m => ({ m, ...agg(priced.filter(l => l.member_id === m.id)) })).filter(x => x.n).sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0))
  const matrix = marketMatrix(legs, members)

  return (
    <>
      <section className="card">
        <h2>Leg hit rate by person</h2>
        <Scroll>
          <table>
            <thead><tr><th>Name</th><th>Hit rate</th><th>Record</th><th>Streak</th><th>Parlays killed</th><th>Parlays denied</th></tr></thead>
            <tbody>{people.map(p => (
              <tr key={p.m.id}><td>{p.m.name}</td><td>{pct(p.rate)}</td><td>{p.hits}-{p.total - p.hits}</td><td>{runText(p.now)}</td><td>{p.killed}</td><td>{p.denied}</td></tr>
            ))}</tbody>
          </table>
        </Scroll>
        <p className="note">Streak is the current run of settled legs. Parlays killed means you had the only missed leg on a settled parlay. Parlays denied counts every parlay that missed because of a missed leg (for a person, every parlay where one of their legs missed, even if others missed too).</p>
      </section>

      <h2 className="sectionhead">Profiles</h2>
      <div className="profiles">
        {profs.map(p => (
          <article className="card profile" key={p.m.id}>
            <h3>{p.m.name}</h3>
            <p className="note">{plural(p.legs, 'leg')}, {p.a.n} settled · {p.a.hits}-{p.a.n - p.a.hits}{p.a.n > 0 && ` (${pct(p.a.rate)})`}</p>
            <dl className="kv">
              {p.a.avgOdds > 0 && <><dt>Average odds</dt><dd>{odds(p.a.avgOdds)}</dd></>}
              {p.runs.current && <><dt>Right now</dt><dd>{plural(p.runs.current.n, p.runs.current.type)} in a row</dd></>}
              {p.runs.bestHit > 1 && <><dt>Best run</dt><dd>{plural(p.runs.bestHit, 'hit')} in a row</dd></>}
              {p.runs.bestMiss > 1 && <><dt>Coldest run</dt><dd>{plural(p.runs.bestMiss, 'miss', 'misses')} in a row</dd></>}
              {p.favMarket && <><dt>Favourite market</dt><dd>{p.favMarket.k} <span className="note">{plural(p.favMarket.n, 'leg')}</span></dd></>}
              {p.bestMarket && <><dt>Best market</dt><dd>{p.bestMarket.k} <span className="note">{pct(p.bestMarket.rate)} of {p.bestMarket.n}</span></dd></>}
              {p.worstMarket && <><dt>Worst market</dt><dd>{p.worstMarket.k} <span className="note">{pct(p.worstMarket.rate)} of {p.worstMarket.n}</span></dd></>}
              {p.favPlayer && <><dt>Favourite player</dt><dd>{p.favPlayer.name} <span className="note">{plural(p.favPlayer.n, 'leg')}{p.favPlayer.settled > 0 && `, ${pct(p.favPlayer.rate)} hit`}</span></dd></>}
              {p.bestPlayer && <><dt>Best player pick</dt><dd>{p.bestPlayer.k} <span className="note">{pct(p.bestPlayer.rate)} of {p.bestPlayer.n}</span></dd></>}
              {p.worstPlayer && <><dt>Worst player pick</dt><dd>{p.worstPlayer.k} <span className="note">{pct(p.worstPlayer.rate)} of {p.worstPlayer.n}</span></dd></>}
              {p.longshot && <><dt>Longshot landed</dt><dd>{p.longshot.description} <span className="note">{odds(Number(p.longshot.odds))}</span></dd></>}
            </dl>
            {p.legs === 0 && <p className="note">No legs yet.</p>}
          </article>
        ))}
      </div>
      <p className="note spaced">Best and worst markets need 3+ settled legs, and best and worst players need 2+. Small samples are mostly noise.</p>

      <section className="card">
        <h2>Who is good at what</h2>
        <Scroll>
          <table>
            <thead><tr><th>Market</th>{members.map(m => <th key={m.id}>{m.name}</th>)}</tr></thead>
            <tbody>{matrix.map(r => (
              <tr key={r.market}><td>{r.market}</td>{members.map(m => {
                const a = r.byMember[m.id]
                return <td key={m.id} className={a.n ? tone(a.rate - 0.5) : ''}>{a.n ? `${pct(a.rate)} (${a.n})` : '–'}</td>
              })}</tr>
            ))}</tbody>
          </table>
        </Scroll>
        {!matrix.length && <p className="note">Settle some legs to see this table.</p>}
        <p className="note">Hit rate with the number of settled legs in brackets. Green is above 50%, red is below.</p>
      </section>

      <section className="card">
        <h2>Odds vs results by person</h2>
        <Scroll>
          <table>
            <thead><tr><th>Name</th><th>Legs</th><th>Avg odds</th><th>Hit rate</th><th>Odds imply</th><th>Edge</th><th>Flat $1 bets</th></tr></thead>
            <tbody>{oddsPeople.map(p => (
              <tr key={p.m.id}><td>{p.m.name}</td><td>{p.priced}</td><td>{odds(p.avgOdds)}</td><td>{pct(p.rate)}</td><td>{pct(p.implied)}</td>
                <td className={tone(p.edge)}>{pts(p.edge)}</td><td className={tone(p.flat)}>{units(p.flat)}</td></tr>
            ))}</tbody>
          </table>
        </Scroll>
        {!oddsPeople.length && <p className="note">Add odds to your legs and settle them to see this table.</p>}
        <p className="note">Odds imply is the chance the price suggests (1 ÷ odds). A positive edge means you hit more often than the odds say. Flat $1 bets is what betting $1 on each of your legs on its own would have returned. Only settled legs with odds count, and small samples are mostly noise.</p>
      </section>
    </>
  )
}
