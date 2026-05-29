import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { SECTION_LABEL } from '../../components/therapist/styles'
import useIsMobile from '../../hooks/useIsMobile'

export default function Settings() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()

  const [fetching, setFetching] = useState(true)
  const [clinicName, setClinicName] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [frequencyMode, setFrequencyMode] = useState('none')
  const [customDays, setCustomDays] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState(null)
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
        .select('clinic_name, weight_unit, default_frequency_days, logo_url')
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
        setLogoUrl(data.logo_url ?? null)

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

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '7px',
    color: '#e8edf5',
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
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#888',
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
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#888',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const dividerStyle = {
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
    margin: '0 0 24px',
  }

  const fieldLabelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#c8d0dc',
    marginBottom: '6px',
  }

  return (
    <SidebarLayout>
      <PageHero title="Settings" subtitle="Clinic preferences and account" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '520px' }}
      >
        {fetching ? (
          <p style={{ color: '#888', fontSize: '14px' }}>Loading…</p>
        ) : fetchError ? (
          <p style={{ color: '#f87171', fontSize: '13px' }}>{fetchError}</p>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* CLINIC section */}
            <p style={{ ...SECTION_LABEL, marginBottom: '16px' }}>Clinic</p>

            <div style={{ marginBottom: '20px' }}>
              <label style={fieldLabelStyle}>Clinic logo</label>
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px' }}>Shown to clients during their sessions. Optional.</p>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Clinic logo"
                  style={{ maxHeight: '48px', objectFit: 'contain', borderRadius: '6px', marginBottom: '8px', display: 'block' }}
                />
              )}
              <label style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#888',
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
              {logoError && <p style={{ marginTop: '6px', fontSize: '13px', color: '#f87171' }}>{logoError}</p>}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={fieldLabelStyle}>Clinic name</label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. City Physio"
                style={inputStyle}
              />
            </div>

            <div style={dividerStyle} />

            {/* PREFERENCES section */}
            <p style={{ ...SECTION_LABEL, marginBottom: '16px' }}>Preferences</p>

            <div style={{ marginBottom: '20px' }}>
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

            <div style={{ marginBottom: '20px' }}>
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
                  <span style={{ fontSize: '13px', color: '#888' }}>days between sessions</span>
                </div>
              )}
            </div>

            <div style={dividerStyle} />

            {error && <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>{error}</p>}
            {success && <p style={{ fontSize: '13px', color: '#4ade80', marginBottom: '16px' }}>Settings saved.</p>}

            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#29B5CC',
                color: '#000',
                border: 'none',
                borderRadius: '7px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                alignSelf: 'flex-start',
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

        {!fetching && !fetchError && (
          <div style={{ marginTop: '32px' }}>
            <div style={dividerStyle} />

            {/* ACCOUNT section */}
            <p style={{ ...SECTION_LABEL, marginBottom: '16px' }}>Account</p>

            <div>
              {passwordSuccess && (
                <p style={{ fontSize: '13px', color: '#4ade80', marginBottom: '12px' }}>Password updated successfully.</p>
              )}
              {!showPasswordForm && (
                <button
                  type="button"
                  onClick={() => { setPasswordSuccess(false); setShowPasswordForm(true) }}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#888',
                    borderRadius: '7px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Change password
                </button>
              )}
              {showPasswordForm && (
                <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={fieldLabelStyle}>Current password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabelStyle}>Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>
                  {passwordError && <p style={{ fontSize: '13px', color: '#f87171' }}>{passwordError}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      style={{
                        background: '#29B5CC',
                        color: '#000',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '9px 20px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: passwordLoading ? 'not-allowed' : 'pointer',
                        opacity: passwordLoading ? 0.6 : 1,
                      }}
                    >
                      {passwordLoading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordForm}
                      style={{ fontSize: '13px', color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </SidebarLayout>
  )
}
