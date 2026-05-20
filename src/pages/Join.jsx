import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Join() {
  const { code } = useParams()

  const [invite, setInvite] = useState(null)
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
        data: { role: 'client', name: invite.name },
      },
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setFormError('An account with this email already exists. Please log in.')
      } else {
        setFormError(signUpError.message)
      }
      setSubmitLoading(false)
      return
    }

    const userId = data.user?.id

    if (userId) {
      const { error: linkError } = await supabase
        .from('clients')
        .update({ user_id: userId })
        .eq('email', invite.email)
        .eq('therapist_id', invite.therapist_id)

      if (linkError) {
        setFormError('Account created but could not link your profile. Please contact your therapist.')
        setSubmitLoading(false)
        return
      }

      await supabase
        .from('client_invites')
        .update({ consumed_at: new Date().toISOString() })
        .eq('code', code)
    }

    setSubmitLoading(false)
    setSuccess(true)
  }

  if (checkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Checking invite…</p>
      </div>
    )
  }

  if (checkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-800 font-medium">{checkError}</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-brand-primary hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">You're all set</h2>
          <p className="mt-3 text-gray-600">
            Your account has been created. You can now log in with{' '}
            <strong>{invite.email}</strong>.
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Set up your account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome, {invite.name}. Choose a password to activate your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={invite.email}
              disabled
              className="mt-1 w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

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
