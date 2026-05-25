import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { toCanonical, fromCanonical, formatWeight } from '../../utils/weightUtils'

function VideoPlayer({ url }) {
  if (!url) return null
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
  if (isYouTube) {
    let embedUrl = url
    if (url.includes('watch?v=')) {
      const videoId = new URL(url).searchParams.get('v')
      embedUrl = `https://www.youtube.com/embed/${videoId}`
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0]
      embedUrl = `https://www.youtube.com/embed/${videoId}`
    }
    return (
      <iframe
        src={embedUrl}
        className="w-full rounded"
        style={{ aspectRatio: '16/9' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Exercise video"
      />
    )
  }
  return <video src={url} controls className="w-full rounded" style={{ aspectRatio: '16/9' }} />
}

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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const [sessionRes, exercisesRes, clientRes] = await Promise.all([
        supabase.from('prescriptions').select('id, name').eq('id', sessionId).single(),
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-dark-bg px-4">
        <div className="max-w-sm w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-900/20">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-dark-text">Great work!</h2>
          <p className="mt-2 text-sm text-dark-muted">
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} completed and logged.
          </p>
          <Link
            to="/client"
            className="mt-6 inline-block rounded bg-brand-primary px-6 py-2.5 text-sm text-white hover:bg-brand-primary-dark"
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
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-dark-bg px-4">
        <div className="max-w-sm w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-dark-subtle mb-2">Session</p>
          <h1 className="text-2xl font-semibold text-dark-text">{session.name}</h1>
          <p className="mt-2 text-sm text-dark-muted">
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setStep(0)}
            className="mt-8 w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark"
          >
            Start session
          </button>
          <Link to="/client" className="mt-3 block text-sm text-dark-subtle hover:text-dark-muted">
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
          <span className="text-xs text-dark-subtle">
            {step + 1} / {exercises.length}
          </span>
        </div>

        <div className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {/* Exercise identity */}
          <div>
            <h2 className="text-xl font-semibold text-dark-text">{ex.exercises?.name ?? 'Exercise'}</h2>
            {ex.exercises?.category && (
              <span className="mt-1 inline-block rounded-full bg-dark-elevated px-2.5 py-0.5 text-xs text-dark-muted">
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
              <p className="text-sm font-semibold text-dark-text">
                Set {currentSet + 1} of {setsData.length}
              </p>

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
                className="w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-40"
              >
                {isLastSet ? 'Complete final set →' : `Complete Set ${currentSet + 1} →`}
              </button>

              {/* Compact summary of already-done sets */}
              {currentSet > 0 && (
                <div className="rounded border border-dark-border bg-dark-surface px-3 py-2 space-y-1">
                  {setsData.slice(0, currentSet).map((s, i) => (
                    <p key={i} className="text-xs text-dark-muted">
                      Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* All sets done — show pain + notes */
            <div className="space-y-4">
              {/* Recap of completed sets */}
              <div className="rounded border border-dark-border bg-dark-surface px-3 py-2 space-y-1">
                {setsData.map((s, i) => (
                  <p key={i} className="text-xs text-dark-muted">
                    Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                  </p>
                ))}
              </div>

              <ScaleSelector
                label="Pain level (0 = none, 10 = worst)"
                value={ex.painRating}
                onChange={v => updateEx(step, 'painRating', v)}
              />

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
                className="w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark"
              >
                {isLast ? 'Review session →' : 'Next →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-dark-bg">
      <div className="sticky top-0 z-10 bg-dark-surface border-b border-dark-border px-4 py-3">
        <button
          onClick={() => setStep(exercises.length - 1)}
          className="text-sm text-dark-muted hover:text-dark-text"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <h2 className="text-xl font-semibold text-dark-text">Session summary</h2>

        <div className="rounded-lg border border-dark-border bg-dark-surface divide-y divide-dark-border">
          {exercises.map((ex, i) => (
            <div key={ex.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-text truncate">{ex.exercises?.name ?? 'Exercise'}</p>
                <p className="mt-0.5 text-xs text-dark-muted">
                  {ex.setsData.length} set{ex.setsData.length !== 1 ? 's' : ''} completed
                </p>
              </div>
              <div className="text-right shrink-0">
                {ex.painRating !== null && (
                  <p className="text-xs text-dark-muted">Pain: {ex.painRating}/10</p>
                )}
                {ex.videoFile && (
                  <p className="mt-0.5 text-xs text-green-400">Video attached</p>
                )}
                <button
                  onClick={() => setStep(i)}
                  className="mt-0.5 text-xs text-brand-primary hover:underline"
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
          <label className="block text-xs font-medium text-dark-muted">
            Session notes <span className="font-normal text-dark-subtle">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="How did the session feel overall?"
            className="mt-1 w-full rounded border border-dark-border bg-dark-elevated px-3 py-2.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleComplete}
          disabled={submitting}
          className="w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Complete session'}
        </button>
      </div>
    </div>
  )
}
