import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

export default function Join() {
  const { code } = useParams()

  const [invite, setInvite] = useState(null)
  const [therapistFirstName, setTherapistFirstName] = useState(null)
  const [checkLoading, setCheckLoading] = useState(true)
  const [checkError, setCheckError] = useState(null)

  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function validateCode() {
      const { data, error } = await supabase
        .from('client_invites')
        .select('id, email, name, consumed_at, expires_at, therapist_id')
        .eq('code', code)
        .single()

      if (error || !data) {
        setCheckError('This invite link is invalid.')
        setCheckLoading(false)
        return
      }

      if (data.consumed_at) {
        setCheckError('This invite has already been used.')
        setCheckLoading(false)
        return
      }

      if (new Date(data.expires_at) < new Date()) {
        setCheckError('This invite link has expired. Ask your therapist to send a new one.')
        setCheckLoading(false)
        return
      }

      setInvite(data)

      const { data: therapistUser } = await supabase
        .from('users')
        .select('name')
        .eq('id', data.therapist_id)
        .maybeSingle()
      if (therapistUser?.name) setTherapistFirstName(therapistUser.name.split(' ')[0])

      setCheckLoading(false)
    }

    validateCode()
  }, [code])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (!password || !confirmPwd) {
      setFormError('Please fill in both password fields.')
      return
    }
    if (password !== confirmPwd) {
      setFormError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }

    setSubmitLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: { role: 'client', name: invite.name, therapist_id: invite.therapist_id },
      },
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setFormError("You already have an account. Just log in and you'll be connected to your new therapist automatically.")
      } else {
        setFormError(signUpError.message)
      }
      setSubmitLoading(false)
      return
    }

    if (!data.user?.id) {
      setFormError('Could not create your account. Please try again.')
      setSubmitLoading(false)
      return
    }

    if (!data.session) {
      setFormError('Account created but sign-in failed. Please contact your therapist.')
      setSubmitLoading(false)
      return
    }

    setSubmitLoading(false)
    setSuccess(true)
  }

  if (checkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <p className="text-dark-muted text-sm">Checking invite…</p>
      </div>
    )
  }

  if (checkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
        <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
          <p className="text-dark-text font-medium">{checkError}</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-dark-accent hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
        <div className="max-w-md w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
          <h2 className="text-xl font-semibold text-dark-text">You're all set</h2>
          <p className="mt-3 text-dark-muted">
            Your account has been created. You can now log in with{' '}
            <strong className="text-dark-text">{invite.email}</strong>.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded bg-brand-primary px-5 py-2 text-sm text-white hover:bg-brand-primary-dark"
          >
            Go to login
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
        <h1 className="text-2xl font-semibold text-dark-text">Set up your account</h1>
        <p className="mt-1 text-sm text-dark-muted">
          {therapistFirstName ? `${therapistFirstName} has invited you to join.` : 'Welcome, set a password to activate your account.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-muted">Email</label>
            <input
              type="email"
              value={invite.email}
              disabled
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-subtle"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-dark-muted">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-muted">Confirm password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
            />
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={submitLoading}
            className="w-full rounded bg-brand-primary py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
          >
            {submitLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
