import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useClinicName } from '../../hooks/useClinicName'
import BottomNav from '../../components/client/BottomNav'

export default function ClientSettings() {
  const { user, profile, signOut } = useAuth()
  const clinicName = useClinicName()

  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [weightUnit, setWeightUnit] = useState('kg')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [logoutStep, setLogoutStep] = useState('idle')

  const hasFetchedRef = useRef(false)
  const saveTimerRef = useRef(null)

  useEffect(() => {
    async function fetchSettings() {
      const { data, error } = await supabase
        .from('clients')
        .select('id, weight_unit')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        setFetchError('Failed to load settings. Please refresh the page.')
        setFetching(false)
        return
      }
      if (data) {
        setWeightUnit(data.weight_unit ?? 'kg')
      }
      setFetching(false)
    }
    if (profile && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchSettings()
    }
  }, [profile])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)
    setSaving(true)

    const { error } = await supabase
      .from('clients')
      .update({ weight_unit: weightUnit })
      .eq('user_id', profile.id)

    setSaving(false)
    if (error) {
      setSaveError('Failed to save settings. Please try again.')
      return
    }
    setSaveSuccess(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000)
  }

  async function handlePasswordSave(e) {
    e.preventDefault()
    setPasswordError(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }

    setPasswordLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (authError) {
      setPasswordLoading(false)
      setPasswordError('Incorrect current password.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    setPasswordLoading(false)

    if (updateError) {
      setPasswordError('Something went wrong. Please try again.')
      return
    }

    setPasswordSuccess(true)
    setShowPasswordForm(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function cancelPasswordForm() {
    setShowPasswordForm(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
  }

  return (
    <div className="min-h-screen bg-dark-bg p-6 pb-20">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-dark-text">Settings</h1>
        </div>

        {fetching ? (
          <p className="text-sm text-dark-muted">Loading…</p>
        ) : fetchError ? (
          <p className="text-sm text-red-400">{fetchError}</p>
        ) : (
          <>
            <form onSubmit={handleSave} className="bg-dark-surface rounded-lg border border-dark-border p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-muted">Weight unit</label>
                <div className="mt-1 flex gap-2">
                  {['kg', 'lb'].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setWeightUnit(unit)}
                      className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                        weightUnit === unit
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'border-dark-border text-dark-muted hover:border-dark-accent hover:text-dark-text'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              {clinicName && (
                <div>
                  <label className="block text-sm font-medium text-dark-muted">Your clinic</label>
                  <p className="mt-1 text-sm text-dark-text">{clinicName}</p>
                </div>
              )}

              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              {saveSuccess && <p className="text-sm text-green-400">Settings saved.</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded bg-brand-primary text-white py-2 text-sm font-medium hover:bg-brand-primary-dark disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <div className="bg-dark-surface rounded-lg border border-dark-border p-6 mt-4">
              <h2 className="text-sm font-medium text-dark-muted">Password</h2>
              {passwordSuccess && (
                <p className="mt-2 text-sm text-green-400">Password updated successfully.</p>
              )}
              {!showPasswordForm && (
                <button
                  type="button"
                  onClick={() => { setPasswordSuccess(false); setShowPasswordForm(true) }}
                  className="mt-3 rounded border border-dark-border px-4 py-2 text-sm font-medium text-dark-muted hover:bg-dark-elevated hover:text-dark-text"
                >
                  Change password
                </button>
              )}
              {showPasswordForm && (
                <form onSubmit={handlePasswordSave} className="mt-3 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-muted">Current password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-muted">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-muted">Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-dark-text focus:outline-none focus:ring-1 focus:ring-dark-accent"
                    />
                  </div>
                  {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="rounded bg-brand-primary text-white px-4 py-2 text-sm font-medium hover:bg-brand-primary-dark disabled:opacity-50"
                    >
                      {passwordLoading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordForm}
                      className="text-sm text-dark-muted hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <p className="mt-4 text-sm">
                <Link to="/forgot-password" className="text-brand-primary hover:underline">
                  Forgot your password?
                </Link>
              </p>
            </div>

            <div className="bg-dark-surface rounded-lg border border-dark-border p-6 mt-4">
              {logoutStep === 'idle' ? (
                <button
                  type="button"
                  onClick={() => setLogoutStep('confirming')}
                  className="rounded border border-dark-border px-4 py-2 text-sm text-dark-muted hover:bg-dark-elevated hover:text-dark-text transition-colors"
                >
                  Log out
                </button>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-dark-muted">Log out of ManualRx?</p>
                  <button
                    type="button"
                    onClick={signOut}
                    className="rounded border border-red-800/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    Yes, log out
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoutStep('idle')}
                    className="text-sm text-dark-subtle hover:text-dark-muted"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
