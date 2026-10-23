import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// One image per member, matched on file name: src/assets/shame/tim.jpg is shown for the member named Tim.
// Matching ignores case (Tim, tim, TIM). svg, jpg, jpeg, png and webp all work.
const files = import.meta.glob('../assets/shame/*.{svg,jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' })
const imageFor: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase()
  imageFor[base] = url as string
}

const MISSES_PER_LEVEL = 5
const TAUNTS = [
  'The board is watching.',
  'Your legs have left the chat.',
  'Every parlay needed you to be average. You declined.',
  'The syndicate would have been rich without you.',
  'Please stop. Actually, no, please keep going. We need the content.',
]

type Loser = { name: string }

export default function Shame() {
  const [losers, setLosers] = useState<Loser[]>([])
  const [misses, setMisses] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [l, m] = await Promise.all([
        supabase.from('legs').select('member_id').eq('result', 'miss'),
        supabase.from('members').select('id,name'),
      ])
      const counts = new Map<string, number>()
      for (const row of l.data ?? []) counts.set(row.member_id, (counts.get(row.member_id) ?? 0) + 1)
      const top = Math.max(0, ...counts.values())
      setMisses(top)
      setLosers(top > 0 ? (m.data ?? []).filter(x => counts.get(x.id) === top).map(x => ({ name: x.name })) : [])
      setLoading(false)
    })()
  }, [])

  if (loading) return null
  if (!losers.length) return <main className="shame"><p className="note">No missed legs yet. Enjoy it while it lasts.</p></main>

  const taunt = TAUNTS[Math.min(Math.floor(misses / MISSES_PER_LEVEL), TAUNTS.length - 1)]

  return (
    <main className="shame">
      <p className="shame-kicker">Wall of Shame</p>
      <h2 className="shame-name">{losers.map(x => x.name).join(' & ')}</h2>
      {losers.map(x => {
        const key = x.name.trim().toLowerCase()
        return imageFor[key]
          ? <img key={key} className="shame-img" src={imageFor[key]} alt={`Shame upon ${x.name}`} />
          : <div key={key} className="shame-img shame-missing">Add {key}.jpg to src/assets/shame/</div>
      })}
      <p className="shame-count"><strong>{misses}</strong> missed {misses === 1 ? 'leg' : 'legs'}</p>
      <p className="note">{taunt}</p>
    </main>
  )
}
