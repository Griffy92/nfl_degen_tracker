import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin, data: name ? { name } : undefined },
    })
    if (error) setError(error.message); else setSent(true)
  }

  return (
    <div className="login">
      <h1>Parlay Syndicate</h1>
      {sent ? <p>Check {email} for your sign-in link.</p> : (
        <form onSubmit={submit}>
          <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Display name (first time only)<input value={name} onChange={e => setName(e.target.value)} /></label>
          <button className="primary">Email me a sign-in link</button>
          {error && <p className="err">{error}</p>}
        </form>
      )}
    </div>
  )
}
