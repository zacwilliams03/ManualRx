import { useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })

    setLoading(false)

    if (error) {
      setError('Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8">
        <div className="mb-6">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold text-dark-text">Reset your password</h1>

        {submitted ? (
          <div className="mt-6">
            <p className="text-sm text-dark-muted">
              If this email is registered, you'll receive a reset link shortly. Check your inbox.
            </p>
            <p className="mt-4 text-sm text-center">
              <Link to="/login" className="text-dark-accent hover:underline">Back to log in</Link>
            </p>
          </div>
        ) : (
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

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-brand-primary text-[#0a0a0a] py-2 font-semibold hover:bg-brand-primary-dark disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="text-sm text-dark-muted text-center">
              <Link to="/login" className="text-dark-accent hover:underline">Back to log in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
