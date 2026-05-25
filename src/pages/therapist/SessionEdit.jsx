import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ExercisePicker from '../../components/therapist/ExercisePicker'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'

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
      <iframe src={embedUrl} className="w-full rounded mt-2" style={{ aspectRatio: '16/9' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen title="Exercise video" />
    )
  }
  return <video src={url} controls className="w-full rounded mt-2" style={{ aspectRatio: '16/9' }} />
}

export default function SessionEdit() {
  const { clientId, sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const weightUnit = useWeightUnit()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exercises, setExercises] = useState([])

  const [name, setName] = useState('')
  const [frequencyDays, setFrequencyDays] = useState(null)
  const [customDays, setCustomDays] = useState('')
  const [startDate, setStartDate] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(null)
  const [customWeeks, setCustomWeeks] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [sessionId, profile?.id])

  async function fetchData() {
    setLoading(true)
    const [sessionRes, exercisesRes] = await Promise.all([
      supabase.from('prescriptions').select('id, name, frequency_days, start_date, duration_weeks').eq('id', sessionId).single(),
      supabase
        .from('prescription_exercises')
        .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
        .eq('prescription_id', sessionId),
    ])

    if (sessionRes.error) { setError('Session not found.'); setLoading(false); return }

    const data = sessionRes.data
    setName(data.name)
    const fd = data.frequency_days
    if (!fd) setFrequencyDays(null)
    else if (fd === 1) setFrequencyDays(1)
    else if (fd === 7) setFrequencyDays(7)
    else { setFrequencyDays('custom'); setCustomDays(String(fd)) }

    setStartDate(data.start_date ?? new Date().toISOString().split('T')[0])
    const dw = data.duration_weeks
    if (dw == null) {
      setDurationWeeks(null)
    } else if ([1, 2, 4, 6, 8, 12].includes(dw)) {
      setDurationWeeks(dw)
    } else {
      setDurationWeeks('custom')
      setCustomWeeks(String(dw))
    }

    if (exercisesRes.error) {
      setError('Failed to load exercises: ' + exercisesRes.error.message)
    } else {
      setExercises(exercisesRes.data ?? [])
    }
    setLoading(false)
  }

  async function saveMeta() {
    setSavingMeta(true)
    let fd = frequencyDays
    if (frequencyDays === 'custom') fd = parseInt(customDays) || null
    const dw = durationWeeks === 'custom' ? parseInt(customWeeks) || null : durationWeeks
    await supabase.from('prescriptions').update({
      name,
      frequency_days: fd,
      start_date: startDate || null,
      duration_weeks: dw,
    }).eq('id', sessionId)
    setSavingMeta(false)
    navigate(`/therapist/prescribe/${clientId}`)
  }

  async function handleAddExercise({ exerciseId, sets, reps, weight, notes }) {
    const { data, error: insertError } = await supabase
      .from('prescription_exercises')
      .insert({
        prescription_id: sessionId,
        exercise_id: exerciseId,
        sets,
        reps,
        weight,
        therapist_notes: notes,
      })
      .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
      .single()
    if (insertError) throw new Error(insertError.message)
    setExercises(prev => [...prev, data])
  }

  async function removeExercise(peId) {
    await supabase.from('prescription_exercises').delete().eq('id', peId)
    setExercises(prev => prev.filter(e => e.id !== peId))
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

  if (error) {
    return (
      <SidebarLayout>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-red-400">{error}</p>
          <Link to={`/therapist/prescribe/${clientId}`} className="mt-2 inline-block text-sm text-dark-accent hover:underline">
            Back
          </Link>
        </div>
      </SidebarLayout>
    )
  }

  const inputClass = 'block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none'
  const pillBase = 'rounded-full px-3 py-1 text-sm cursor-pointer transition-colors duration-150'
  const pillActive = 'bg-brand-primary text-white'
  const pillInactive = 'bg-dark-elevated border border-dark-border text-dark-muted hover:text-dark-text'

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to={`/therapist/prescribe/${clientId}`} className="text-sm text-dark-muted hover:text-dark-text">
          ← Back to sessions
        </Link>

        {/* Session details */}
        <div className="mt-4 max-w-lg bg-dark-surface rounded-lg border border-dark-border p-5">
          <h2 className="text-sm font-medium text-dark-text mb-3">Session details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-text">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">Repeat frequency</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'No repeat', value: null },
                  { label: 'Daily', value: 1 },
                  { label: 'Weekly', value: 7 },
                  { label: 'Custom', value: 'custom' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setFrequencyDays(opt.value)}
                    className={`${pillBase} ${frequencyDays === opt.value ? pillActive : pillInactive}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {frequencyDays === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min="1" value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-20 rounded border border-dark-border bg-dark-elevated px-3 py-1.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
                  />
                  <span className="text-sm text-dark-muted">days</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded border border-dark-border bg-dark-elevated px-3 py-1.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">Duration</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'None (ongoing)', value: null },
                  { label: '1 week', value: 1 },
                  { label: '2 weeks', value: 2 },
                  { label: '4 weeks', value: 4 },
                  { label: '6 weeks', value: 6 },
                  { label: '8 weeks', value: 8 },
                  { label: '12 weeks', value: 12 },
                  { label: 'Custom', value: 'custom' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setDurationWeeks(opt.value)}
                    className={`${pillBase} ${durationWeeks === opt.value ? pillActive : pillInactive}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {durationWeeks === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min="1" value={customWeeks}
                    onChange={e => setCustomWeeks(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-20 rounded border border-dark-border bg-dark-elevated px-3 py-1.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
                  />
                  <span className="text-sm text-dark-muted">weeks</span>
                </div>
              )}
            </div>
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
            >
              {savingMeta ? 'Saving…' : 'Save & Exit'}
            </button>
          </div>
        </div>

        <div className="mt-6 max-w-lg space-y-4">
          {/* Exercise list */}
          <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-border">
              <h2 className="text-sm font-semibold text-dark-text">
                Exercises
                {exercises.length > 0 && (
                  <span className="ml-1 font-normal text-dark-subtle">({exercises.length})</span>
                )}
              </h2>
            </div>
            {exercises.length === 0 ? (
              <p className="px-4 py-4 text-sm text-dark-subtle">No exercises added yet.</p>
            ) : (
              <div className="divide-y divide-dark-border">
                {exercises.map(pe => (
                  <div key={pe.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-dark-text">{pe.exercises.name}</p>
                        <p className="mt-0.5 text-xs text-dark-muted">
                          {pe.sets} sets × {pe.reps} reps
                          {pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                        </p>
                        {pe.therapist_notes && (
                          <p className="mt-0.5 text-xs text-dark-subtle italic">{pe.therapist_notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeExercise(pe.id)}
                        className="shrink-0 text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors duration-150"
                      >
                        Remove
                      </button>
                    </div>
                    {pe.exercises.video_url && (
                      <VideoPlayer url={pe.exercises.video_url} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ExercisePicker
            onAdd={handleAddExercise}
            weightUnit={weightUnit}
          />
        </div>
      </div>
    </SidebarLayout>
  )
}
