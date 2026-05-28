import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'
import { ProgressTab } from './ProgressTab'
import BottomNav from '../../components/client/BottomNav'
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function isActive(prescription) {
  const { start_date, duration_weeks } = prescription
  if (!start_date || !duration_weeks) return true
  const expiry = new Date(start_date)
  expiry.setDate(expiry.getDate() + duration_weeks * 7 + 7)
  return expiry >= new Date()
}

export default function History() {
  const { profile } = useAuth()
  const weightUnit = useWeightUnit()

  const [activeTab, setActiveTab] = useState('history')

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedLogId, setExpandedLogId] = useState(null)

  const [prescriptions, setPrescriptions] = useState([])
  const [prescriptionsLoaded, setPrescriptionsLoaded] = useState(false)
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false)

  useEffect(() => { if (profile?.id) fetchLogs() }, [profile?.id])

  async function fetchLogs() {
    const { data, error: fetchError } = await supabase
      .from('session_logs')
      .select(`
        id, completed_at, session_rpe, session_notes,
        prescriptions(name),
        exercise_logs(
          id, sets_completed, reps_completed, weight_completed,
          sets_data, pain_rating, client_notes,
          prescription_exercises(sets, reps, weight, exercises(name))
        )
      `)
      .eq('client_id', profile.id)
      .order('completed_at', { ascending: false })

    if (fetchError) setError('Failed to load session history.')
    else setLogs(data ?? [])
    setLoading(false)
  }

  async function fetchPrescriptions() {
    if (prescriptionsLoaded || prescriptionsLoading) return
    setPrescriptionsLoading(true)

    const { data: clientRecord } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!clientRecord) { setPrescriptionsLoading(false); return }

    const { data } = await supabase
      .from('prescriptions')
      .select('id, name, frequency_days, start_date, duration_weeks, therapist_id')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: true })

    setPrescriptions((data ?? []).filter(isActive))
    setPrescriptionsLoaded(true)
    setPrescriptionsLoading(false)
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (tab === 'progress') fetchPrescriptions()
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: '80px' }}>
      <PageHero title="History" subtitle="Your completed sessions" />

      {/* Tab switcher */}
      <div style={{ maxWidth: '512px', display: 'flex', gap: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '0 16px 20px', paddingTop: '4px' }}>
        {[['history', 'History'], ['progress', 'Progress']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            style={{
              paddingBottom: '10px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              ...(activeTab === tab
                ? { borderBottom: '2px solid #29B5CC', color: '#29B5CC', marginBottom: '-1px' }
                : { color: '#555' }),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'history' && (
        <>
          {loading && <p className="text-sm text-dark-muted">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="text-sm text-dark-muted">No sessions completed yet.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '512px', padding: '0 16px' }}>
            {logs.map((log, i) => {
              const isOpen = expandedLogId === log.id

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}
                  style={{ ...CARD, padding: 0, overflow: 'hidden' }}
                >
                  <div style={SHIMMER} />
                  <button
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                  >
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0', margin: 0 }}>
                        {log.prescriptions?.name ?? 'Session'} · {formatDate(log.completed_at)}
                      </p>
                      {log.session_rpe != null && (
                        <p style={{ marginTop: '2px', fontSize: '11px', color: '#888', margin: '2px 0 0' }}>RPE: {log.session_rpe}/10</p>
                      )}
                    </div>
                    <span style={{ marginLeft: '16px', fontSize: '11px', color: '#555', flexShrink: 0 }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {log.session_notes && (
                        <p style={{ padding: '8px 16px', fontSize: '11px', color: '#888', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {log.session_notes}
                        </p>
                      )}

                      <div>
                        {(log.exercise_logs ?? []).map(el => {
                          const pe = el.prescription_exercises
                          const exerciseName = pe?.exercises?.name ?? 'Exercise'
                          const hasPerSetData = Array.isArray(el.sets_data) && el.sets_data.length > 0

                          return (
                            <div key={el.id} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <p className="text-xs font-medium text-dark-text">{exerciseName}</p>

                              {pe && (
                                <p className="mt-0.5 text-xs text-dark-subtle">
                                  Prescribed: {pe.sets} sets × {pe.reps} reps{pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
                                </p>
                              )}

                              {hasPerSetData ? (
                                <div className="mt-1 space-y-0.5">
                                  {el.sets_data.map((s, si) => (
                                    <p key={si} className="text-xs text-dark-muted">
                                      Set {si + 1}: {s.reps} reps{s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-0.5 text-xs text-dark-muted">
                                  {el.sets_completed ?? '—'} sets × {el.reps_completed ?? '—'} reps
                                  {el.weight_completed ? ` @ ${formatWeight(el.weight_completed, weightUnit)}` : ''}
                                </p>
                              )}

                              {el.pain_rating != null && (
                                <p className="mt-0.5 text-xs text-dark-muted">Pain: {el.pain_rating}/10</p>
                              )}

                              {el.client_notes && (
                                <p className="mt-1 text-xs text-dark-muted">Note: {el.client_notes}</p>
                              )}
                            </div>
                          )
                        })}

                        {(log.exercise_logs ?? []).length === 0 && (
                          <p style={{ padding: '10px 16px', fontSize: '11px', color: '#555' }}>No exercise data recorded.</p>
                        )}
                      </div>

                      {log.session_rpe != null && (
                        <p style={{ padding: '8px 16px', fontSize: '11px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          Session RPE: {log.session_rpe}/10
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {activeTab === 'progress' && (
        prescriptionsLoading
          ? <p className="text-sm text-dark-muted">Loading…</p>
          : <ProgressTab prescriptions={prescriptions} />
      )}

      <BottomNav />
    </div>
  )
}
