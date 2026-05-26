import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ApplyTemplateModal from '../../components/therapist/ApplyTemplateModal'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { useClinicName } from '../../hooks/useClinicName'
import { formatWeight } from '../../utils/weightUtils'
import { sanitise } from '../../utils/pdfUtils'
import { pdf } from '@react-pdf/renderer'
import { PrescriptionPDF } from '../../components/therapist/PrescriptionPDF'
import { ClientDataTab } from './ClientDataTab'

const TAB_LABELS = { prescriptions: 'Prescribed Sessions', history: 'Session History', clientData: 'Client Data' }

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

function formatExpiryDate(startDate, durationWeeks) {
  const d = new Date(startDate)
  d.setDate(d.getDate() + durationWeeks * 7 + 7)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function isActive(prescription) {
  const { start_date, duration_weeks } = prescription
  if (!start_date || !duration_weeks) return true
  const expiry = new Date(start_date)
  expiry.setDate(expiry.getDate() + duration_weeks * 7 + 7) // +7 grace period
  return expiry >= new Date()
}

function expectedSessions(p) {
  if (!p.duration_weeks || !p.frequency_days) return null
  return Math.round((p.duration_weeks * 7) / p.frequency_days)
}

function ExerciseLogDetail({ el, videoUrls, onPlayVideo, weightUnit }) {
  const pe = el.prescription_exercises
  const hasPerSetData = Array.isArray(el.sets_data) && el.sets_data.length > 0

  return (
    <div className="px-3 py-2.5">
      <p className="text-xs font-medium text-dark-text">
        {pe?.exercises?.name ?? 'Exercise'}
      </p>

      {pe && (
        <p className="mt-0.5 text-xs text-dark-muted">
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
        <p className="mt-1 text-xs text-dark-muted">
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
              className="text-xs text-dark-accent hover:underline cursor-pointer"
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
  const clinicName = useClinicName()

  const [client, setClient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [reactivating, setReactivating] = useState(null)
  const [defaultFrequencyDays, setDefaultFrequencyDays] = useState(null)

  const [activeTab, setActiveTab] = useState('prescriptions')
  const [showApplyModal, setShowApplyModal] = useState(false)

  const [expandedLogId, setExpandedLogId] = useState(null)
  const [videoUrls, setVideoUrls] = useState({})

  const [historyTabLogs, setHistoryTabLogs] = useState([])
  const [historyTabLoading, setHistoryTabLoading] = useState(false)
  const [historyTabLoaded, setHistoryTabLoaded] = useState(false)

  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [pdfError, setPdfError] = useState(null)

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

    const [clientRes, sessionsRes, therapistRes] = await Promise.all([
      supabase.from('clients').select('id, name, email').eq('id', clientId).single(),
      supabase
        .from('prescriptions')
        .select('id, name, frequency_days, start_date, duration_weeks, created_at, prescription_exercises(count), session_logs(count)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true }),
      supabase.from('therapist_profiles').select('default_frequency_days').eq('user_id', profile.id).maybeSingle(),
    ])

    if (clientRes.error) { setError('Client not found.'); setLoading(false); return }
    setClient(clientRes.data)
    if (sessionsRes.error) setError('Failed to load sessions.')
    else setSessions(sessionsRes.data)
    if (therapistRes.data?.default_frequency_days) setDefaultFrequencyDays(therapistRes.data.default_frequency_days)
    setLoading(false)
  }

  async function createSession() {
    setCreating(true)
    const name = `Session ${sessions.length + 1}`
    const { data, error: insertError } = await supabase
      .from('prescriptions')
      .insert({ therapist_id: profile.id, client_id: clientId, name, frequency_days: defaultFrequencyDays })
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

  async function reactivatePrescription(original) {
    setReactivating(original.id)

    const { data: newPrescription, error: prescError } = await supabase
      .from('prescriptions')
      .insert({
        therapist_id: profile.id,
        client_id: clientId,
        name: original.name,
        frequency_days: original.frequency_days,
        duration_weeks: original.duration_weeks,
        start_date: new Date().toISOString().split('T')[0],
        notes: original.notes ?? null,
      })
      .select('id')
      .single()

    if (prescError) { alert('Failed to reactivate session.'); setReactivating(null); return }

    const { data: origExercises, error: exError } = await supabase
      .from('prescription_exercises')
      .select('exercise_id, sets, reps, weight, therapist_notes')
      .eq('prescription_id', original.id)

    if (exError) { alert('Failed to copy exercises.'); setReactivating(null); return }

    if (origExercises.length > 0) {
      const copies = origExercises.map(e => ({
        prescription_id: newPrescription.id,
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        therapist_notes: e.therapist_notes,
      }))
      const { error: copyError } = await supabase.from('prescription_exercises').insert(copies)
      if (copyError) { alert('Failed to copy exercises.'); setReactivating(null); return }
    }

    navigate(`/therapist/prescribe/${clientId}/sessions/${newPrescription.id}`)
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

  async function downloadPDF(prescription) {
    setPdfLoadingId(prescription.id)
    setPdfError(null)
    try {
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('sets, reps, weight, therapist_notes, exercises(name)')
        .eq('prescription_id', prescription.id)
        .order('created_at', { ascending: true })
      if (peError) throw peError

      const exercises = peData.map(pe => ({
        name: pe.exercises?.name ?? 'Exercise',
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.weight,
        therapist_notes: pe.therapist_notes,
      }))

      const blob = await pdf(
        <PrescriptionPDF
          clientName={client?.name ?? 'Client'}
          prescriptionName={prescription.name}
          exercises={exercises}
          weightUnit={weightUnit}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitise(client?.name ?? 'client')}-${sanitise(prescription.name)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
      setPdfError(prescription.id)
    } finally {
      setPdfLoadingId(null)
    }
  }

  // Active first, then inactive; within each group sort by created_at ascending
  const sortedSessions = [...sessions].sort((a, b) => {
    const aActive = isActive(a), bActive = isActive(b)
    if (aActive !== bActive) return aActive ? -1 : 1
    return new Date(a.created_at) - new Date(b.created_at)
  })

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-dark-muted">Loading…</p>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/therapist/clients" className="text-sm text-dark-muted hover:text-dark-text">
          ← Back to clients
        </Link>

        <div className="mt-4 flex items-start justify-between max-w-2xl">
          <div>
            <h1 className="text-2xl font-semibold text-dark-text">{client?.name}</h1>
            <p className="text-sm text-dark-muted">{client?.email}</p>
          </div>
          {activeTab === 'prescriptions' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowApplyModal(true)}
                className="rounded border border-dark-accent px-4 py-2 text-sm text-dark-accent hover:bg-dark-accent-bg cursor-pointer transition-colors duration-150"
              >
                Apply Template
              </button>
              <button
                onClick={createSession}
                disabled={creating}
                className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Creating…' : 'New session'}
              </button>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="mt-5 max-w-2xl flex gap-6 border-b border-dark-border">
          {['prescriptions', 'history', 'clientData'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setExpandedLogId(null) }}
              className={`pb-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-dark-subtle hover:text-dark-muted'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {/* ── Prescribed Sessions tab ───────────────────────────────────────── */}
        {activeTab === 'prescriptions' && (
          <div className="mt-6 max-w-2xl space-y-3">
            {!error && sessions.length === 0 && (
              <p className="text-sm text-dark-muted">No sessions yet. Create the first one.</p>
            )}

            {sortedSessions.map(s => {
              const active = isActive(s)
              const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
              const expected = expectedSessions(s)

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border overflow-hidden ${
                    active ? 'border-dark-border bg-dark-surface' : 'border-dark-border bg-dark-elevated opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-dark-text">{s.name}</p>
                        {!active && (
                          <span className="inline-flex items-center rounded-full bg-dark-elevated px-2 py-0.5 text-xs font-medium text-dark-muted">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-dark-muted">
                        {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                      </p>
                      {active && s.duration_weeks && s.start_date && (
                        <p className="mt-0.5 text-xs text-dark-subtle">
                          Active until {formatExpiryDate(s.start_date, s.duration_weeks)}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-dark-subtle">
                        {expected != null
                          ? `${completedCount} / ${expected} sessions completed`
                          : `${completedCount} session${completedCount !== 1 ? 's' : ''} completed`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!active && (
                        <button
                          onClick={() => reactivatePrescription(s)}
                          disabled={reactivating === s.id}
                          className="rounded border border-dark-accent px-3 py-1 text-sm text-dark-accent hover:bg-dark-accent-bg disabled:opacity-50 cursor-pointer transition-colors duration-150"
                        >
                          {reactivating === s.id ? 'Copying…' : 'Reactivate'}
                        </button>
                      )}
                      <div className="flex flex-col items-end gap-0.5">
                        <button
                          onClick={() => downloadPDF(s)}
                          disabled={pdfLoadingId === s.id}
                          className="rounded border border-dark-border px-3 py-1 text-sm text-dark-muted hover:bg-dark-elevated hover:text-dark-text disabled:opacity-50 cursor-pointer transition-colors duration-150"
                        >
                          {pdfLoadingId === s.id ? 'Generating…' : 'Download PDF'}
                        </button>
                        {pdfError === s.id && (
                          <span className="text-xs text-red-400">PDF failed — try again</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSession(s.id, s.name)}
                        className="rounded border border-red-800/40 px-3 py-1 text-sm text-red-400 hover:bg-red-900/20 cursor-pointer transition-colors duration-150"
                      >
                        Delete
                      </button>
                      <Link
                        to={`/therapist/prescribe/${clientId}/sessions/${s.id}`}
                        className="rounded border border-dark-accent px-3 py-1 text-sm text-dark-accent hover:bg-dark-accent-bg transition-colors duration-150"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Session History tab ───────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="mt-6 max-w-2xl space-y-3">
            {historyTabLoading && (
              <p className="text-sm text-dark-muted">Loading history…</p>
            )}

            {historyTabLoaded && historyTabLogs.length === 0 && (
              <p className="text-sm text-dark-muted">No sessions completed yet.</p>
            )}

            {historyTabLogs.map(log => (
              <div key={log.id} className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated transition-colors cursor-pointer"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-dark-text">
                      {log.prescriptions?.name ?? 'Session'} · {formatDate(log.completed_at)}
                    </p>
                    <p className="mt-0.5 text-xs text-dark-muted">
                      {log.session_rpe != null ? `RPE: ${log.session_rpe}/10` : 'No RPE recorded'}
                    </p>
                  </div>
                  <span className="ml-4 text-xs text-dark-subtle shrink-0">
                    {expandedLogId === log.id ? '▲' : '▼'}
                  </span>
                </button>

                {expandedLogId === log.id && (
                  <div className="border-t border-dark-border">
                    {log.session_notes && (
                      <p className="px-4 py-2 text-xs text-dark-muted border-b border-dark-border">
                        {log.session_notes}
                      </p>
                    )}
                    <div className="divide-y divide-dark-border">
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
                        <p className="px-4 py-3 text-xs text-dark-subtle">No exercise detail recorded.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Client Data tab ───────────────────────────────────────────────── */}
        {activeTab === 'clientData' && (
          <ClientDataTab prescriptions={sessions} />
        )}
      </div>

      {showApplyModal && (
        <ApplyTemplateModal
          therapistId={profile.id}
          clientId={clientId}
          defaultFrequencyDays={defaultFrequencyDays}
          onClose={() => setShowApplyModal(false)}
          onApplied={() => {
            setShowApplyModal(false)
            fetchData()
          }}
        />
      )}
    </SidebarLayout>
  )
}
