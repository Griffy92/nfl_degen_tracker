import type { ReactNode } from 'react'
import type { Leg, Member, Parlay } from '../../lib/parlay'
import type { ParlayInfo } from '../../lib/stats'

// What every Stats tab receives. Already filtered to the chosen season.
export type StatsData = { legs: Leg[]; parlays: Parlay[]; members: Member[]; infos: ParlayInfo[] }

export const pct = (n: number) => Math.round(n * 100) + '%'
export const pts = (e: number | null) => (e == null ? '–' : `${e >= 0 ? '+' : ''}${Math.round(e * 100)} pts`)
export const units = (u: number) => `${u >= 0 ? '+' : '-'}$${Math.abs(u).toFixed(2)}`
export const tone = (n: number | null) => (n == null ? '' : n >= 0 ? 'pos' : 'neg')
export const odds = (n: number) => (n ? `×${n.toFixed(2)}` : '–')
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
export const parlayLabel = (p: Parlay) => `${p.name || 'Parlay'}, ${p.season} week ${p.week}`

export const Scroll = ({ children }: { children: ReactNode }) => <div className="scroll">{children}</div>

// Running total of net winnings as a small line chart. Dashed line is break-even.
export function RunningNet({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="note">Settle a few parlays and your running total shows up here.</p>
  const w = 300, h = 90, pad = 6
  const all = [0, ...points]
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2)
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2)
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <>
      <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Running net, ${units(last)} after ${points.length} settled parlays`}>
        <line className="zero" x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} />
        <path className={last >= 0 ? 'up' : 'down'} d={d} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="note">Low {units(Math.min(0, ...points))} · High {units(Math.max(0, ...points))} · Now {units(last)}, over {points.length} settled parlays</p>
    </>
  )
}
