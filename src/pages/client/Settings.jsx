import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useClinicName } from '../../hooks/useClinicName'
import BottomNav from '../../components/client/BottomNav'
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'

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
    <div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <PageHero title="Settings" subtitle="Preferences & account" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ padding: '16px', maxWidth: '512px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {fetching ? (
          <p style={{ fontSize: '13px', color: '#888' }}>Loading…</p>
        ) : fetchError ? (
          <p style={{ fontSize: '13px', color: '#f87171' }}>{fetchError}</p>
        ) : (
          <>
            {/* Preferences card */}
            <div style={{ ...CARD, position: 'relative' }}>
              <div style={SHIMMER} />
              <div style={SECTION_LABEL}>Preferences</div>

              <form onSubmit={handleSave} style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px' }}>Weight unit</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  {['kg', 'lb'].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setWeightUnit(unit)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '7px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        ...(weightUnit === unit
                          ? { background: '#29B5CC', color: '#000', border: 'none' }
                          : { background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.08)' }),
                      }}
                    >
                      {unit}
                    </button>
                  ))}
                </div>

                {clinicName && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Your clinic</label>
                    <p style={{ fontSize: '13px', color: '#f0f0f0', margin: 0 }}>{clinicName}</p>
                  </div>
                )}

                {saveError && <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px' }}>{saveError}</p>}
                {saveSuccess && <p style={{ fontSize: '12px', color: '#4ade80', marginBottom: '8px' }}>Settings saved.</p>}

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    background: '#29B5CC',
                    color: '#000',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '9px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </div>

            {/* Account card */}
            <div style={{ ...CARD, position: 'relative' }}>
              <div style={SHIMMER} />
              <div style={SECTION_LABEL}>Account</div>

              <div style={{ marginTop: '14px' }}>
                {passwordSuccess && (
                  <p style={{ fontSize: '12px', color: '#4ade80', marginBottom: '10px' }}>Password updated successfully.</p>
                )}

                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => { setPasswordSuccess(false); setShowPasswordForm(true) }}
                    style={{
                      background: 'transparent',
                      color: '#29B5CC',
                      border: '1px solid rgba(41,181,204,0.3)',
                      borderRadius: '7px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: '12px',
                      display: 'block',
                      width: '100%',
                    }}
                  >
                    Change password
                  </button>
                ) : (
                  <form onSubmit={handlePasswordSave} style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      ['currentPassword', 'Current password', currentPassword, setCurrentPassword],
                      ['newPassword', 'New password', newPassword, setNewPassword],
                      ['confirmPassword', 'Confirm new password', confirmPassword, setConfirmPassword],
                    ].map(([id, label, val, setter]) => (
                      <div key={id}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>{label}</label>
                        <input
                          type="password"
                          value={val}
                          onChange={(e) => setter(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '7px',
                            padding: '9px 12px',
                            color: '#f0f0f0',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    ))}
                    {passwordError && <p style={{ fontSize: '12px', color: '#f87171' }}>{passwordError}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        style={{
                          background: '#29B5CC',
                          color: '#000',
                          border: 'none',
                          borderRadius: '7px',
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: passwordLoading ? 'not-allowed' : 'pointer',
                          opacity: passwordLoading ? 0.5 : 1,
                        }}
                      >
                        {passwordLoading ? 'Updating…' : 'Update password'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelPasswordForm}
                        style={{ background: 'none', border: 'none', fontSize: '13px', color: '#888', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <p style={{ fontSize: '12px', marginBottom: '16px' }}>
                  <Link to="/forgot-password" style={{ color: '#29B5CC' }}>Forgot your password?</Link>
                </p>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                  {logoutStep === 'idle' ? (
                    <button
                      type="button"
                      onClick={() => setLogoutStep('confirming')}
                      style={{
                        background: 'transparent',
                        color: '#f87171',
                        border: '1px solid rgba(248,113,113,0.25)',
                        borderRadius: '7px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      Log out
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Log out of ManualRx?</p>
                      <button
                        type="button"
                        onClick={signOut}
                        style={{
                          background: 'transparent',
                          color: '#f87171',
                          border: '1px solid rgba(248,113,113,0.25)',
                          borderRadius: '7px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Yes, log out
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoutStep('idle')}
                        style={{ background: 'none', border: 'none', fontSize: '13px', color: '#555', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>

      <BottomNav />
    </div>
  )
}
