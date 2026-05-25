import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function Onboarding() {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [clinicName, setClinicName] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [frequencyMode, setFrequencyMode] = useState('none')
  const [customDays, setCustomDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!profile) {
      setChecking(false)
      return
    }
    async function checkOnboarded() {
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('has_onboarded')
        .eq('user_id', profile.id)
        .single()

      if (!error && data?.has_onboarded) {
        navigate('/therapist', { replace: true })
        return
      }
      setChecking(false)
    }
    checkOnboarded()
  }, [profile, authLoading, navigate])

  function frequencyDaysValue() {
    if (frequencyMode === 'none') return null
    if (frequencyMode === 'daily') return 1
    if (frequencyMode === 'weekly') return 7
    const n = parseInt(customDays, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setLoading(true)

    if (frequencyMode === 'custom') {
      const n = parseInt(customDays, 10)
      if (!Number.isFinite(n) || n < 1) {
        setError('Please enter a valid number of days.')
        setLoading(false)
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
          has_onboarded: true,
        },
        { onConflict: 'user_id' }
      )

    setLoading(false)
    if (error) {
      setError('Failed to save settings. Please try again.')
      return
    }
    navigate('/therapist', { replace: true })
  }

  async function handleSkip() {
    if (!profile) return
    setError(null)
    setLoading(true)

    const { error } = await supabase
      .from('therapist_profiles')
      .upsert({ user_id: profile.id, has_onboarded: true }, { onConflict: 'user_id' })

    setLoading(false)
    if (error) {
      setError('Something went wrong. Please try again.')
      return
    }
    navigate('/therapist', { replace: true })
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

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-muted">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="max-w-md w-full bg-dark-surface rounded-lg border border-dark-border p-8">
        <h1 className="text-2xl font-semibold text-dark-text">Welcome to ManualRx</h1>
        <p className="mt-1 text-sm text-dark-muted">
          Let's get you set up. This takes 30 seconds — you can change any of this later in Settings.
        </p>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand-primary text-white py-2 font-medium hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Saving…' : 'Save and continue'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-sm text-dark-muted hover:underline disabled:opacity-50 cursor-pointer"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
