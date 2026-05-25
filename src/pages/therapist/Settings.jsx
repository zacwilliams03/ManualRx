import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import SidebarLayout from '../../components/therapist/SidebarLayout'

export default function Settings() {
  const { user, profile } = useAuth()

  const [fetching, setFetching] = useState(true)
  const [clinicName, setClinicName] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [frequencyMode, setFrequencyMode] = useState('none')
  const [customDays, setCustomDays] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const successTimerRef = useRef(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    async function fetchSettings() {
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('clinic_name, weight_unit, default_frequency_days')
        .eq('user_id', profile.id)
        .maybeSingle()

      if (error) {
        setFetchError('Failed to load settings. Please refresh the page.')
        setFetching(false)
        return
      }
      if (data) {
        setClinicName(data.clinic_name ?? '')
        setWeightUnit(data.weight_unit ?? 'kg')

        const d = data.default_frequency_days
        if (d === null || d === undefined) setFrequencyMode('none')
        else if (d === 1) setFrequencyMode('daily')
        else if (d === 7) setFrequencyMode('weekly')
        else { setFrequencyMode('custom'); setCustomDays(String(d)) }
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
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  function frequencyDaysValue() {
    if (frequencyMode === 'none') return null
    if (frequencyMode === 'daily') return 1
    if (frequencyMode === 'weekly') return 7
    const n = parseInt(customDays, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    if (frequencyMode === 'custom') {
      const n = parseInt(customDays, 10)
      if (!Number.isFinite(n) || n < 1) {
        setError('Please enter a valid number of days.')
        setSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('therapist_profiles')
      .upsert(
        {
          user_id: profile.id,
          clinic_name: clinicName || null,
          weight_unit: weightUnit,
          default_frequency_days: frequencyDaysValue(),
        },
        { onConflict: 'user_id' }
      )

    setSaving(false)
    if (error) {
      setError('Failed to save settings. Please try again.')
      return
    }
    setSuccess(true)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSuccess(false), 3000)
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

  const inputClass = 'mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:outline-none focus:ring-2 focus:ring-brand-primary'
  const toggleBtnClass = (active) =>
    `flex-1 py-2 rounded border text-sm font-medium transition-colors cursor-pointer ${
      active
        ? 'bg-brand-primary text-white border-brand-primary'
        : 'border-dark-border text-dark-muted hover:border-dark-muted'
    }`
  const gridBtnClass = (active) =>
    `py-2 rounded border text-sm font-medium transition-colors cursor-pointer ${
      active
        ? 'bg-brand-primary text-white border-brand-primary'
        : 'border-dark-border text-dark-muted hover:border-dark-muted'
    }`

  return (
    <SidebarLayout>
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-dark-text">Settings</h1>

        {fetching ? (
          <p className="mt-6 text-dark-muted">Loading…</p>
        ) : fetchError ? (
          <p className="mt-6 text-sm text-red-400">{fetchError}</p>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-dark-text">Clinic name</label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. City Physio"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text">Weight unit</label>
              <div className="mt-1 flex gap-2">
                {['kg', 'lb'].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setWeightUnit(unit)}
                    className={toggleBtnClass(weightUnit === unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text">Default session frequency</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[
                  { value: 'none', label: 'No repeat' },
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'custom', label: 'Custom' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFrequencyMode(value)}
                    className={gridBtnClass(frequencyMode === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {frequencyMode === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-24 rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <span className="text-sm text-dark-muted">days between sessions</span>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">Settings saved.</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded bg-brand-primary text-white py-2 font-medium hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

        {!fetching && !fetchError && (
          <div className="mt-6">
            <hr className="border-dark-border" />
            <div className="mt-6">
              <h2 className="text-sm font-medium text-dark-text">Password</h2>
              {passwordSuccess && (
                <p className="mt-2 text-sm text-green-400">Password updated successfully.</p>
              )}
              {!showPasswordForm && (
                <button
                  type="button"
                  onClick={() => { setPasswordSuccess(false); setShowPasswordForm(true) }}
                  className="mt-3 rounded border border-dark-border px-4 py-2 text-sm font-medium text-dark-muted hover:bg-dark-elevated hover:text-dark-text cursor-pointer transition-colors duration-150"
                >
                  Change password
                </button>
              )}
              {showPasswordForm && (
                <form onSubmit={handlePasswordSave} className="mt-3 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-text">Current password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-text">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-text">Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="rounded bg-brand-primary text-white px-4 py-2 text-sm font-medium hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
                    >
                      {passwordLoading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordForm}
                      className="text-sm text-dark-muted hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
