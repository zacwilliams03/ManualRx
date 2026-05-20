import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function History() {
  const { profile } = useAuth()

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedLogId, setExpandedLogId] = useState(null)

  useEffect(() => { if (profile?.id) fetchData() }, [profile?.id])

  async function fetchData() {
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

  return (
    <div className="min-h-[100dvh] bg-gray-50 p-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between mb-6 max-w-lg">
        <h1 className="text-2xl font-semibold text-gray-900">Session History</h1>
        <Link to="/client" className="text-sm text-gray-500 hover:text-gray-700">
          ← My Sessions
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && logs.length === 0 && (
        <p className="text-sm text-gray-500">No sessions completed yet.</p>
      )}

      <div className="space-y-3 max-w-lg">
        {logs.map(log => {
          const isOpen = expandedLogId === log.id

          return (
            <div key={log.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedLogId(isOpen ? null : log.id)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {log.prescriptions?.name ?? 'Session'} · {formatDate(log.completed_at)}
                  </p>
                  {log.session_rpe != null && (
                    <p className="mt-0.5 text-xs text-gray-500">RPE: {log.session_rpe}/10</p>
                  )}
                </div>
                <span className="ml-4 text-xs text-gray-400 shrink-0">
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {log.session_notes && (
                    <p className="px-4 py-2 text-xs text-gray-600 border-b border-gray-50">
                      {log.session_notes}
                    </p>
                  )}

                  <div className="divide-y divide-gray-50">
                    {(log.exercise_logs ?? []).map(el => {
                      const pe = el.prescription_exercises
                      const exerciseName = pe?.exercises?.name ?? 'Exercise'
                      const hasPerSetData = Array.isArray(el.sets_data) && el.sets_data.length > 0

                      return (
                        <div key={el.id} className="px-3 py-2.5">
                          <p className="text-xs font-medium text-gray-800">{exerciseName}</p>

                          {pe && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              Prescribed: {pe.sets} sets × {pe.reps} reps{pe.weight ? ` @ ${pe.weight}kg` : ''}
                            </p>
                          )}

                          {hasPerSetData ? (
                            <div className="mt-1 space-y-0.5">
                              {el.sets_data.map((s, si) => (
                                <p key={si} className="text-xs text-gray-500">
                                  Set {si + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight}kg` : ''}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {el.sets_completed ?? '—'} sets × {el.reps_completed ?? '—'} reps
                              {el.weight_completed ? ` @ ${el.weight_completed}kg` : ''}
                            </p>
                          )}

                          {el.pain_rating != null && (
                            <p className="mt-0.5 text-xs text-gray-500">Pain: {el.pain_rating}/10</p>
                          )}

                          {el.client_notes && (
                            <p className="mt-1 text-xs text-gray-600">Note: {el.client_notes}</p>
                          )}
                        </div>
                      )
                    })}

                    {(log.exercise_logs ?? []).length === 0 && (
                      <p className="px-4 py-2.5 text-xs text-gray-400">No exercise data recorded.</p>
                    )}
                  </div>

                  {log.session_rpe != null && (
                    <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-50">
                      Session RPE: {log.session_rpe}/10
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
