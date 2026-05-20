import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import TherapistNav from '../../components/therapist/TherapistNav'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'

const TAB_LABELS = { prescriptions: 'Prescribed Sessions', history: 'Session History' }

function frequencyLabel(days) {
  if (!days) return 'No repeat'
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  return `Every ${days} days`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ExerciseLogDetail({ el, videoUrls, onPlayVideo, weightUnit }) {
  const pe = el.prescription_exercises
  const hasPerSetData = Array.isArray(el.sets_data) && el.sets_data.length > 0

  return (
    <div className="px-3 py-2.5">
      <p className="text-xs font-medium text-gray-800">
        {pe?.exercises?.name ?? 'Exercise'}
      </p>

      {pe && (
        <p className="mt-0.5 text-xs text-gray-400">
          Prescribed: {pe.sets} sets × {pe.reps} reps{pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
        </p>
      )}

      {hasPerSetData ? (
        <div className="mt-1 space-y-0.5">
          {el.sets_data.map((s, si) => (
            <p key={si} className="text-xs text-gray-500">
              Set {si + 1}: {s.reps} reps{s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-0.5 text-xs text-gray-500">
          {el.sets_completed ?? '—'} sets × {el.reps_completed ?? '—'} reps
          {el.weight_completed ? ` @ ${formatWeight(el.weight_completed, weightUnit)}` : ''}
        </p>
      )}

      {el.pain_rating != null && (
        <p className="mt-0.5 text-xs text-gray-500">Pain: {el.pain_rating}/10</p>
      )}

      {el.client_notes && (
        <p className="mt-1 text-xs text-gray-600">
          Comment: {el.client_notes}
        </p>
      )}

      {el.video_url && (
        <div className="mt-1.5">
          {videoUrls[el.id] ? (
            <video
              src={videoUrls[el.id]}
              controls
              className="w-full rounded"
              style={{ maxHeight: '240px' }}
            />
          ) : (
            <button
              onClick={() => onPlayVideo(el.id, el.video_url)}
              className="text-xs text-brand-primary hover:underline"
            >
              ▶ Play feedback video
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Prescribe() {
  const { clientId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const weightUnit = useWeightUnit()

  const [client, setClient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  const [activeTab, setActiveTab] = useState('prescriptions')

  const [expandedLogId, setExpandedLogId] = useState(null)
  const [videoUrls, setVideoUrls] = useState({})

  const [historyTabLogs, setHistoryTabLogs] = useState([])
  const [historyTabLoading, setHistoryTabLoading] = useState(false)
  const [historyTabLoaded, setHistoryTabLoaded] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [clientId, profile?.id])

  useEffect(() => {
    if (activeTab !== 'history') return
    if (historyTabLoaded) return
    if (!sessions || sessions.length === 0) return

    const prescriptionIds = sessions.map(s => s.id)

    setHistoryTabLoading(true)
    supabase
      .from('session_logs')
      .select(`
        id, completed_at, session_rpe, session_notes,
        prescriptions(name),
        exercise_logs(
          id, sets_completed, reps_completed, weight_completed,
          sets_data, pain_rating, client_notes, video_url,
          prescription_exercises(sets, reps, weight, exercises(name))
        )
      `)
      .in('prescription_id', prescriptionIds)
      .order('completed_at', { ascending: false })
      .then(({ data }) => {
        console.log('[history] raw fetch:', JSON.stringify(data, null, 2))
        setHistoryTabLogs(data ?? [])
        setHistoryTabLoading(false)
        setHistoryTabLoaded(true)
      })
  }, [activeTab, sessions, historyTabLoaded])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const [clientRes, sessionsRes] = await Promise.all([
      supabase.from('clients').select('id, name, email').eq('id', clientId).single(),
      supabase
        .from('prescriptions')
        .select('id, name, frequency_days, created_at, prescription_exercises(count)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true }),
    ])

    if (clientRes.error) { setError('Client not found.'); setLoading(false); return }
    setClient(clientRes.data)
    if (sessionsRes.error) setError('Failed to load sessions.')
    else setSessions(sessionsRes.data)
    setLoading(false)
  }

  async function createSession() {
    setCreating(true)
    const name = `Session ${sessions.length + 1}`
    const { data, error: insertError } = await supabase
      .from('prescriptions')
      .insert({ therapist_id: profile.id, client_id: clientId, name })
      .select('id')
      .single()

    if (insertError) {
      alert('Failed to create session.')
      setCreating(false)
      return
    }
    navigate(`/therapist/prescribe/${clientId}/sessions/${data.id}`)
  }

  async function deleteSession(id, name) {
    if (!window.confirm(`Delete "${name}"? This will also remove all completed session history for this prescription.`)) return
    const { error } = await supabase.from('prescriptions').delete().eq('id', id)
    if (error) { alert('Failed to delete session.'); return }
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  async function playVideo(exerciseLogId, path) {
    if (videoUrls[exerciseLogId]) return
    const { data } = await supabase.storage
      .from('feedback-videos')
      .createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      setVideoUrls(prev => ({ ...prev, [exerciseLogId]: data.signedUrl }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TherapistNav />
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TherapistNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/therapist/clients" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to clients
        </Link>

        <div className="mt-4 flex items-start justify-between max-w-2xl">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{client?.name}</h1>
            <p className="text-sm text-gray-500">{client?.email}</p>
          </div>
          {activeTab === 'prescriptions' && (
            <button
              onClick={createSession}
              disabled={creating}
              className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'New session'}
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="mt-5 max-w-2xl flex gap-6 border-b border-gray-200">
          {['prescriptions', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setExpandedLogId(null) }}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {/* ── Prescribed Sessions tab ───────────────────────────────────────── */}
        {activeTab === 'prescriptions' && (
          <div className="mt-6 max-w-2xl space-y-3">
            {!error && sessions.length === 0 && (
              <p className="text-sm text-gray-500">No sessions yet. Create the first one.</p>
            )}

            {sessions.map(s => (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteSession(s.id, s.name)}
                      className="rounded border border-red-200 px-3 py-1 text-sm text-red-500 hover:bg-red-50"
                    >
                      Delete
                    </button>
                    <Link
                      to={`/therapist/prescribe/${clientId}/sessions/${s.id}`}
                      className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Session History tab ───────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="mt-6 max-w-2xl space-y-3">
            {historyTabLoading && (
              <p className="text-sm text-gray-500">Loading history…</p>
            )}

            {historyTabLoaded && historyTabLogs.length === 0 && (
              <p className="text-sm text-gray-500">No sessions completed yet.</p>
            )}

            {historyTabLogs.map(log => (
              <div key={log.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.prescriptions?.name ?? 'Session'} · {formatDate(log.completed_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {log.session_rpe != null ? `RPE: ${log.session_rpe}/10` : 'No RPE recorded'}
                    </p>
                  </div>
                  <span className="ml-4 text-xs text-gray-400 shrink-0">
                    {expandedLogId === log.id ? '▲' : '▼'}
                  </span>
                </button>

                {expandedLogId === log.id && (
                  <div className="border-t border-gray-100">
                    {log.session_notes && (
                      <p className="px-4 py-2 text-xs text-gray-600 border-b border-gray-50">
                        {log.session_notes}
                      </p>
                    )}
                    <div className="divide-y divide-gray-50">
                      {(log.exercise_logs ?? []).map(el => (
                        <ExerciseLogDetail
                          key={el.id}
                          el={el}
                          videoUrls={videoUrls}
                          onPlayVideo={playVideo}
                          weightUnit={weightUnit}
                        />
                      ))}
                      {(log.exercise_logs ?? []).length === 0 && (
                        <p className="px-4 py-3 text-xs text-gray-400">No exercise detail recorded.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
