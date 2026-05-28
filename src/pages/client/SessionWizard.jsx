import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { toCanonical, fromCanonical, formatWeight } from '../../utils/weightUtils'
import VideoPlayer from '../../components/VideoPlayer'
import { motion } from 'framer-motion'
import { CARD, SHIMMER } from '../../components/therapist/styles'

function ScaleSelector({ label, value, onChange }) {
  return (
    <div>
      <p className="text-xs font-medium text-dark-muted mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-11 h-11 rounded text-sm font-medium transition-colors ${
              value === n
                ? 'bg-brand-primary text-white'
                : 'border border-dark-border text-dark-muted hover:bg-dark-elevated hover:text-dark-text'
            }`}
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

  const weightUnit = useWeightUnit()
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [clientId, setClientId] = useState(null)  // clients.id (FK), distinct from auth uid
  const [step, setStep] = useState('intro')
  const [sessionEffort, setSessionEffort] = useState(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [clinicBrand, setClinicBrand] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [painAcknowledged, setPainAcknowledged] = useState(false)

  useEffect(() => {
    setPainAcknowledged(false)
  }, [step])

  useEffect(() => {
    async function fetchData() {
      const [sessionRes, exercisesRes, clientRes] = await Promise.all([
        supabase.from('prescriptions').select('id, name, therapist_id').eq('id', sessionId).single(),
        supabase
          .from('prescription_exercises')
          .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
          .eq('prescription_id', sessionId)
          .order('id', { ascending: true }),
        supabase
          .from('clients')
          .select('id')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
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

      setExercises(
        (exercisesRes.data ?? []).map(pe => ({
          ...pe,
          // per-set data: one entry per prescribed set
          setsData: Array(pe.sets || 1).fill(null).map(() => ({ reps: '', weight: '' })),
          currentSet: 0,
          allSetsDone: false,
          painRating: null,
          clientNotes: '',
          videoFile: null,
        }))
      )

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

  async function handleComplete() {
    setSubmitting(true)
    setError(null)

    // Upload any staged feedback videos
    const videoUrls = {}
    for (const ex of exercises) {
      if (ex.videoFile) {
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
      exercises.map(ex => ({
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-dark-bg">
        <p className="text-sm text-dark-muted">Loading…</p>
      </div>
    )
  }

  if (error && step !== 'summary') {
    return (
      <div className="min-h-[100dvh] bg-dark-bg p-8">
        <p className="text-sm text-red-400">{error}</p>
        <Link to="/client" className="mt-2 inline-block text-sm text-brand-primary hover:underline">
          Back
        </Link>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e1117', padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...CARD, maxWidth: '384px', width: '100%', textAlign: 'center', position: 'relative' }}>
          <div style={SHIMMER} />
          <div style={{ margin: '0 auto 16px', display: 'flex', height: '48px', width: '48px', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: 'rgba(74,222,128,0.1)' }}>
            <svg style={{ height: '24px', width: '24px', color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f0f0f0', margin: '0 0 8px' }}>Great work!</h2>
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} completed and logged.
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
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0e1117', padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <div style={{ ...CARD, maxWidth: '384px', width: '100%', textAlign: 'center', position: 'relative' }}>
          <div style={SHIMMER} />
          <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: '8px' }}>Session</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f0f0', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{session.name}</h1>
          <p style={{ fontSize: '13px', color: '#888', margin: '0 0 32px' }}>
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setStep(0)}
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
          <Link to="/client" style={{ display: 'block', fontSize: '13px', color: '#555', textDecoration: 'none' }}>
            Back to sessions
          </Link>
        </div>
      </div>
    )
  }

  // ── Per-exercise step ─────────────────────────────────────────────────────
  if (typeof step === 'number') {
    const ex = exercises[step]
    const isLast = step === exercises.length - 1
    const { setsData, currentSet, allSetsDone } = ex
    const currentSetData = setsData[currentSet] ?? { reps: '', weight: '' }
    const isLastSet = currentSet === setsData.length - 1

    function handleBack() {
      if (!allSetsDone && currentSet > 0) {
        // Go back one set within this exercise
        updateEx(step, 'currentSet', currentSet - 1)
      } else if (!allSetsDone && currentSet === 0) {
        setStep(step === 0 ? 'intro' : step - 1)
      } else {
        // All sets done, back into set entry (last set)
        updateEx(step, 'allSetsDone', false)
        updateEx(step, 'currentSet', setsData.length - 1)
      }
    }

    return (
      <div className="min-h-[100dvh] bg-dark-bg">
        {/* Sticky progress header */}
        <div className="sticky top-0 z-10 bg-dark-surface border-b border-dark-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-sm text-dark-muted hover:text-dark-text"
          >
            ← Back
          </button>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              {exercises.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-colors ${
                    exercises.length > 8 ? 'w-3' : 'w-5'
                  } ${i < step ? 'bg-dark-subtle' : i === step ? 'bg-brand-primary' : 'bg-dark-elevated'}`}
                />
              ))}
            </div>
            <span className="mt-1 text-xs text-dark-subtle">
              {step + 1} / {exercises.length}
            </span>
          </div>
          <div className="flex-shrink-0 overflow-hidden">
            {clinicBrand?.logo_url ? (
              <img
                src={clinicBrand.logo_url}
                alt=""
                style={{ maxHeight: '24px', maxWidth: '80px', objectFit: 'contain' }}
              />
            ) : clinicBrand?.clinic_name ? (
              <span className="text-xs text-dark-subtle">{clinicBrand.clinic_name}</span>
            ) : null}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Exercise identity */}
          <div>
            <h2 className="text-xl font-semibold text-dark-text">{ex.exercises?.name ?? 'Exercise'}</h2>
            {ex.exercises?.category && (
              <span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(41,181,204,0.08)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', color: '#29B5CC' }}>
                {ex.exercises.category}
              </span>
            )}
          </div>

          {ex.exercises?.video_url && <VideoPlayer url={ex.exercises.video_url} />}

          {/* Prescribed target */}
          <div className="rounded-lg border border-dark-border bg-dark-elevated px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-dark-subtle mb-1">Target</p>
            <p className="text-sm font-medium text-dark-text">
              {ex.sets} sets × {ex.reps} reps{ex.weight ? ` @ ${formatWeight(ex.weight, weightUnit)}` : ''}
            </p>
          </div>

          {ex.therapist_notes && (
            <p className="rounded bg-dark-accent-bg border border-dark-border px-3 py-2 text-sm text-dark-accent">
              {ex.therapist_notes}
            </p>
          )}

          {/* Per-set inputs */}
          {!allSetsDone ? (
            <div className="space-y-4">
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
                <span style={{ fontSize: '13px', color: '#555' }}>of {setsData.length}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-muted">Reps</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentSetData.reps}
                    onChange={e => updateSetField(step, currentSet, 'reps', e.target.value)}
                    placeholder={ex.reps ? String(ex.reps) : '—'}
                    className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-muted">
                    Weight <span className="font-normal text-dark-subtle">({weightUnit}, optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={currentSetData.weight}
                    onChange={e => updateSetField(step, currentSet, 'weight', e.target.value)}
                    placeholder={ex.weight ? String(parseFloat(fromCanonical(ex.weight, weightUnit).toFixed(1))) : '—'}
                    className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!currentSetData.reps}
                onClick={() => completeSet(step)}
                style={{ width: '100%', background: !currentSetData.reps ? 'rgba(41,181,204,0.4)' : '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: !currentSetData.reps ? 'not-allowed' : 'pointer' }}
              >
                {isLastSet ? 'Complete final set →' : `Complete Set ${currentSet + 1} →`}
              </button>

              {/* Compact summary of already-done sets */}
              {currentSet > 0 && (
                <div style={{ background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(41,181,204,0.12)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {setsData.slice(0, currentSet).map((s, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}
                    >
                      Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                    </motion.p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* All sets done — show pain + notes */
            <div className="space-y-4">
              {/* Recap of completed sets */}
              <div style={{ background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(41,181,204,0.12)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {setsData.map((s, i) => (
                  <p key={i} style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}>
                    Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                  </p>
                ))}
              </div>

              <ScaleSelector
                label="Pain level (0 = none, 10 = worst)"
                value={ex.painRating}
                onChange={v => updateEx(step, 'painRating', v)}
              />

              {ex.painRating >= 7 && (
                <div className="rounded border border-amber-800/30 bg-amber-900/20 px-3 py-3">
                  <p className="text-sm font-medium text-amber-400">
                    Your pain rating is high. If this is new or severe, stop and seek medical advice.
                  </p>
                  <label className="mt-3 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={painAcknowledged}
                      onChange={e => setPainAcknowledged(e.target.checked)}
                      className="rounded border-dark-border text-brand-primary focus:ring-brand-primary focus:ring-offset-0 bg-dark-elevated"
                    />
                    <span className="text-sm text-dark-muted">I understand, continue anyway</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-dark-muted">
                  Notes for therapist <span className="font-normal text-dark-subtle">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={ex.clientNotes}
                  onChange={e => updateEx(step, 'clientNotes', e.target.value)}
                  placeholder="e.g. felt tight on rep 3"
                  className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
                />
              </div>

              {/* Feedback video */}
              <div>
                <label className="block text-xs font-medium text-dark-muted">
                  Feedback video <span className="font-normal text-dark-subtle">(optional)</span>
                </label>
                {ex.videoFile ? (
                  <div className="mt-1 flex items-center justify-between rounded border border-dark-border px-3 py-1.5 text-sm">
                    <span className="text-dark-text truncate">{ex.videoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => updateEx(step, 'videoFile', null)}
                      className="ml-2 shrink-0 text-dark-subtle hover:text-dark-muted"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center gap-2 rounded border border-dashed border-dark-border px-3 py-2 text-sm text-dark-muted hover:border-dark-accent">
                    <span>+ Add video</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) updateEx(step, 'videoFile', file)
                      }}
                    />
                  </label>
                )}
              </div>

              <button
                onClick={() => setStep(isLast ? 'summary' : step + 1)}
                disabled={ex.painRating >= 7 && !painAcknowledged}
                style={{ width: '100%', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: (ex.painRating >= 7 && !painAcknowledged) ? 0.4 : 1 }}
              >
                {isLast ? 'Review session →' : 'Next →'}
              </button>
            </div>
          )}

          <p className="mt-4 text-xs text-dark-subtle text-center">
            Stop and seek medical advice if you experience sudden severe pain, chest pain, or dizziness.
          </p>
        </div>
      </div>
    )
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: '80px' }}>
      {/* Intentional design change: replaces the per-exercise sticky header (progress dots + clinic logo)
          with a minimal back-only bar. The progress dots don't apply on the summary step. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(14,17,23,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>
        <button
          onClick={() => setStep(exercises.length - 1)}
          style={{ background: 'none', border: 'none', fontSize: '13px', color: '#888', cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: '512px', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', margin: 0, letterSpacing: '-0.02em' }}>Session summary</h2>

        {/* Exercise recap — glass card */}
        <div style={{ ...CARD, padding: 0, position: 'relative', overflow: 'hidden' }}>
          <div style={SHIMMER} />
          {exercises.map((ex, i) => (
            <div
              key={ex.id}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
                borderBottom: i < exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.exercises?.name ?? 'Exercise'}
                </p>
                <p style={{ marginTop: '2px', fontSize: '11px', color: '#888', margin: '2px 0 0' }}>
                  {ex.setsData.length} set{ex.setsData.length !== 1 ? 's' : ''} completed
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {ex.painRating !== null && (
                  <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Pain: {ex.painRating}/10</p>
                )}
                {ex.videoFile && (
                  <p style={{ marginTop: '2px', fontSize: '11px', color: '#4ade80', margin: '2px 0 0' }}>Video attached</p>
                )}
                <button
                  onClick={() => setStep(i)}
                  style={{ marginTop: '2px', fontSize: '11px', color: '#29B5CC', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        <ScaleSelector
          label="How hard was the session? (0 = easy, 10 = maximum)"
          value={sessionEffort}
          onChange={setSessionEffort}
        />

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '6px' }}>
            Session notes <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            rows={3}
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="How did the session feel overall?"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '7px',
              padding: '9px 12px',
              color: '#f0f0f0',
              fontSize: '13px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}

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
