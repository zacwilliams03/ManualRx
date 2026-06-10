import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useClinicName } from '../../hooks/useClinicName'
import { pdf } from '@react-pdf/renderer'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { PrescriptionPDF } from '../../components/therapist/PrescriptionPDF'
import { AllSessionsPDF } from '../../components/therapist/AllSessionsPDF'
import BottomNav from '../../components/client/BottomNav'
import PageHero from '../../components/shared/PageHero'
import { CARD } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { getCurrentPeriodStartDate, isFormActive } from '../../utils/checkInUtils'
import { frequencyLabel } from '../../utils/frequencyUtils'

function currentProgramWeek(startDate) {
  if (!startDate) return null
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  return Math.floor(days / 7) + 1
}

function isAvailableNow(session) {
  if (!session.week_number || !session.start_date) return true
  const week = currentProgramWeek(session.start_date)
  if (week === null) return false
  return session.week_number <= week
}

function isRecentlyCompleted(session) {
  const logs = (session.session_logs ?? []).filter(l => l.completed_at)
  if (logs.length === 0) return false
  const lastMs = Math.max(...logs.map(l => new Date(l.completed_at).getTime()))
  if (!session.frequency_days) return true
  const daysSince = (Date.now() - lastMs) / (1000 * 60 * 60 * 24)
  return daysSince < session.frequency_days
}

function isActive(prescription) {
  const { start_date, duration_weeks } = prescription
  if (!start_date || !duration_weeks) return true
  const expiry = new Date(start_date)
  expiry.setDate(expiry.getDate() + duration_weeks * 7 + 7)
  return expiry >= new Date()
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const clinicName = useClinicName()
  // useWeightUnit() for a client reads clients.weight_unit — the client's own display preference.
  // Prescription weights are stored in canonical kg; formatWeight converts on render.
  // This is the same approach SessionWizard uses for the same client-facing exercise display.
  const weightUnit = useWeightUnit()
  const [downloadingId, setDownloadingId] = useState(null)
  const [downloadError, setDownloadError] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkInInstances, setCheckInInstances] = useState([])
  const [checkInsLoading, setCheckInsLoading] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchSessions()
  }, [profile?.id])

  async function fetchSessions() {
    const { data: clientRecord, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (clientError || !clientRecord) {
      setError('Could not load your profile. Please contact your therapist.')
      setLoading(false)
      return
    }

    fetchCheckIns(clientRecord.id)

    const { data, error: sessionsError } = await supabase
      .from('prescriptions')
      .select('id, name, frequency_days, start_date, duration_weeks, therapist_id, week_number, prescription_exercises(count), session_logs(completed_at)')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: true })

    if (sessionsError) setError('Failed to load sessions.')
    else setSessions(data ?? [])
    setLoading(false)
  }

  async function fetchCheckIns(clientId) {
    setCheckInsLoading(true)
    try {
      const { data: forms } = await supabase
        .from('check_in_forms')
        .select('id, name, day_of_week, start_date, duration_weeks, check_in_questions(count)')
        .eq('client_id', clientId)
        .eq('is_template', false)

      const activeForms = (forms ?? []).filter(isFormActive)

      await Promise.all(activeForms.map(async form => {
        const period = getCurrentPeriodStartDate(form)
        if (!period) return
        const periodISO = period.toISOString().split('T')[0]
        // ON CONFLICT (form_id, client_id, period_start_date) DO NOTHING — the unique
        // constraint means a duplicate insert returns a Postgres error, which the outer
        // try/catch silently swallows. This is the intended behaviour.
        await supabase.from('check_in_instances').insert({
          form_id: form.id,
          client_id: clientId,
          period_start_date: periodISO,
        })
      }))

      const { data: pending } = await supabase
        .from('check_in_instances')
        .select('id, period_start_date, check_in_forms(name, check_in_questions(count))')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('period_start_date', { ascending: false })

      setCheckInInstances(pending ?? [])
    } catch {
      // Silent degradation — session cards still render
    } finally {
      setCheckInsLoading(false)
    }
  }

  async function downloadSession(session) {
    setDownloadingId(session.id)
    setDownloadError(null)
    try {
      const { data: exercises, error } = await supabase
        .from('prescription_exercises')
        .select('sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
        .eq('prescription_id', session.id)
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)

      const mapped = (exercises ?? []).map(pe => ({
        name: pe.exercises?.name ?? '',
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.weight,
        therapist_notes: pe.therapist_notes,
        measurement_type: pe.measurement_type ?? 'reps',
        bilateral: pe.bilateral ?? false,
        tempo_eccentric: pe.tempo_eccentric ?? null,
        tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
        tempo_concentric: pe.tempo_concentric ?? null,
        tempo_top_pause: pe.tempo_top_pause ?? null,
        prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
      }))

      const blob = await pdf(
        <PrescriptionPDF
          clinicName={clinicName ?? ''}
          clientName={profile.name ?? profile.email ?? ''}
          prescriptionName={session.name}
          frequencyLabel={[session.week_number ? `Week ${session.week_number}` : null, frequencyLabel(session.frequency_days)].filter(Boolean).join(' · ')}
          exercises={mapped}
          weightUnit={weightUnit}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${session.name.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Failed to download PDF.')
      setTimeout(() => setDownloadError(null), 5000)
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadAllSessions() {
    setDownloadingId('all')
    setDownloadError(null)
    try {
      const toDownload = sessions.filter(isActive)
      const activeIds = toDownload.map(s => s.id)

      // Single batched query — one round trip regardless of session count
      const { data: allExercises, error } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
        .in('prescription_id', activeIds)
        .order('prescription_id', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)

      // Group exercises by prescription_id
      const byId = {}
      for (const pe of allExercises ?? []) {
        ;(byId[pe.prescription_id] ??= []).push(pe)
      }

      const mapEx = pe => ({
        name: pe.exercises?.name ?? '',
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.weight,
        therapist_notes: pe.therapist_notes,
        measurement_type: pe.measurement_type ?? 'reps',
        bilateral: pe.bilateral ?? false,
        tempo_eccentric: pe.tempo_eccentric ?? null,
        tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
        tempo_concentric: pe.tempo_concentric ?? null,
        tempo_top_pause: pe.tempo_top_pause ?? null,
        prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
      })

      const prescriptions = toDownload.map(session => ({
        name: session.name,
        weekNumber: session.week_number ?? null,
        frequencyLabel: frequencyLabel(session.frequency_days),
        exercises: (byId[session.id] ?? []).map(mapEx),
      }))

      const blob = await pdf(
        <AllSessionsPDF
          clinicName={clinicName ?? ''}
          clientName={profile.name ?? profile.email ?? ''}
          prescriptions={prescriptions}
          weightUnit={weightUnit}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(profile.name ?? profile.email ?? 'sessions').toLowerCase().replace(/\s+/g, '-')}-all-sessions.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Failed to download PDF.')
      setTimeout(() => setDownloadError(null), 5000)
    } finally {
      setDownloadingId(null)
    }
  }

  const activeSessions = sessions.filter(isActive)
  const currentSessions = activeSessions.filter(isAvailableNow)
  const futureSessions = activeSessions.filter(s => !isAvailableNow(s))
  const visibleSessions = showAll ? activeSessions : currentSessions

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <PageHero
        title="My Sessions"
        subtitle={`${profile?.name ?? ''}${clinicName ? ` · ${clinicName}` : ''}`}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ padding: '16px' }}
      >
        {loading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
        {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)' }}>{error}</p>}
        {!loading && !error && activeSessions.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Your therapist hasn't added any sessions yet.</p>
        )}
        {!loading && !error && activeSessions.length > 0 && currentSessions.length === 0 && !showAll && (
          <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No sessions due yet this week.</p>
        )}

        {activeSessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', maxWidth: '512px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={downloadAllSessions}
                disabled={downloadingId !== null}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: '1px solid var(--color-border)',
                  borderRadius: '7px', padding: '8px 14px',
                  fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)',
                  cursor: downloadingId !== null ? 'default' : 'pointer',
                  opacity: downloadingId === 'all' ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {downloadingId === 'all' ? (
                  <svg style={{ width: '14px', height: '14px', animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                  </svg>
                ) : (
                  <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                {downloadingId === 'all' ? 'Preparing PDF…' : 'Download all sessions'}
              </button>
              {futureSessions.length > 0 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: showAll ? 'rgba(41,181,204,0.1)' : 'none',
                    border: showAll ? '1px solid rgba(41,181,204,0.3)' : '1px solid var(--color-border)',
                    borderRadius: '7px', padding: '8px 14px',
                    fontSize: '12px', fontWeight: 600,
                    color: showAll ? '#29B5CC' : 'var(--color-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {showAll ? 'This week only' : `View full program · ${futureSessions.length} upcoming`}
                </button>
              )}
            </div>
            {downloadError && (
              <p style={{ fontSize: '11px', color: 'var(--color-danger)', margin: 0 }}>{downloadError}</p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '512px' }}>
          {checkInInstances.map((instance, i) => (
            <motion.div
              key={instance.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.2), duration: 0.25 }}
              style={{
                background: 'var(--color-surface)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '14px',
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), rgba(251,191,36,0.3), transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '9999px', padding: '3px 9px', fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✦ Check-In
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-subtle)' }}>
                  Due {new Date(instance.period_start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '3px' }}>
                {instance.check_in_forms?.name ?? 'Check-In'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '14px' }}>
                {instance.check_in_forms?.check_in_questions?.[0]?.count ?? 0} questions · ~1 min
              </div>
              <button
                onClick={() => navigate(`/client/checkin/${instance.id}`)}
                style={{ width: '100%', padding: '11px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', color: '#f59e0b', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Complete Check-In →
              </button>
            </motion.div>
          ))}

          {visibleSessions.map((s, i) => {
            const completions = s.session_logs ?? []
            const lastDone =
              completions.length > 0
                ? new Date(
                    Math.max(...completions.map(l => new Date(l.completed_at).getTime()))
                  ).toLocaleDateString()
                : null
            const isFuture = showAll && !isAvailableNow(s)

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}
                style={{ ...CARD, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', opacity: isFuture ? 0.6 : 1 }}
              >
                <ShimmerLine />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{s.name}</p>
                    {isFuture && s.week_number && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)',
                        borderRadius: '9999px', padding: '2px 8px',
                        fontSize: '10px', fontWeight: 600, color: 'var(--color-subtle)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        Week {s.week_number}
                      </span>
                    )}
                    {!isFuture && isRecentlyCompleted(s) && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: 'rgba(41,181,204,0.10)', border: '1px solid rgba(41,181,204,0.2)',
                        borderRadius: '9999px', padding: '2px 8px',
                        fontSize: '11px', fontWeight: 600, color: '#29B5CC',
                      }}>
                        Completed
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-muted)', margin: '4px 0 0' }}>
                    {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                  </p>
                  {lastDone && !isFuture && (
                    <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-subtle)', margin: '2px 0 0' }}>Last completed: {lastDone}</p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => downloadSession(s)}
                    disabled={downloadingId !== null}
                    title="Download PDF"
                    style={{
                      background: 'none', border: 'none', cursor: downloadingId !== null ? 'default' : 'pointer',
                      padding: '4px', color: 'var(--color-subtle)',
                      opacity: downloadingId === s.id ? 0.5 : 1,
                    }}
                  >
                    {downloadingId === s.id ? (
                      <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 2a10 10 0 1 0 10 10" />
                      </svg>
                    ) : (
                      <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    )}
                  </button>
                  {isFuture ? (
                    <span style={{ fontSize: '11px', color: 'var(--color-subtle)', padding: '7px 2px' }}>Upcoming</span>
                  ) : (
                    <Link
                      to={`/client/sessions/${s.id}`}
                      style={{
                        background: '#29B5CC', color: '#000', borderRadius: '7px',
                        padding: '7px 14px', fontSize: '12px', fontWeight: 600,
                        textDecoration: 'none', display: 'inline-block',
                      }}
                    >
                      Start
                    </Link>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      <BottomNav />
    </div>
  )
}
