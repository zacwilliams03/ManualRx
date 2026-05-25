import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em', lineHeight: 1 }}>
        <span style={{ color: '#f0f0f0' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    // Look up role to decide where to send them
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    setLoading(false)

    if (profileError || !profile) {
      setError('Could not load user profile. Please contact support.')
      return
    }

    if (profile.role === 'therapist') {
      navigate('/therapist')
    } else if (profile.role === 'client') {
      navigate('/client')
    } else {
      setError('Unknown account type. Please contact support.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8">
        <div className="mb-6">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold text-dark-text">Log in</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
            />
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-dark-accent hover:underline">
              Forgot your password?
            </Link>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand-primary text-[#0a0a0a] py-2 font-semibold hover:bg-brand-primary-dark disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-dark-muted text-center">
          No account?{' '}
          <Link to="/signup" className="text-dark-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
