import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em', lineHeight: 1 }}>
        <span style={{ color: 'var(--color-text)' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'therapist',
          name: name,
        },
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // If email confirmation is required, no session is returned
    if (!data.session) {
      setSubmitted(true)
      return
    }

    // Otherwise, user is logged in immediately
    navigate('/onboarding')
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
        <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
          <h2 className="text-xl font-semibold text-dark-text">Check your email</h2>
          <p className="mt-3 text-dark-muted">
            We sent a confirmation link to <strong className="text-dark-text">{email}</strong>. Click it to activate your account, then log in.
          </p>
          <Link to="/login" className="mt-6 inline-block text-dark-accent hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8">
        <div className="mb-6">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold text-dark-text">Create therapist account</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
            />
          </div>

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
              minLength={6}
              required
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
            />
            <p className="mt-1 text-xs text-dark-muted">Minimum 6 characters</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand-primary text-[#0a0a0a] py-2 font-semibold hover:bg-brand-primary-dark disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-sm text-dark-muted text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-dark-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
