import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ApplyTemplateModal from '../../components/therapist/ApplyTemplateModal'
import ApplyProgramTemplateModal from '../../components/therapist/ApplyProgramTemplateModal'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { useClinicName } from '../../hooks/useClinicName'
import { formatWeight } from '../../utils/weightUtils'
import { sanitise } from '../../utils/pdfUtils'
import { pdf } from '@react-pdf/renderer'
import { PrescriptionPDF } from '../../components/therapist/PrescriptionPDF'
import { AllSessionsPDF } from '../../components/therapist/AllSessionsPDF'
import { ProgramPDF } from '../../components/therapist/ProgramPDF'
import { ClientDataTab } from './ClientDataTab'
import { motion, AnimatePresence } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SECTION_LABEL } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { frequencyLabel } from '../../utils/frequencyUtils'
import { formatPeriodDate } from '../../utils/checkInUtils'
import useIsMobile from '../../hooks/useIsMobile'

const TAB_LABELS = { prescriptions: 'Prescribed Sessions', history: 'Session History', clientData: 'Client Data' }

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
          Prescribed: {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
          {pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
          {pe.bilateral ? ' — Both sides' : ''}
        </p>
      )}

      {hasPerSetData ? (
        <div className="mt-1 space-y-0.5">
          {el.sets_data.map((s, si) => (
            <p key={si} className="text-xs text-dark-muted">
              Set {si + 1}: {s.reps} {pe?.measurement_type === 'seconds' ? 'sec' : 'reps'}
              {s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
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
  const isMobile = useIsMobile()

  const [client, setClient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [reactivating, setReactivating] = useState(null)
  const [defaultFrequencyDays, setDefaultFrequencyDays] = useState(null)

  const [programs, setPrograms] = useState([])
  const [expandedPrograms, setExpandedPrograms] = useState(new Set())
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  const [showProgramDropdown, setShowProgramDropdown] = useState(false)
  const [showApplyProgramModal, setShowApplyProgramModal] = useState(false)
  const [creatingProgram, setCreatingProgram] = useState(false)
  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false)
  const [newProgramName, setNewProgramName] = useState('')
  const [newProgramWeeks, setNewProgramWeeks] = useState(4)

  const [activeTab, setActiveTab] = useState('prescriptions')
  const [showApplyModal, setShowApplyModal] = useState(false)

  const [expandedLogId, setExpandedLogId] = useState(null)
  const [videoUrls, setVideoUrls] = useState({})

  const [historyTabLogs, setHistoryTabLogs] = useState([])
  const [historyTabLoading, setHistoryTabLoading] = useState(false)
  const [historyTabLoaded, setHistoryTabLoaded] = useState(false)
  const [mergedTimeline, setMergedTimeline] = useState([])
  const [expandedCheckInId, setExpandedCheckInId] = useState(null)

  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [programPdfLoadingId, setProgramPdfLoadingId] = useState(null)
  const [allPdfLoading, setAllPdfLoading] = useState(false)
  const [allPdfError, setAllPdfError] = useState(false)

  const [showPdfMenu, setShowPdfMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const pdfBtnRef = useRef(null)
  const sessionDropdownBtnRef = useRef(null)
  const programDropdownBtnRef = useRef(null)
  const [sessionDropdownPos, setSessionDropdownPos] = useState({ top: 0, right: 0 })
  const [programDropdownPos, setProgramDropdownPos] = useState({ top: 0, right: 0 })
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [clientId, profile?.id])

  useEffect(() => {
    if (activeTab !== 'history') return
    if (historyTabLoaded) return
    if (loading) return  // wait for fetchData to complete so sessions is fully populated

    const prescriptionIds = (sessions ?? []).map(s => s.id)

    setHistoryTabLoading(true)
    Promise.all([
      prescriptionIds.length > 0
        ? supabase
            .from('session_logs')
            .select(`
              id, completed_at, session_rpe, session_notes,
              prescriptions(name),
              exercise_logs(
                id, sets_completed, reps_completed, weight_completed,
                sets_data, pain_rating, client_notes, video_url,
                prescription_exercises(sets, reps, weight, measurement_type, bilateral, exercises(name))
              )
            `)
            .in('prescription_id', prescriptionIds)
            .order('completed_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      // check_in_responses fetched separately — embedded reverse-FK queries
      // return empty for new tables until PostgREST schema cache refreshes.
      supabase
        .from('check_in_instances')
        .select(`
          id, period_start_date,
          check_in_forms(name, check_in_questions(id, question_text, question_type, order_index))
        `)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('period_start_date', { ascending: false }),
    ]).then(async ([sessionRes, checkInRes]) => {
      const sessionEntries = (sessionRes.data ?? []).map(log => ({
        type: 'session',
        date: new Date(log.completed_at),
        data: log,
      }))

      // Fetch responses for completed check-in instances
      const checkInInstances = checkInRes.data ?? []
      let checkInEntries = []
      if (checkInInstances.length > 0) {
        const { data: responseData } = await supabase
          .from('check_in_responses')
          .select('id, instance_id, answers, submitted_at')
          .in('instance_id', checkInInstances.map(i => i.id))
        const responseMap = Object.fromEntries((responseData ?? []).map(r => [r.instance_id, r]))
        checkInEntries = checkInInstances
          .filter(i => responseMap[i.id])
          .map(i => {
            const r = responseMap[i.id]
            return {
              type: 'checkin',
              date: new Date(r.submitted_at),
              data: {
                responseId: r.id,
                formName: i.check_in_forms?.name ?? 'Check-In',
                periodStartDate: i.period_start_date,
                answers: r.answers ?? {},
                questions: (i.check_in_forms?.check_in_questions ?? []).sort((a, b) => a.order_index - b.order_index),
                submittedAt: r.submitted_at,
              },
            }
          })
      }

      const merged = [...sessionEntries, ...checkInEntries].sort((a, b) => b.date - a.date)
      setHistoryTabLogs(sessionRes.data ?? [])
      setMergedTimeline(merged)
      setHistoryTabLoading(false)
      setHistoryTabLoaded(true)
    })
  }, [activeTab, sessions, historyTabLoaded, loading])

  useEffect(() => {
    if (!showPdfMenu) return
    const handler = (e) => {
      if (!e.target.closest('[data-pdf-menu]')) setShowPdfMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPdfMenu])

  useEffect(() => {
    if (!showSessionDropdown && !showProgramDropdown) return
    const handler = (e) => {
      if (!e.target.closest('[data-session-dropdown]')) setShowSessionDropdown(false)
      if (!e.target.closest('[data-program-dropdown]')) setShowProgramDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSessionDropdown, showProgramDropdown])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const [clientRes, sessionsRes, therapistRes, programsRes] = await Promise.all([
      supabase.from('clients').select('id, name, email').eq('id', clientId).single(),
      supabase
        .from('prescriptions')
        .select('id, name, frequency_days, start_date, duration_weeks, created_at, program_id, week_number, prescription_exercises(count), session_logs(count)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true }),
      supabase.from('therapist_profiles').select('default_frequency_days').eq('user_id', profile.id).maybeSingle(),
      supabase
        .from('programs')
        .select('id, name, duration_weeks, start_date, created_at')
        .eq('therapist_id', profile.id)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ])

    if (clientRes.error) { setError('Client not found.'); setLoading(false); return }
    setClient(clientRes.data)
    if (sessionsRes.error) setError('Failed to load sessions.')
    else setSessions(sessionsRes.data)
    if (therapistRes.data?.default_frequency_days) setDefaultFrequencyDays(therapistRes.data.default_frequency_days)
    if (programsRes.error) setError('Failed to load programs.')
    else setPrograms(programsRes.data ?? [])
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

  async function createProgram(name, durationWeeks) {
    setCreatingProgram(true)
    const { data, error: insertError } = await supabase
      .from('programs')
      .insert({ therapist_id: profile.id, client_id: clientId, name, duration_weeks: durationWeeks })
      .select('id')
      .single()
    setCreatingProgram(false)
    if (insertError) { alert('Failed to create program.'); return }
    navigate(`/therapist/prescribe/${clientId}/programs/${data.id}`)
  }

  async function deleteSession(id, name) {
    if (!window.confirm(`Delete "${name}"? This will also remove all completed session history for this prescription.`)) return
    const { error } = await supabase.from('prescriptions').delete().eq('id', id)
    if (error) { alert('Failed to delete session.'); return }
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  async function deleteProgram(id, name) {
    if (!window.confirm(`Delete program "${name}"? This will also delete all sessions and their completed history.`)) return
    const { error: sessError } = await supabase.from('prescriptions').delete().eq('program_id', id)
    if (sessError) { alert('Failed to delete program sessions.'); return }
    const { error: progError } = await supabase.from('programs').delete().eq('id', id)
    if (progError) { alert('Failed to delete program.'); return }
    setPrograms(prev => prev.filter(p => p.id !== id))
    setSessions(prev => prev.filter(s => s.program_id !== id))
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
      .select('exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight)')
      .eq('prescription_id', original.id)

    if (exError) { alert('Failed to copy exercises.'); setReactivating(null); return }

    for (const e of origExercises) {
      const { data: newEx, error: exErr } = await supabase
        .from('prescription_exercises')
        .insert({
          prescription_id: newPrescription.id,
          exercise_id: e.exercise_id,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          therapist_notes: e.therapist_notes,
          measurement_type: e.measurement_type ?? 'reps',
          bilateral: e.bilateral ?? false,
          tempo_eccentric:    e.tempo_eccentric    ?? null,
          tempo_bottom_pause: e.tempo_bottom_pause ?? null,
          tempo_concentric:   e.tempo_concentric   ?? null,
          tempo_top_pause:    e.tempo_top_pause    ?? null,
        })
        .select('id')
        .single()
      if (exErr) { alert('Failed to copy exercises.'); setReactivating(null); return }
      const sets = e.prescription_exercise_sets ?? []
      if (sets.length > 0) {
        await supabase.from('prescription_exercise_sets').insert(
          sets.map(s => ({
            prescription_exercise_id: newEx.id,
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight ?? null,
          }))
        )
      }
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
        .select('sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
        .eq('prescription_id', prescription.id)
        .order('created_at', { ascending: true })
      if (peError) throw peError

      const exercises = peData.map(pe => ({
        name: pe.exercises?.name ?? 'Exercise',
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.weight,
        therapist_notes: pe.therapist_notes,
        measurement_type: pe.measurement_type ?? 'reps',
        bilateral: pe.bilateral ?? false,
        tempo_eccentric:    pe.tempo_eccentric    ?? null,
        tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
        tempo_concentric:   pe.tempo_concentric   ?? null,
        tempo_top_pause:    pe.tempo_top_pause    ?? null,
        prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
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

  async function downloadProgramPDF(program, programSessions) {
    setProgramPdfLoadingId(program.id)
    try {
      const prescriptionIds = programSessions.map(s => s.id)
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
        .in('prescription_id', prescriptionIds)
        .order('created_at', { ascending: true })
      if (peError) throw peError

      const exercisesByPrescription = {}
      for (const pe of peData ?? []) {
        if (!exercisesByPrescription[pe.prescription_id]) exercisesByPrescription[pe.prescription_id] = []
        exercisesByPrescription[pe.prescription_id].push({
          name: pe.exercises?.name ?? 'Exercise',
          sets: pe.sets,
          reps: pe.reps,
          weight: pe.weight,
          therapist_notes: pe.therapist_notes,
          measurement_type: pe.measurement_type ?? 'reps',
          bilateral: pe.bilateral ?? false,
          tempo_eccentric:    pe.tempo_eccentric    ?? null,
          tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
          tempo_concentric:   pe.tempo_concentric   ?? null,
          tempo_top_pause:    pe.tempo_top_pause    ?? null,
          prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
        })
      }

      const sortedSessions = [...programSessions].sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0))
      const weekMap = {}
      for (const s of sortedSessions) {
        const wk = s.week_number ?? 1
        if (!weekMap[wk]) weekMap[wk] = []
        weekMap[wk].push({
          name: s.name,
          frequencyDays: s.frequency_days ?? null,
          exercises: exercisesByPrescription[s.id] ?? [],
        })
      }
      const weeks = Object.keys(weekMap).sort((a, b) => Number(a) - Number(b)).map(wk => ({
        weekNumber: Number(wk),
        sessions: weekMap[wk],
      }))

      const blob = await pdf(
        <ProgramPDF
          clinicName={clinicName}
          clientName={client?.name ?? 'Client'}
          programName={program.name}
          startDate={program.start_date ?? null}
          weeks={weeks}
          weightUnit={weightUnit}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitise(client?.name ?? 'client')}-${sanitise(program.name)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Program PDF generation failed:', err)
    } finally {
      setProgramPdfLoadingId(null)
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
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
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
          measurement_type: row.measurement_type ?? 'reps',
          bilateral: row.bilateral ?? false,
          tempo_eccentric:    row.tempo_eccentric    ?? null,
          tempo_bottom_pause: row.tempo_bottom_pause ?? null,
          tempo_concentric:   row.tempo_concentric   ?? null,
          tempo_top_pause:    row.tempo_top_pause    ?? null,
          prescription_exercise_sets: row.prescription_exercise_sets ?? [],
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

  async function emailPDF() {
    const activeSessions = sortedSessions.filter(isActive)
    if (activeSessions.length === 0) return

    setEmailLoading(true)
    setEmailError(false)
    try {
      const activeIds = activeSessions.map(s => s.id)
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
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
          measurement_type: row.measurement_type ?? 'reps',
          bilateral: row.bilateral ?? false,
          tempo_eccentric:    row.tempo_eccentric    ?? null,
          tempo_bottom_pause: row.tempo_bottom_pause ?? null,
          tempo_concentric:   row.tempo_concentric   ?? null,
          tempo_top_pause:    row.tempo_top_pause    ?? null,
          prescription_exercise_sets: row.prescription_exercise_sets ?? [],
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

      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i])
      const pdfBase64 = btoa(binary)

      const { error } = await supabase.functions.invoke('send-prescription-email', {
        body: {
          to: client.email,
          clientName: client.name,
          therapistFirstName: profile.name?.split(' ')[0] ?? profile.name,
          clinicName: clinicName ?? '',
          attachmentFilename: `${sanitise(client?.name ?? 'client')}-prescription.pdf`,
          pdfBase64,
        },
      })
      if (error) throw error

      setShowEmailConfirm(false)
      setEmailSuccess(true)
      setTimeout(() => setEmailSuccess(false), 4000)
    } catch (err) {
      console.error('Email PDF failed:', err)
      setEmailError(true)
    } finally {
      setEmailLoading(false)
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
              <div data-pdf-menu style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <button
                  ref={pdfBtnRef}
                  onClick={() => {
                    const rect = pdfBtnRef.current.getBoundingClientRect()
                    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
                    setShowPdfMenu(m => !m)
                  }}
                  disabled={allPdfLoading}
                  style={{ padding: '8px 14px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: allPdfLoading ? 'default' : 'pointer', opacity: allPdfLoading ? 0.6 : 1 }}
                >
                  {allPdfLoading ? 'Exporting…' : 'Create PDF ▾'}
                </button>
                {allPdfError && (
                  <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>Export failed</span>
                )}
              </div>
            )}
            <Link
              to={`/therapist/messages/${clientId}`}
              style={{ padding: '8px 14px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', textDecoration: 'none' }}
            >
              Message
            </Link>
            {activeTab === 'prescriptions' && (
              <>
                {/* New Session button — dropdown rendered at fixed position below PageHero */}
                <div data-session-dropdown>
                  <button
                    ref={sessionDropdownBtnRef}
                    onClick={() => {
                      const rect = sessionDropdownBtnRef.current.getBoundingClientRect()
                      setSessionDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
                      setShowSessionDropdown(d => !d)
                      setShowProgramDropdown(false)
                    }}
                    style={{ padding: '9px 18px', background: 'transparent', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.45)', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    New Session ▾
                  </button>
                </div>

                {/* New Program button — dropdown rendered at fixed position below PageHero */}
                <div data-program-dropdown>
                  <button
                    ref={programDropdownBtnRef}
                    onClick={() => {
                      const rect = programDropdownBtnRef.current.getBoundingClientRect()
                      setProgramDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
                      setShowProgramDropdown(d => !d)
                      setShowSessionDropdown(false)
                    }}
                    style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    New Program ▾
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      {/* Tabs — flush below hero border */}
      <div style={{ display: 'flex', padding: isMobile ? '0' : '0 32px', borderBottom: '1px solid var(--color-border)', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        {(['prescriptions', 'history', 'clientData']).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setExpandedLogId(null) }}
            style={{
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#29B5CC' : 'var(--color-subtle)',
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

      {error && <p style={{ padding: '16px 32px', fontSize: '13px', color: 'var(--color-danger)' }}>{error}</p>}

      {/* Tab content */}
      <div style={{ padding: isMobile ? '16px' : '24px 32px' }}>
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
              {/* Build merged list: programs + standalones interleaved by created_at */}
              {(() => {
                const programMap = new Map(programs.map(p => [p.id, { program: p, sessions: [] }]))
                const standalones = []
                for (const s of sessions) {
                  if (s.program_id && programMap.has(s.program_id)) {
                    programMap.get(s.program_id).sessions.push(s)
                  } else {
                    // program_id present but program not fetched, or no program_id — treat as standalone
                    standalones.push(s)
                  }
                }

                // Apply active-first sort to standalones (matches existing Prescribe behaviour)
                const sortedStandalones = [...standalones].sort((a, b) => {
                  const aActive = isActive(a), bActive = isActive(b)
                  if (aActive !== bActive) return aActive ? -1 : 1
                  return new Date(b.created_at) - new Date(a.created_at)
                })

                const items = [
                  ...programs.map(p => ({ type: 'program', ...programMap.get(p.id), sortKey: new Date(p.created_at) })),
                  ...sortedStandalones.map(s => ({ type: 'session', session: s, sortKey: new Date(s.created_at) })),
                ].sort((a, b) => b.sortKey - a.sortKey)

                if (items.length === 0) {
                  return <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No sessions or programs yet. Create the first one.</p>
                }

                return items.map((item, i) => {
                  if (item.type === 'program') {
                    const p = item.program
                    const today = new Date()
                    const started = p.start_date && new Date(p.start_date) <= today
                    const currentWeek = p.start_date
                      ? Math.min(p.duration_weeks, Math.max(1, Math.floor((today - new Date(p.start_date)) / (7 * 86400000)) + 1))
                      : null
                    const progressLabel = p.start_date
                      ? (started ? `Week ${currentWeek} of ${p.duration_weeks}` : `Starts ${new Date(p.start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`)
                      : `${p.duration_weeks} weeks · Not started`

                    return (
                      <motion.div
                        key={`prog-${p.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                        style={{ ...CARD, padding: 0, marginBottom: '14px', borderLeft: '3px solid rgba(41,181,204,0.4)' }}
                      >
                        <ShimmerLine />
                        <button
                          type="button"
                          onClick={() => setExpandedPrograms(prev => {
                            const next = new Set(prev)
                            next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                            return next
                          })}
                          style={{ width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{expandedPrograms.has(p.id) ? '▼' : '▶'}</span>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#29B5CC' }}>{p.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{item.sessions.length} session{item.sessions.length !== 1 ? 's' : ''}</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '3px', paddingLeft: '18px' }}>{progressLabel}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => downloadProgramPDF(p, item.sessions)}
                              disabled={programPdfLoadingId === p.id}
                              style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', background: 'transparent', cursor: 'pointer', opacity: programPdfLoadingId === p.id ? 0.6 : 1 }}
                            >
                              {programPdfLoadingId === p.id ? 'Generating…' : 'PDF'}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/therapist/prescribe/${clientId}/programs/${p.id}`)}
                              style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', background: 'transparent', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProgram(p.id, p.name)}
                              style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: 'var(--color-danger)', background: 'transparent', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          </div>
                        </button>
                        {expandedPrograms.has(p.id) && [...item.sessions].sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0)).map(s => {
                          const active = isActive(s)
                          const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
                          return (
                            <div
                              key={s.id}
                              style={{ padding: '10px 20px 10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-elevated)', opacity: active ? 1 : 0.55 }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {s.week_number && <span style={{ fontSize: '10px', color: 'var(--color-subtle)', background: 'var(--color-elevated)', padding: '1px 5px', borderRadius: '3px' }}>Wk {s.week_number}</span>}
                                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{s.name}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                                  {s.prescription_exercises[0]?.count ?? 0} ex · {frequencyLabel(s.frequency_days)} · {completedCount} done
                                </p>
                              </div>
                              <Link
                                to={`/therapist/prescribe/${clientId}/sessions/${s.id}?programId=${p.id}&weekNumber=${s.week_number}`}
                                style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-muted)', textDecoration: 'none' }}
                              >
                                Edit
                              </Link>
                            </div>
                          )
                        })}
                      </motion.div>
                    )
                  }

                  // Standalone session
                  const s = item.session
                  const active = isActive(s)
                  const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
                  const expected = expectedSessions(s)
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                      style={{ ...CARD, padding: 0, marginBottom: '14px', opacity: active ? 1 : 0.55 }}
                    >
                      <ShimmerLine />
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--color-elevated)' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</span>
                            {!active && <span style={{ fontSize: '11px', padding: '2px 7px', background: 'var(--color-border)', color: 'var(--color-muted)', borderRadius: '4px' }}>Inactive</span>}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '4px' }}>
                            {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                          </p>
                          {active && s.duration_weeks && s.start_date && (
                            <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>Active until {formatExpiryDate(s.start_date, s.duration_weeks)}</p>
                          )}
                          <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                            {expected != null ? `${completedCount} / ${expected} sessions completed` : `${completedCount} session${completedCount !== 1 ? 's' : ''} completed`}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {!active && (
                              <button onClick={() => reactivatePrescription(s)} disabled={reactivating === s.id} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', background: 'transparent', cursor: 'pointer', opacity: reactivating === s.id ? 0.6 : 1 }}>
                                {reactivating === s.id ? 'Copying…' : 'Reactivate'}
                              </button>
                            )}
                            <button onClick={() => downloadPDF(s)} disabled={pdfLoadingId === s.id} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', background: 'transparent', cursor: 'pointer', opacity: pdfLoadingId === s.id ? 0.6 : 1 }}>
                              {pdfLoadingId === s.id ? 'Generating…' : 'PDF'}
                            </button>
                            <Link to={`/therapist/prescribe/${clientId}/sessions/${s.id}`} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', textDecoration: 'none' }}>Edit</Link>
                            <button onClick={() => deleteSession(s.id, s.name)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: 'var(--color-danger)', background: 'transparent', cursor: 'pointer' }}>Delete</button>
                          </div>
                          {pdfError === s.id && <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>PDF failed</span>}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              })()}
            </motion.div>
          )}

          {/* ── Session History ── */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {historyTabLoading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading history…</p>}
              {!historyTabLoading && mergedTimeline.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No completed sessions yet.</p>
              )}
              {mergedTimeline.map((entry, i) => {
                if (entry.type === 'session') {
                  const log = entry.data
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                      style={{ ...CARD, padding: 0, marginBottom: '12px' }}
                    >
                      <ShimmerLine />
                      <button
                        onClick={() => setExpandedLogId(prev => prev === log.id ? null : log.id)}
                        style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                            {log.prescriptions?.name ?? 'Session'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '3px' }}>
                            {new Date(log.completed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                            {log.session_rpe != null ? ` · RPE ${log.session_rpe}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{expandedLogId === log.id ? '▲' : '▼'}</span>
                      </button>
                      {expandedLogId === log.id && (
                        <div style={{ borderTop: '1px solid var(--color-elevated)' }}>
                          {(log.exercise_logs ?? []).map(el => (
                            <div key={el.id} style={{ borderBottom: '1px solid var(--color-elevated)' }}>
                              <ExerciseLogDetail
                                el={el}
                                videoUrls={videoUrls}
                                onPlayVideo={playVideo}
                                weightUnit={weightUnit}
                              />
                            </div>
                          ))}
                          {log.session_notes && (
                            <div style={{ padding: '10px 20px', fontSize: '12px', color: 'var(--color-muted)' }}>
                              Note: {log.session_notes}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                }

                // Check-in entry
                const ci = entry.data
                const isExpanded = expandedCheckInId === ci.responseId
                return (
                  <motion.div
                    key={ci.responseId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                    style={{ background: 'var(--color-surface)', backdropFilter: 'blur(12px)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '14px', overflow: 'hidden', marginBottom: '12px', position: 'relative' }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.35), transparent)' }} />
                    <button
                      onClick={() => setExpandedCheckInId(isExpanded ? null : ci.responseId)}
                      style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>✦ Check-In</span>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{ci.formName}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '3px' }}>
                          {formatPeriodDate(ci.periodStartDate)} · Submitted {new Date(ci.submittedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid rgba(245,158,11,0.1)', padding: '14px 20px' }}>
                        {ci.questions.map(q => {
                          const answer = ci.answers[q.id]
                          return (
                            <div key={q.id} style={{ marginBottom: '14px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>{q.question_text}</div>
                              {q.question_type === 'scale' ? (
                                <div>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {[1,2,3,4,5].map(n => (
                                      <div key={n} style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, background: answer === n ? '#29B5CC' : 'rgba(255,255,255,0.03)', border: answer === n ? '1px solid #29B5CC' : '1px solid rgba(100,160,255,0.1)', color: answer === n ? '#000' : 'var(--color-muted)' }}>{n}</div>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-subtle)', marginTop: '4px', width: '155px' }}>
                                    <span>1 – Not good</span><span>5 – Very good</span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '12px', color: 'var(--color-text)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,160,255,0.08)', borderRadius: '6px', padding: '8px 10px', lineHeight: 1.5 }}>
                                  {answer ?? '—'}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </motion.div>
                )
              })}
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

      {/* Session dropdown — fixed position to escape PageHero overflow:hidden */}
      {showSessionDropdown && (
        <div data-session-dropdown style={{ position: 'fixed', top: sessionDropdownPos.top, right: sessionDropdownPos.right, background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '10px', minWidth: '190px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden' }}>
          <button onClick={() => { setShowSessionDropdown(false); createSession() }} disabled={creating} style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}>
            Create from scratch
          </button>
          <div style={{ height: '1px', background: 'rgba(41,181,204,0.1)', margin: '0 10px' }} />
          <button onClick={() => { setShowSessionDropdown(false); setShowApplyModal(true) }} style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}>
            Apply session template
          </button>
        </div>
      )}

      {/* Program dropdown — fixed position to escape PageHero overflow:hidden */}
      {showProgramDropdown && (
        <div data-program-dropdown style={{ position: 'fixed', top: programDropdownPos.top, right: programDropdownPos.right, background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '10px', minWidth: '200px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden' }}>
          <button onClick={() => { setShowProgramDropdown(false); setShowCreateProgramModal(true) }} style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}>
            Create from scratch
          </button>
          <div style={{ height: '1px', background: 'rgba(41,181,204,0.1)', margin: '0 10px' }} />
          <button onClick={() => { setShowProgramDropdown(false); setShowApplyProgramModal(true) }} style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}>
            Apply program template
          </button>
        </div>
      )}

      {/* PDF dropdown — fixed position to escape PageHero overflow:hidden */}
      {showPdfMenu && (
        <div
          data-pdf-menu
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '10px', minWidth: '190px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden' }}
        >
          <button
            onClick={() => { setShowPdfMenu(false); downloadAllPDF() }}
            className="hover:bg-white/5 transition-colors"
            style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            ⬇ Download PDF
          </button>
          <div style={{ height: '1px', background: 'rgba(41,181,204,0.1)', margin: '0 10px' }} />
          <button
            onClick={() => { setShowPdfMenu(false); setShowEmailConfirm(true) }}
            className="hover:bg-white/5 transition-colors"
            style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            ✉ Email to client
          </button>
        </div>
      )}

      {/* Email confirmation modal */}
      {showEmailConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '24px', width: '300px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <p style={{ margin: '0 0 6px', color: '#e2e8f0', fontSize: '15px', fontWeight: 600 }}>Email prescription PDF?</p>
            <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: '13px' }}>
              The PDF will be sent to <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{client?.email}</span>
            </p>
            {emailError && (
              <p style={{ margin: '0 0 14px', color: 'var(--color-danger)', fontSize: '12px' }}>Failed to send — please try again.</p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setShowEmailConfirm(false); setEmailError(false) }}
                disabled={emailLoading}
                style={{ flex: 1, padding: '9px', background: 'var(--color-border)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={emailPDF}
                disabled={emailLoading}
                style={{ flex: 1, padding: '9px', background: '#29B5CC', border: 'none', color: '#0f172a', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: emailLoading ? 'default' : 'pointer', opacity: emailLoading ? 0.7 : 1 }}
              >
                {emailLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email success toast */}
      {emailSuccess && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 100 }}>
          <span style={{ color: '#29B5CC', fontSize: '14px' }}>✓</span>
          <span style={{ color: '#e2e8f0', fontSize: '13px' }}>PDF sent to {client?.email}</span>
        </div>
      )}

      {showCreateProgramModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px' }}>
            <p style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>New Program</p>
            <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Name</label>
            <input
              autoFocus
              value={newProgramName}
              onChange={e => setNewProgramName(e.target.value)}
              placeholder="e.g. 12-Week Knee Rehab"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
            />
            <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Duration (weeks)</label>
            <input
              type="number"
              min="1"
              max="52"
              value={newProgramWeeks}
              onChange={e => setNewProgramWeeks(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowCreateProgramModal(false); setNewProgramName(''); setNewProgramWeeks(4) }} style={{ flex: 1, padding: '9px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button
                onClick={() => { setShowCreateProgramModal(false); createProgram(newProgramName || 'New Program', newProgramWeeks) }}
                disabled={creatingProgram}
                style={{ flex: 1, padding: '9px', background: '#29B5CC', border: 'none', borderRadius: '7px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplyProgramModal && (
        <ApplyProgramTemplateModal
          therapistId={profile.id}
          clientId={clientId}
          onClose={() => setShowApplyProgramModal(false)}
          onApplied={() => { setShowApplyProgramModal(false); fetchData() }}
        />
      )}
    </SidebarLayout>
  )
}
