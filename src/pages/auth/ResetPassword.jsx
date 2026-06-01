import { useState, useEffect } from 'react'
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

export default function ResetPassword() {
  const navigate = useNavigate()
  const [pageState, setPageState] = useState('checking') // 'checking' | 'ready' | 'invalid'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // 3-second fallback — tune after testing on real devices / slow connections.
    // PASSWORD_RECOVERY can fire after this cutoff on slow networks, incorrectly
    // showing the invalid state for a valid link.
    const timeout = setTimeout(() => {
      setPageState(s => s === 'checking' ? 'invalid' : s)
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timeout)
        setPageState('ready')
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      console.error('updateUser error:', error)
      setError('Something went wrong. Please try again.')
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/login'), 1500)
  }

  if (pageState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <p className="text-sm text-dark-muted">Verifying link…</p>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
        <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
          <p className="text-sm text-dark-muted">This link is invalid or has expired.</p>
          <p className="mt-4 text-sm">
            <Link to="/forgot-password" className="text-dark-accent hover:underline">
              Request a new reset link
            </Link>
          </p>
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
        <h1 className="text-2xl font-semibold text-dark-text">Set new password</h1>

        {success ? (
          <p className="mt-6 text-sm text-dark-muted">Password updated. Redirecting to login…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-muted">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-muted">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-brand-primary text-[#0a0a0a] py-2 font-semibold hover:bg-brand-primary-dark disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
