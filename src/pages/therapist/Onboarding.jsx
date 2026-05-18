import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function Onboarding() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [clinicName, setClinicName] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [frequencyMode, setFrequencyMode] = useState('none') // 'none' | 'daily' | 'weekly' | 'custom'
  const [customDays, setCustomDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
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
    if (profile) checkOnboarded()
  }, [profile, navigate])

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
    setLoading(true)

    const { error } = await supabase
      .from('therapist_profiles')
      .upsert(
        {
          user_id: profile.id,
          clinic_name: clinicName,
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

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome to ManualRx</h1>
        <p className="mt-1 text-sm text-gray-500">
          Let's get you set up. This takes 30 seconds — you can change any of this later in Settings.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Clinic name</label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. City Physio"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Weight unit</label>
            <div className="mt-1 flex gap-2">
              {['kg', 'lb'].map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setWeightUnit(unit)}
                  className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                    weightUnit === unit
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Default session frequency</label>
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
                  className={`py-2 rounded border text-sm font-medium transition-colors ${
                    frequencyMode === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
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
                  className="w-24 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">days between sessions</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 text-white py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save and continue'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-sm text-gray-500 hover:underline disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
