import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useClinicName } from '../../hooks/useClinicName'
import BottomNav from '../../components/client/BottomNav'
import PageHero from '../../components/shared/PageHero'
import { CARD } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { useNavigate } from 'react-router-dom'
import { getCurrentPeriodStartDate, isFormActive } from '../../utils/checkInUtils'

// frequencyLabel is defined locally — do not import from utils (that file may not exist)
function frequencyLabel(days) {
  if (!days) return 'As needed'
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  return `Every ${days} days`
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
      .select('id, name, frequency_days, start_date, duration_weeks, therapist_id, prescription_exercises(count), session_logs(completed_at)')
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

  const activeSessions = sessions.filter(isActive)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
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

          {activeSessions.map((s, i) => {
            const completions = s.session_logs ?? []
            const lastDone =
              completions.length > 0
                ? new Date(
                    Math.max(...completions.map(l => new Date(l.completed_at).getTime()))
                  ).toLocaleDateString()
                : null

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}
                style={{ ...CARD, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}
              >
                <ShimmerLine />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{s.name}</p>
                    {isRecentlyCompleted(s) && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(41,181,204,0.10)',
                        border: '1px solid rgba(41,181,204,0.2)',
                        borderRadius: '9999px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#29B5CC',
                      }}>
                        Completed
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-muted)', margin: '4px 0 0' }}>
                    {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                  </p>
                  {lastDone && (
                    <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-subtle)', margin: '2px 0 0' }}>Last completed: {lastDone}</p>
                  )}
                </div>
                <Link
                  to={`/client/sessions/${s.id}`}
                  style={{
                    flexShrink: 0,
                    background: '#29B5CC',
                    color: '#000',
                    borderRadius: '7px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Start
                </Link>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      <BottomNav />
    </div>
  )
}
