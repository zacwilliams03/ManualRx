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
import { AllSessionsPDF } from '../../components/therapist/AllSessionsPDF'
import { ClientDataTab } from './ClientDataTab'
import { motion, AnimatePresence } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'

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
  const [allPdfLoading, setAllPdfLoading] = useState(false)
  const [allPdfError, setAllPdfError] = useState(false)

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
          clinicName={clinicName}
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

  async function downloadAllPDF() {
    const activeSessions = sortedSessions.filter(isActive)
    if (activeSessions.length === 0) return

    setAllPdfLoading(true)
    setAllPdfError(false)
    try {
      const activeIds = activeSessions.map(s => s.id)
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, exercises(name)')
        .in('prescription_id', activeIds)
        .order('created_at', { ascending: true })
      if (peError) throw peError

      const byId = {}
      for (const row of peData) {
        if (!byId[row.prescription_id]) byId[row.prescription_id] = []
        byId[row.prescription_id].push({
          name: row.exercises?.name ?? 'Exercise',
          sets: row.sets,
          reps: row.reps,
          weight: row.weight,
          therapist_notes: row.therapist_notes,
        })
      }

      const prescriptions = activeSessions.map(s => ({
        name: s.name,
        frequencyLabel: frequencyLabel(s.frequency_days),
        exercises: byId[s.id] ?? [],
      }))

      const blob = await pdf(
        <AllSessionsPDF
          clinicName={clinicName}
          clientName={client?.name ?? 'Client'}
          prescriptions={prescriptions}
          weightUnit={weightUnit}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitise(client?.name ?? 'client')}-all-sessions.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
      setAllPdfError(true)
    } finally {
      setAllPdfLoading(false)
    }
  }

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
      {/* Hero zone */}
      <PageHero
        title={client?.name ?? '…'}
        subtitle={client?.email ?? null}
        back={{ label: 'Clients', to: '/therapist/clients' }}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {sortedSessions.some(isActive) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <button
                  onClick={downloadAllPDF}
                  disabled={allPdfLoading}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: allPdfLoading ? 'default' : 'pointer', opacity: allPdfLoading ? 0.6 : 1 }}
                >
                  {allPdfLoading ? 'Exporting…' : 'Export PDF'}
                </button>
                {allPdfError && (
                  <span style={{ fontSize: '11px', color: '#f87171' }}>Export failed</span>
                )}
              </div>
            )}
            {activeTab === 'prescriptions' && (
              <>
                <button
                  onClick={() => setShowApplyModal(true)}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Apply Template
                </button>
                <button
                  onClick={createSession}
                  disabled={creating}
                  style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}
                >
                  {creating ? 'Creating…' : 'New session'}
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs — flush below hero border */}
      <div style={{ display: 'flex', padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['prescriptions', 'history', 'clientData']).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setExpandedLogId(null) }}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#29B5CC' : '#555',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #29B5CC' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {error && <p style={{ padding: '16px 32px', fontSize: '13px', color: '#f87171' }}>{error}</p>}

      {/* Tab content */}
      <div style={{ padding: '24px 32px' }}>
        <AnimatePresence mode="wait">

          {/* ── Prescribed Sessions ── */}
          {activeTab === 'prescriptions' && (
            <motion.div
              key="prescriptions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {sessions.length === 0 && (
                <p style={{ fontSize: '13px', color: '#666' }}>No sessions yet. Create the first one.</p>
              )}
              {sortedSessions.map((s, i) => {
                const active = isActive(s)
                const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
                const expected = expectedSessions(s)

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                    style={{
                      ...CARD,
                      padding: 0,
                      marginBottom: '14px',
                      opacity: active ? 1 : 0.55,
                    }}
                  >
                    <div style={SHIMMER} />
                    {/* Prescription header */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: '#e8edf5' }}>{s.name}</span>
                          {!active && (
                            <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(255,255,255,0.06)', color: '#888', borderRadius: '4px' }}>Inactive</span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                          {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                        </p>
                        {active && s.duration_weeks && s.start_date && (
                          <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                            Active until {formatExpiryDate(s.start_date, s.duration_weeks)}
                          </p>
                        )}
                        <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                          {expected != null
                            ? `${completedCount} / ${expected} sessions completed`
                            : `${completedCount} session${completedCount !== 1 ? 's' : ''} completed`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!active && (
                            <button
                              onClick={() => reactivatePrescription(s)}
                              disabled={reactivating === s.id}
                              style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', background: 'transparent', cursor: 'pointer', opacity: reactivating === s.id ? 0.6 : 1 }}
                            >
                              {reactivating === s.id ? 'Copying…' : 'Reactivate'}
                            </button>
                          )}
                          <button
                            onClick={() => downloadPDF(s)}
                            disabled={pdfLoadingId === s.id}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#666', background: 'transparent', cursor: 'pointer', opacity: pdfLoadingId === s.id ? 0.6 : 1 }}
                          >
                            {pdfLoadingId === s.id ? 'Generating…' : 'PDF'}
                          </button>
                          <Link
                            to={`/therapist/prescribe/${clientId}/sessions/${s.id}`}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#888', textDecoration: 'none' }}
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => deleteSession(s.id, s.name)}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', background: 'transparent', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                        {pdfError === s.id && (
                          <span style={{ fontSize: '11px', color: '#f87171' }}>PDF failed</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* ── Session History ── */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {historyTabLoading && <p style={{ fontSize: '13px', color: '#666' }}>Loading history…</p>}
              {!historyTabLoading && historyTabLogs.length === 0 && (
                <p style={{ fontSize: '13px', color: '#666' }}>No completed sessions yet.</p>
              )}
              {historyTabLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                  style={{ ...CARD, padding: 0, marginBottom: '12px' }}
                >
                  <div style={SHIMMER} />
                  <button
                    onClick={() => setExpandedLogId(prev => prev === log.id ? null : log.id)}
                    style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>
                        {log.prescriptions?.name ?? 'Session'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#555', marginTop: '3px' }}>
                        {new Date(log.completed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {log.session_rpe != null ? ` · RPE ${log.session_rpe}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#555' }}>{expandedLogId === log.id ? '▲' : '▼'}</span>
                  </button>
                  {expandedLogId === log.id && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {(log.exercise_logs ?? []).map(el => (
                        <div key={el.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <ExerciseLogDetail
                            el={el}
                            videoUrls={videoUrls}
                            onPlayVideo={playVideo}
                            weightUnit={weightUnit}
                          />
                        </div>
                      ))}
                      {log.session_notes && (
                        <div style={{ padding: '10px 20px', fontSize: '12px', color: '#666' }}>
                          Note: {log.session_notes}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── Client Data ── */}
          {activeTab === 'clientData' && (
            <motion.div key="clientData" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ClientDataTab prescriptions={sessions} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Apply Template modal — keep original conditional rendering and props */}
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
