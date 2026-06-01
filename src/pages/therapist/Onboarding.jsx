import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../../components/shared/ThemeToggle'
import ShimmerLine from '../../components/shared/ShimmerLine'

export default function Onboarding() {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [clinicName, setClinicName] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [frequencyMode, setFrequencyMode] = useState('none')
  const [customDays, setCustomDays] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState(null)
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

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setLogoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}.${ext}`
    // NOTE: The 'clinic-logos' bucket must be created manually in the
    // Supabase Storage dashboard with public access enabled before this works.
    const { error: upErr } = await supabase.storage
      .from('clinic-logos')
      .upload(path, file, { upsert: true })
    if (upErr) {
      setLogoError('Logo upload failed. Please try again.')
      setLogoUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('clinic-logos').getPublicUrl(path)
    const publicUrl = urlData.publicUrl
    const { error: dbErr } = await supabase
      .from('therapist_profiles')
      .upsert({ user_id: profile.id, logo_url: publicUrl }, { onConflict: 'user_id' })
    if (dbErr) {
      setLogoError('Logo upload failed. Please try again.')
      setLogoUploading(false)
      return
    }
    setLogoUrl(publicUrl)
    setLogoUploading(false)
  }

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

  const inputStyle = {
    background: 'var(--color-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: '7px',
    color: 'var(--color-text)',
    padding: '9px 14px',
    width: '100%',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const activeToggleStyle = {
    flex: 1,
    padding: '8px',
    background: 'rgba(41,181,204,0.12)',
    border: '1px solid rgba(41,181,204,0.3)',
    color: '#29B5CC',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const inactiveToggleStyle = {
    flex: 1,
    padding: '8px',
    background: 'var(--color-elevated)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-muted)',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const activeGridStyle = {
    padding: '8px',
    background: 'rgba(41,181,204,0.12)',
    border: '1px solid rgba(41,181,204,0.3)',
    color: '#29B5CC',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const inactiveGridStyle = {
    padding: '8px',
    background: 'var(--color-elevated)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-muted)',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const fieldLabelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text)',
    marginBottom: '6px',
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-muted">Loading…</div>
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '24px 16px' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: '440px',
          background: 'var(--color-surface)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          overflow: 'hidden', position: 'relative',
        }}
      >
        {/* Shimmer top border */}
        <ShimmerLine />
        <div style={{ padding: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Welcome to ManualRx</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: '0 0 28px' }}>Let's get you set up. Takes 30 seconds — change anything later in Settings.</p>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Logo upload */}
            <div>
              <label style={fieldLabelStyle}>Clinic logo</label>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 8px' }}>Shown to clients during their sessions. Optional.</p>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Clinic logo"
                  style={{ maxHeight: '48px', objectFit: 'contain', borderRadius: '6px', marginBottom: '8px', display: 'block' }}
                />
              )}
              <label style={{
                display: 'inline-block',
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
                fontSize: '13px',
                borderRadius: '7px',
                padding: '7px 14px',
                cursor: logoUploading ? 'not-allowed' : 'pointer',
                opacity: logoUploading ? 0.5 : 1,
                pointerEvents: logoUploading ? 'none' : 'auto',
              }}>
                {logoUploading ? 'Uploading…' : 'Choose image'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={logoUploading}
                  onChange={handleLogoUpload}
                />
              </label>
              {logoError && <p style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-danger)' }}>{logoError}</p>}
            </div>

            {/* Clinic name */}
            <div>
              <label style={fieldLabelStyle}>Clinic name</label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. City Physio"
                style={inputStyle}
              />
            </div>

            {/* Weight unit */}
            <div>
              <label style={fieldLabelStyle}>Weight unit</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                {['kg', 'lb'].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setWeightUnit(unit)}
                    style={weightUnit === unit ? activeToggleStyle : inactiveToggleStyle}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div>
              <label style={fieldLabelStyle}>Theme</label>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 6px' }}>Change anytime in Settings</p>
              <ThemeToggle />
            </div>

            {/* Default frequency */}
            <div>
              <label style={fieldLabelStyle}>Default session frequency</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '2px' }}>
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
                    style={frequencyMode === value ? activeGridStyle : inactiveGridStyle}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {frequencyMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="e.g. 3"
                    style={{ ...inputStyle, width: '96px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>days between sessions</span>
                </div>
              )}
            </div>

            {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingTop: '4px' }}>
              <button type="submit" disabled={loading} style={{ padding: '9px 20px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Saving…' : 'Save and continue'}
              </button>
              <button type="button" onClick={handleSkip} disabled={loading} style={{ fontSize: '13px', color: 'var(--color-subtle)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: loading ? 0.6 : 1 }}>
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
