import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useClinicName } from '../../hooks/useClinicName'
import BottomNav from '../../components/client/BottomNav'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'

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

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

    const { data, error: sessionsError } = await supabase
      .from('prescriptions')
      .select('id, name, frequency_days, start_date, duration_weeks, therapist_id, prescription_exercises(count), session_logs(completed_at)')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: true })

    if (sessionsError) setError('Failed to load sessions.')
    else setSessions(data ?? [])
    setLoading(false)
  }

  const activeSessions = sessions.filter(isActive)

  return (
    <div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: '80px' }}>
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
        {loading && <p style={{ fontSize: '13px', color: '#888' }}>Loading…</p>}
        {error && <p style={{ fontSize: '13px', color: '#f87171' }}>{error}</p>}
        {!loading && !error && activeSessions.length === 0 && (
          <p style={{ fontSize: '13px', color: '#888' }}>Your therapist hasn't added any sessions yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '512px' }}>
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
                <div style={SHIMMER} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', margin: 0 }}>{s.name}</p>
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
                  <p style={{ marginTop: '4px', fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                    {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                  </p>
                  {lastDone && (
                    <p style={{ marginTop: '2px', fontSize: '11px', color: '#555', margin: '2px 0 0' }}>Last completed: {lastDone}</p>
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
