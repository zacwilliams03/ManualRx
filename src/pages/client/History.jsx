import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'
import { ProgressTab } from './ProgressTab'
import BottomNav from '../../components/client/BottomNav'

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
    <div className="min-h-[100dvh] bg-dark-bg p-6 pb-20">
      <div className="mb-6 max-w-lg">
        <h1 className="text-2xl font-semibold text-dark-text">History</h1>
      </div>

      {/* Tab switcher */}
      <div className="max-w-lg flex gap-6 border-b border-dark-border mb-6">
        {[['history', 'History'], ['progress', 'Progress']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-dark-accent text-dark-accent'
                : 'text-dark-subtle hover:text-dark-muted'
            }`}
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

          <div className="space-y-3 max-w-lg">
            {logs.map(log => {
              const isOpen = expandedLogId === log.id

              return (
                <div key={log.id} className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated transition-colors"
                    onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                  >
                    <div>
                      <p className="text-sm font-medium text-dark-text">
                        {log.prescriptions?.name ?? 'Session'} · {formatDate(log.completed_at)}
                      </p>
                      {log.session_rpe != null && (
                        <p className="mt-0.5 text-xs text-dark-muted">RPE: {log.session_rpe}/10</p>
                      )}
                    </div>
                    <span className="ml-4 text-xs text-dark-subtle shrink-0">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-dark-border">
                      {log.session_notes && (
                        <p className="px-4 py-2 text-xs text-dark-muted border-b border-dark-border">
                          {log.session_notes}
                        </p>
                      )}

                      <div className="divide-y divide-dark-border">
                        {(log.exercise_logs ?? []).map(el => {
                          const pe = el.prescription_exercises
                          const exerciseName = pe?.exercises?.name ?? 'Exercise'
                          const hasPerSetData = Array.isArray(el.sets_data) && el.sets_data.length > 0

                          return (
                            <div key={el.id} className="px-3 py-2.5">
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
                          <p className="px-4 py-2.5 text-xs text-dark-subtle">No exercise data recorded.</p>
                        )}
                      </div>

                      {log.session_rpe != null && (
                        <p className="px-4 py-2 text-xs text-dark-muted border-t border-dark-border">
                          Session RPE: {log.session_rpe}/10
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
