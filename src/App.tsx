import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Week from './pages/Week'
import Stats from './pages/Stats'
import Shame from './pages/Shame'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'week' | 'stats' | 'shame'>('week')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />

  return (
    <div className="shell">
      <header className="top">
        <h1>Parlay Syndicate</h1>
        <nav>
          <button className={tab === 'week' ? 'on' : ''} onClick={() => setTab('week')}>Weeks</button>
          <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Stats</button>
          <button className={tab === 'shame' ? 'on' : ''} onClick={() => setTab('shame')}>Shame</button>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </nav>
      </header>
      {tab === 'week' ? <Week userId={session.user.id} /> : tab === 'stats' ? <Stats /> : <Shame />}
    </div>
  )
}
