import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import useIsMobile from '../../hooks/useIsMobile'
import { toCanonical, fromCanonical, formatWeight } from '../../utils/weightUtils'
import { formatTempo } from '../../utils/formatTempo'
import VideoPlayer from '../../components/VideoPlayer'
import { motion } from 'framer-motion'
import { CARD } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { buildSessionItems } from '../../utils/supersetUtils'

function ScaleSelector({ label, value, onChange }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              ...(value === n
                ? { background: '#29B5CC', color: '#000', border: 'none' }
                : { background: 'var(--color-elevated)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }),
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SessionWizard() {
  const { sessionId } = useParams()
  const { profile } = useAuth()

  const isMobile = useIsMobile()
  const weightUnit = useWeightUnit()
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [clientId, setClientId] = useState(null)  // clients.id (FK), distinct from auth uid
  const [sessionItems, setSessionItems] = useState([])
  const [openVideoId, setOpenVideoId] = useState(null)  // for superset round screen video toggles
  const [step, setStep] = useState('intro')
  const [sessionEffort, setSessionEffort] = useState(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [clinicBrand, setClinicBrand] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [painAcknowledged, setPainAcknowledged] = useState(false)
  const [showTempo, setShowTempo] = useState(false)

  useEffect(() => {
    setPainAcknowledged(false)
    setShowTempo(false)
  }, [step])

  useEffect(() => {
    async function fetchData() {
      const [sessionRes, exercisesRes, clientRes, groupsRes] = await Promise.all([
        supabase.from('prescriptions').select('id, name, therapist_id').eq('id', sessionId).single(),
        supabase
          .from('prescription_exercises')
          .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(id, name, category, video_url)')
          .eq('prescription_id', sessionId)
          .order('id', { ascending: true }),
        supabase
          .from('clients')
          .select('id')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('prescription_exercise_groups')
          .select('id, label, set_count, order_index, created_at')
          .eq('prescription_id', sessionId)
          .order('order_index', { ascending: true }),
      ])

      if (sessionRes.error || !sessionRes.data) {
        setError('Session not found.')
        setLoading(false)
        return
      }

      if (clientRes.error || !clientRes.data) {
        setError('Your client profile could not be found. Please contact your therapist.')
        setLoading(false)
        return
      }

      setSession(sessionRes.data)
      setClientId(clientRes.data.id)

      if (groupsRes.error) {
        console.error('Groups fetch failed (non-fatal):', groupsRes.error)
      }

      const fetchedExercises = exercisesRes.data ?? []
      const fetchedGroups = groupsRes?.data ?? []

      const exercisesWithState = fetchedExercises.map(pe => ({
        ...pe,
        prescription_exercise_sets: [...(pe.prescription_exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number),
        // per-set data: one entry per prescribed set
        setsData: Array(pe.sets || 1).fill(null).map(() => ({ reps: '', weight: '' })),
        currentSet: 0,
        allSetsDone: false,
        painRating: null,
        clientNotes: '',
        videoFile: null,
      }))

      setExercises(exercisesWithState)

      const rawItems = buildSessionItems(fetchedGroups, exercisesWithState)
      setSessionItems(rawItems.map(item =>
        item.type === 'superset' ? { ...item, currentRound: 0 } : item
      ))

      if (sessionRes.data.therapist_id) {
        const { data: brand } = await supabase
          .from('therapist_profiles')
          .select('clinic_name, logo_url')
          .eq('user_id', sessionRes.data.therapist_id)
          .single()
        if (brand) setClinicBrand(brand)
      }

      setLoading(false)
    }
    fetchData()
  }, [sessionId, profile.id])

  function updateEx(index, field, value) {
    setExercises(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function updateSetField(exIndex, setIndex, field, value) {
    setExercises(prev => {
      const next = [...prev]
      const setsData = [...next[exIndex].setsData]
      setsData[setIndex] = { ...setsData[setIndex], [field]: value }
      next[exIndex] = { ...next[exIndex], setsData }
      return next
    })
  }

  function completeSet(exIndex) {
    setExercises(prev => {
      const next = [...prev]
      const ex = next[exIndex]
      const nextSet = ex.currentSet + 1
      if (nextSet >= ex.setsData.length) {
        next[exIndex] = { ...ex, currentSet: nextSet, allSetsDone: true }
      } else {
        next[exIndex] = { ...ex, currentSet: nextSet }
      }
      return next
    })
  }

  function updateSupersetSetField(itemIndex, exIndex, round, field, value) {
    setSessionItems(prev => {
      const next = [...prev]
      const item = { ...next[itemIndex] }
      const exArr = [...item.exercises]
      const setsData = [...exArr[exIndex].setsData]
      setsData[round] = { ...setsData[round], [field]: value }
      exArr[exIndex] = { ...exArr[exIndex], setsData }
      item.exercises = exArr
      next[itemIndex] = item
      return next
    })
  }

  function updateSupersetExField(itemIndex, exIndex, field, value) {
    setSessionItems(prev => {
      const next = [...prev]
      const item = { ...next[itemIndex] }
      const exArr = [...item.exercises]
      exArr[exIndex] = { ...exArr[exIndex], [field]: value }
      item.exercises = exArr
      next[itemIndex] = item
      return next
    })
  }

  function advanceSupersetRound(itemIndex) {
    setSessionItems(prev => {
      const next = [...prev]
      next[itemIndex] = { ...next[itemIndex], currentRound: next[itemIndex].currentRound + 1 }
      return next
    })
  }

  async function handleComplete() {
    setSubmitting(true)
    setError(null)

    // Upload any staged feedback videos
    const allExerciseEntries = sessionItems.flatMap(item =>
      item.type === 'exercise' ? [item.ex] : item.exercises
    )
    const allowedVideoMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
    const videoUrls = {}
    for (const ex of allExerciseEntries) {
      if (ex.videoFile) {
        if (!allowedVideoMimes.includes(ex.videoFile.type) || ex.videoFile.size > 100 * 1024 * 1024) continue
        const ext = ex.videoFile.name.split('.').pop()
        const path = `${profile.id}/${Date.now()}_${ex.id}.${ext}`
        const { data: up, error: upErr } = await supabase.storage
          .from('feedback-videos')
          .upload(path, ex.videoFile)
        if (!upErr) videoUrls[ex.id] = up.path
      }
    }

    const { data: sessionLog, error: slErr } = await supabase
      .from('session_logs')
      .insert({
        prescription_id: sessionId,
        client_id: profile.id,  // session_logs.client_id stores auth uid
        completed_at: new Date().toISOString(),
        session_rpe: sessionEffort,
        session_notes: sessionNotes.trim() || null,
      })
      .select('id')
      .single()

    if (slErr) {
      setError('Failed to save session. Please try again.')
      setSubmitting(false)
      return
    }

    const { error: elErr } = await supabase.from('exercise_logs').insert(
      allExerciseEntries.map(ex => ({
        prescription_exercise_id: ex.id,
        client_id: clientId,  // exercise_logs.client_id is FK to clients.id
        session_log_id: sessionLog.id,
        sets_completed: ex.setsData.length,
        sets_data: ex.setsData.map(s => ({
          ...s,
          weight: s.weight ? String(toCanonical(parseFloat(s.weight), weightUnit)) : s.weight,
        })),
        reps_completed: null,
        weight_completed: null,
        pain_rating: ex.painRating,
        client_notes: ex.clientNotes.trim() || null,
        video_url: videoUrls[ex.id] ?? null,
        completed_at: new Date().toISOString(),
      }))
    )

    if (elErr) {
      setError(`Session saved but exercise logs failed: ${elErr.message}`)
      setSubmitting(false)
      return
    }

    setStep('done')
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>
      </div>
    )
  }

  if (error && step !== 'summary') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', padding: '32px 16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-danger)' }}>{error}</p>
        <Link to="/client" style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: '#29B5CC', textDecoration: 'none' }}>
          Back
        </Link>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...CARD, maxWidth: '384px', width: '100%', textAlign: 'center', position: 'relative' }}>
          <ShimmerLine />
          <div style={{ margin: '0 auto 16px', display: 'flex', height: '48px', width: '48px', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: 'rgba(74,222,128,0.1)' }}>
            <svg style={{ height: '24px', width: '24px', color: 'var(--color-success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 8px' }}>Great work!</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: '0 0 24px' }}>
            {sessionItems.length} item{sessionItems.length !== 1 ? 's' : ''} completed and logged.
          </p>
          <Link
            to="/client"
            style={{
              display: 'inline-block',
              background: '#29B5CC',
              color: '#000',
              borderRadius: '7px',
              padding: '9px 24px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to sessions
          </Link>
        </div>
      </div>
    )
  }

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...CARD, maxWidth: '384px', width: '100%', textAlign: 'center', position: 'relative' }}>
          <ShimmerLine />
          <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: '8px' }}>Session</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{session.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: '0 0 32px' }}>
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setStep({ itemIndex: 0 })}
            style={{
              width: '100%',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              padding: '11px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '12px',
            }}
          >
            Start session
          </button>
          <Link to="/client" style={{ display: 'block', fontSize: '13px', color: 'var(--color-subtle)', textDecoration: 'none' }}>
            Back to sessions
          </Link>
        </div>
      </div>
    )
  }

  // ── Rest screen (between superset rounds) ─────────────────────────────────
  if (step && typeof step === 'object' && step.restAfterRound !== undefined) {
    const item = sessionItems[step.itemIndex]
    const { group, exercises: superExs } = item
    const completedRound = step.restAfterRound
    const nextRound = item.currentRound  // already incremented by advanceSupersetRound

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ ...CARD, maxWidth: '400px', width: '100%', position: 'relative' }}>
          <ShimmerLine />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(41,181,204,0.10)', border: '1px solid rgba(41,181,204,0.22)', color: '#29B5CC', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
              ⚡ {group.label} — Round {completedRound + 1} complete
            </span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>Rest</div>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>Round {nextRound + 1} of {group.set_count} starts next</div>
          <div style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
            {superExs.map((pe, i) => {
              const logged = pe.setsData[completedRound] ?? {}
              return (
                <div
                  key={pe.id}
                  style={{ padding: '9px 12px', borderBottom: i < superExs.length - 1 ? '1px solid var(--color-border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}
                >
                  <span style={{ color: 'var(--color-text)' }}>{pe.exercises?.name}</span>
                  <span style={{ color: '#29B5CC', fontWeight: 600 }}>
                    {logged.reps || pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                    {logged.weight ? ` · ${logged.weight} ${weightUnit}` : ''} ✓
                  </span>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => setStep({ itemIndex: step.itemIndex })}
            style={{ width: '100%', padding: '13px', background: '#29B5CC', color: '#000', fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Start Round {nextRound + 1} →
          </button>
        </div>
      </div>
    )
  }

  // ── Post-superset pain/notes/video screen ──────────────────────────────────
  if (step && typeof step === 'object' && step.postSuperset === true) {
    const item = sessionItems[step.itemIndex]
    const { group, exercises: superExs } = item
    const isLastItem = step.itemIndex === sessionItems.length - 1
    const hasHighPain = superExs.some(pe => pe.painRating >= 7)

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--color-border)', padding: isMobile ? '12px 14px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div />
          <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>⚡ {group.label}</span>
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            {clinicBrand?.logo_url
              ? <img src={clinicBrand.logo_url} alt="" style={{ maxHeight: '24px', maxWidth: '80px', objectFit: 'contain' }} />
              : clinicBrand?.clinic_name
                ? <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{clinicBrand.clinic_name}</span>
                : null}
          </div>
        </div>

        <div style={{ maxWidth: '512px', margin: '0 auto', padding: '16px', paddingBottom: 'max(2rem,env(safe-area-inset-bottom))' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>How did it feel?</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px' }}>Rate each exercise below</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            {superExs.map((pe, exIdx) => (
              <div key={pe.id} style={{ ...CARD, padding: 0, overflow: 'hidden', position: 'relative' }}>
                <ShimmerLine />
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>{pe.exercises?.name}</div>

                  <ScaleSelector
                    label="Pain (0 = none, 10 = severe)"
                    value={pe.painRating}
                    onChange={v => updateSupersetExField(step.itemIndex, exIdx, 'painRating', v)}
                  />

                  <textarea
                    value={pe.clientNotes}
                    onChange={e => updateSupersetExField(step.itemIndex, exIdx, 'clientNotes', e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '8px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />

                  <div>
                    {pe.videoFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{pe.videoFile.name}</span>
                        <button onClick={() => updateSupersetExField(step.itemIndex, exIdx, 'videoFile', null)} style={{ fontSize: '12px', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                      </div>
                    ) : (
                      <label style={{ display: 'block', cursor: 'pointer' }}>
                        <div style={{ padding: '8px 12px', background: 'var(--color-elevated)', border: '1px dashed var(--color-border)', borderRadius: '7px', fontSize: '12px', color: 'var(--color-muted)', textAlign: 'center' }}>
                          Upload feedback video (optional)
                        </div>
                        <input
                          type="file"
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) updateSupersetExField(step.itemIndex, exIdx, 'videoFile', file)
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasHighPain && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: '#f87171', fontWeight: 600, margin: '0 0 8px' }}>High pain reported — please acknowledge before continuing.</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={painAcknowledged}
                  onChange={e => setPainAcknowledged(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>I understand — this will be flagged to my therapist.</span>
              </label>
            </div>
          )}

          <button
            onClick={() => {
              setPainAcknowledged(false)
              setStep(isLastItem ? 'summary' : { itemIndex: step.itemIndex + 1 })
            }}
            disabled={hasHighPain && !painAcknowledged}
            style={{ width: '100%', padding: '13px', background: '#29B5CC', color: '#000', fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '10px', fontFamily: 'inherit', cursor: hasHighPain && !painAcknowledged ? 'default' : 'pointer', opacity: hasHighPain && !painAcknowledged ? 0.4 : 1 }}
          >
            {isLastItem ? 'Done → review session' : 'Done → next exercise'}
          </button>
        </div>
      </div>
    )
  }

  // ── Per-exercise / superset step ──────────────────────────────────────────
  if (step && typeof step === 'object' && step.restAfterRound === undefined && step.postSuperset === undefined) {
    const item = sessionItems[step.itemIndex]
    if (!item) return null

    if (item.type === 'superset') {
      const { group, exercises: superExs, currentRound } = item
      const isLastRound = currentRound === group.set_count - 1

      function handleCompleteRound() {
        if (!isLastRound) {
          advanceSupersetRound(step.itemIndex)
          setStep({ itemIndex: step.itemIndex, restAfterRound: currentRound })
        } else {
          setStep({ itemIndex: step.itemIndex, postSuperset: true })
        }
      }

      return (
        <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--color-border)', padding: isMobile ? '12px 14px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep(step.itemIndex === 0 ? 'intro' : { itemIndex: step.itemIndex - 1 })}
              style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
            >
              ← Back
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {sessionItems.map((_, i) => (
                  <div key={i} style={{ height: '6px', borderRadius: '9999px', width: sessionItems.length > 8 ? '12px' : '20px', background: i < step.itemIndex ? 'var(--color-border-strong)' : i === step.itemIndex ? '#29B5CC' : 'var(--color-border)', transition: 'background 0.2s' }} />
                ))}
              </div>
              <span style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-subtle)' }}>
                {step.itemIndex + 1} / {sessionItems.length}
              </span>
            </div>
            <div style={{ flexShrink: 0, overflow: 'hidden' }}>
              {clinicBrand?.logo_url
                ? <img src={clinicBrand.logo_url} alt="" style={{ maxHeight: '24px', maxWidth: '80px', objectFit: 'contain' }} />
                : clinicBrand?.clinic_name
                  ? <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{clinicBrand.clinic_name}</span>
                  : null}
            </div>
          </div>

          <div style={{ maxWidth: '512px', margin: '0 auto', padding: '16px', paddingBottom: 'max(2rem,env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(41,181,204,0.10)', border: '1px solid rgba(41,181,204,0.22)', color: '#29B5CC', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
                ⚡ {group.label}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Round {currentRound + 1} of {group.set_count}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {superExs.map((pe, exIdx) => {
                const roundData = pe.setsData[currentRound] ?? { reps: '', weight: '' }
                const videoOpen = openVideoId === pe.id
                return (
                  <div key={pe.id} style={{ ...CARD, padding: 0, overflow: 'hidden', position: 'relative' }}>
                    <ShimmerLine />
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-elevated)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '3px', height: '32px', background: '#29B5CC', borderRadius: '2px', opacity: 0.5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>{pe.exercises?.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
                            Target: {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}{pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                          </div>
                        </div>
                        {pe.exercises?.video_url && (
                          <button
                            onClick={() => setOpenVideoId(v => v === pe.id ? null : pe.id)}
                            style={{ fontSize: '11px', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '5px', padding: '3px 7px', background: 'none', cursor: 'pointer' }}
                          >
                            {videoOpen ? '▲ Video' : '▶ Video'}
                          </button>
                        )}
                      </div>
                      {videoOpen && pe.exercises?.video_url && (
                        <div style={{ marginTop: '10px' }}>
                          <VideoPlayer url={pe.exercises.video_url} />
                        </div>
                      )}
                      {pe.therapist_notes && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#29B5CC', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
                          {pe.therapist_notes}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                          {pe.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}
                        </label>
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={roundData.reps}
                          onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', e.target.value)}
                          placeholder={pe.reps ? String(pe.reps) : '—'}
                          style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                          Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                        </label>
                        <input
                          type="text" inputMode="decimal"
                          value={roundData.weight}
                          onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'weight', e.target.value)}
                          placeholder="—"
                          style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleCompleteRound}
              style={{ width: '100%', padding: '13px', background: '#29B5CC', color: '#000', fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {isLastRound
                ? 'Complete round → how did it feel?'
                : `Complete round ${currentRound + 1} → rest`}
            </button>
          </div>
        </div>
      )
    }

    const exIdx = exercises.findIndex(e => e.id === item.ex.id)
    const ex = exercises[exIdx] ?? item.ex  // live state from exercises array
    const isLast = step.itemIndex === sessionItems.length - 1
    const { setsData, currentSet, allSetsDone } = ex
    const currentSetData = setsData[currentSet] ?? { reps: '', weight: '' }
    const isLastSet = currentSet === setsData.length - 1

    function handleBack() {
      if (!allSetsDone && currentSet > 0) {
        // Go back one set within this exercise
        updateEx(exIdx, 'currentSet', currentSet - 1)
      } else if (!allSetsDone && currentSet === 0) {
        setStep(step.itemIndex === 0 ? 'intro' : { itemIndex: step.itemIndex - 1 })
      } else {
        // All sets done, back into set entry (last set)
        updateEx(exIdx, 'allSetsDone', false)
        updateEx(exIdx, 'currentSet', setsData.length - 1)
      }
    }

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        {/* Sticky progress header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--color-border)', padding: isMobile ? '12px 14px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {sessionItems.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: '6px',
                    borderRadius: '9999px',
                    width: sessionItems.length > 8 ? '12px' : '20px',
                    background: i < step.itemIndex ? 'var(--color-border-strong)' : i === step.itemIndex ? '#29B5CC' : 'var(--color-border)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
            <span style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-subtle)' }}>
              {step.itemIndex + 1} / {sessionItems.length}
            </span>
          </div>
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
            {clinicBrand?.logo_url ? (
              <img
                src={clinicBrand.logo_url}
                alt=""
                style={{ maxHeight: '24px', maxWidth: '80px', objectFit: 'contain' }}
              />
            ) : clinicBrand?.clinic_name ? (
              <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{clinicBrand.clinic_name}</span>
            ) : null}
          </div>
        </div>

        <div style={{ maxWidth: '512px', margin: '0 auto', padding: '16px', paddingBottom: 'max(2rem,env(safe-area-inset-bottom))' }}>
          <div style={{ ...CARD, padding: 0, overflow: 'hidden', position: 'relative' }}>
            <ShimmerLine />
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Exercise identity */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px' }}>{ex.exercises?.name ?? 'Exercise'}</h2>
            {ex.exercises?.category && (
              <span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(41,181,204,0.08)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', color: '#29B5CC' }}>
                {ex.exercises.category}
              </span>
            )}
          </div>

          {ex.exercises?.video_url && <VideoPlayer url={ex.exercises.video_url} />}

          {/* Prescribed target */}
          <div style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 14px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: '4px' }}>Target</p>
            {ex.prescription_exercise_sets?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {ex.prescription_exercise_sets.map((s, i) => {
                  const isDone = i < ex.currentSet
                  const isCurrent = i === ex.currentSet
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px',
                      background: isCurrent ? 'rgba(41,181,204,0.08)' : 'rgba(255,255,255,0.03)',
                      border: isCurrent ? '1px solid rgba(41,181,204,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <span style={{ fontSize: isCurrent ? '12px' : '11px', fontWeight: 700, color: isCurrent ? '#29B5CC' : '#555', fontFamily: 'monospace', width: '16px', textAlign: 'center' }}>
                        {s.set_number}
                      </span>
                      <span style={{ fontSize: isCurrent ? '13px' : '12px', fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--color-text)' : '#666', flex: 1 }}>
                        {s.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                        {s.weight != null ? ` @ ${formatWeight(s.weight, weightUnit)}` : ''}
                      </span>
                      {isDone && <span style={{ fontSize: '11px', color: '#29B5CC', fontWeight: 600 }}>✓</span>}
                      {isCurrent && <span style={{ fontSize: '11px', color: '#29B5CC' }}>← now</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
                {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                {ex.weight ? ` @ ${formatWeight(ex.weight, weightUnit)}` : ''}
              </p>
            )}
          </div>

          {ex.bilateral && (
            <div style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>↔</span>
              <span style={{ fontSize: '13px', color: '#29B5CC' }}>Complete on both sides</span>
            </div>
          )}

          {(() => {
            const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause)
            if (!t) return null
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Tempo</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-text)', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>{t.compact}</span>
                  <button
                    type="button"
                    onClick={() => setShowTempo(v => !v)}
                    style={{
                      width: '18px', height: '18px', borderRadius: '50%', border: '1px solid rgba(41,181,204,0.3)',
                      background: showTempo ? 'rgba(41,181,204,0.2)' : 'rgba(41,181,204,0.08)',
                      color: '#29B5CC', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
                    }}
                  >
                    ?
                  </button>
                </div>
                {showTempo && (
                  <div style={{ marginTop: '8px', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '10px 12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
                      {t.breakdown.map(ph => (
                        <React.Fragment key={ph.label}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#29B5CC' }}>{ph.value}</span>
                          <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{ph.label}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {ex.therapist_notes && (
            <p style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', color: '#29B5CC', margin: 0 }}>
              {ex.therapist_notes}
            </p>
          )}

          {/* Per-set inputs */}
          {!allSetsDone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <motion.span
                  key={currentSet}
                  initial={{ scale: 1, color: '#f0f0f0' }}
                  animate={{ scale: [1, 1.35, 1], color: ['#f0f0f0', '#29B5CC', '#f0f0f0'] }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ fontSize: '15px', fontWeight: 700, display: 'inline-block' }}
                >
                  Set {currentSet + 1}
                </motion.span>
                <span style={{ fontSize: '13px', color: 'var(--color-subtle)' }}>of {setsData.length}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                    {ex.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentSetData.reps}
                    onChange={e => updateSetField(exIdx, currentSet, 'reps', e.target.value)}
                    placeholder={ex.reps ? String(ex.reps) : '—'}
                    style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                    Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={currentSetData.weight}
                    onChange={e => updateSetField(exIdx, currentSet, 'weight', e.target.value)}
                    placeholder={ex.weight ? String(parseFloat(fromCanonical(ex.weight, weightUnit).toFixed(1))) : '—'}
                    style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!currentSetData.reps}
                onClick={() => completeSet(exIdx)}
                style={{ width: '100%', background: !currentSetData.reps ? 'rgba(41,181,204,0.4)' : '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: !currentSetData.reps ? 'not-allowed' : 'pointer' }}
              >
                {isLastSet ? 'Complete final set →' : `Complete Set ${currentSet + 1} →`}
              </button>

              {/* Compact summary of already-done sets */}
              {currentSet > 0 && (
                <div style={{ background: 'var(--color-elevated)', border: '1px solid rgba(41,181,204,0.12)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {setsData.slice(0, currentSet).map((s, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}
                    >
                      Set {i + 1}: {s.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                      {s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                    </motion.p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* All sets done — show pain + notes */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Recap of completed sets */}
              <div style={{ background: 'var(--color-elevated)', border: '1px solid rgba(41,181,204,0.12)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {setsData.map((s, i) => (
                  <p key={i} style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}>
                    Set {i + 1}: {s.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                    {s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                  </p>
                ))}
              </div>

              <ScaleSelector
                label="Pain level (0 = none, 10 = worst)"
                value={ex.painRating}
                onChange={v => updateEx(exIdx, 'painRating', v)}
              />

              {ex.painRating >= 7 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '7px', padding: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-warning)', margin: '0 0 12px' }}>
                    Your pain rating is high. If this is new or severe, stop and seek medical advice.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={painAcknowledged}
                      onChange={e => setPainAcknowledged(e.target.checked)}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>I understand, continue anyway</span>
                  </label>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                  Notes for therapist <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={ex.clientNotes}
                  onChange={e => updateEx(exIdx, 'clientNotes', e.target.value)}
                  placeholder="e.g. felt tight on rep 3"
                  style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
                />
              </div>

              {/* Feedback video */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                  Feedback video <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                {ex.videoFile ? (
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '8px 12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.videoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => updateEx(exIdx, 'videoFile', null)}
                      style={{ marginLeft: '8px', flexShrink: 0, background: 'none', border: 'none', fontSize: '12px', color: 'var(--color-muted)', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label style={{ marginTop: '4px', display: 'flex', cursor: 'pointer', alignItems: 'center', gap: '8px', background: 'var(--color-elevated)', border: '1px dashed var(--color-border-strong)', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', color: 'var(--color-subtle)' }}>
                    <span>+ Add video</span>
                    <input
                      type="file"
                      accept="video/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) updateEx(exIdx, 'videoFile', file)
                      }}
                    />
                  </label>
                )}
              </div>

              <button
                onClick={() => setStep(isLast ? 'summary' : { itemIndex: step.itemIndex + 1 })}
                disabled={ex.painRating >= 7 && !painAcknowledged}
                style={{ width: '100%', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: (ex.painRating >= 7 && !painAcknowledged) ? 0.4 : 1 }}
              >
                {isLast ? 'Review session →' : 'Next →'}
              </button>
            </div>
          )}

            </div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-muted)', textAlign: 'center' }}>
            Stop and seek medical advice if you experience sudden severe pain, chest pain, or dizziness.
          </p>
        </div>
      </div>
    )
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      {/* Intentional design change: replaces the per-exercise sticky header (progress dots + clinic logo)
          with a minimal back-only bar. The progress dots don't apply on the summary step. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--color-border)', padding: '12px 16px' }}>
        <button
          onClick={() => setStep({ itemIndex: sessionItems.length - 1 })}
          style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: '512px', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>Session summary</h2>

        {/* Exercise recap — glass card */}
        {(() => {
          const summaryEntries = sessionItems.flatMap((item, idx) =>
            item.type === 'exercise'
              ? [{ ex: item.ex, itemIndex: idx, isSuperset: false }]
              : item.exercises.map(pe => ({ ex: pe, itemIndex: idx, isSuperset: true }))
          )
          return (
            <div style={{ ...CARD, padding: 0, position: 'relative', overflow: 'hidden' }}>
              <ShimmerLine />
              {summaryEntries.map(({ ex, itemIndex, isSuperset }, i) => (
                <div
                  key={ex.id}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    borderBottom: i < summaryEntries.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.exercises?.name ?? 'Exercise'}
                    </p>
                    <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-muted)', margin: '2px 0 0' }}>
                      {ex.setsData.length} set{ex.setsData.length !== 1 ? 's' : ''} completed
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {ex.painRating !== null && (
                      <p style={{ fontSize: '11px', color: 'var(--color-muted)', margin: 0 }}>Pain: {ex.painRating}/10</p>
                    )}
                    {ex.videoFile && (
                      <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-success)', margin: '2px 0 0' }}>Video attached</p>
                    )}
                    <button
                      onClick={() => {
                        if (!isSuperset) {
                          const exArrIdx = exercises.findIndex(e => e.id === ex.id)
                          if (exArrIdx >= 0) {
                            updateEx(exArrIdx, 'allSetsDone', false)
                            updateEx(exArrIdx, 'currentSet', 0)
                          }
                        }
                        setStep({ itemIndex })
                      }}
                      style={{ marginTop: '2px', fontSize: '11px', color: '#29B5CC', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        <ScaleSelector
          label="How hard was the session? (0 = easy, 10 = maximum)"
          value={sessionEffort}
          onChange={setSessionEffort}
        />

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>
            Session notes <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            rows={3}
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="How did the session feel overall?"
            style={{
              width: '100%',
              background: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: '7px',
              padding: '9px 12px',
              color: 'var(--color-text)',
              fontSize: '13px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)', margin: 0 }}>{error}</p>}

        <button
          onClick={handleComplete}
          disabled={submitting}
          style={{
            width: '100%',
            background: '#29B5CC',
            color: '#000',
            border: 'none',
            borderRadius: '7px',
            padding: '11px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Complete session'}
        </button>
      </div>
    </div>
  )
}
