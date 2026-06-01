import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ExercisePicker from '../../components/therapist/ExercisePicker'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SECTION_LABEL } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import VideoPlayer from '../../components/VideoPlayer'
import useIsMobile from '../../hooks/useIsMobile'

export default function SessionEdit() {
  const { clientId, sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const weightUnit = useWeightUnit()
  const isMobile = useIsMobile()

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

  const pillBase = 'rounded-full px-3 py-1 text-sm cursor-pointer transition-colors duration-150'
  const pillActive = 'bg-brand-primary text-white'
  const pillInactive = 'bg-dark-elevated border border-dark-border text-dark-muted hover:text-dark-text'

  return (
    <SidebarLayout>
      <PageHero
        title={name || 'Edit Session'}
        back={{ label: 'Back', to: `/therapist/prescribe/${clientId}` }}
        actions={
          <button
            onClick={saveMeta}
            disabled={savingMeta}
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: savingMeta ? 'default' : 'pointer',
              opacity: savingMeta ? 0.6 : 1,
            }}
          >
            {savingMeta ? 'Saving…' : 'Save'}
          </button>
        }
      />

      <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Session details glass card */}
        <div style={{ ...CARD }}>
          <ShimmerLine />
          <div style={{ marginBottom: '16px' }}>
            <span style={SECTION_LABEL}>Session Details</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Frequency pills — keep existing Tailwind classes */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>Repeat frequency</label>
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

            {/* Start date */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none' }}
              />
            </div>

            {/* Duration pills */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>Duration</label>
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
          </div>
        </div>

        {/* Exercise list glass card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          style={{ ...CARD, padding: 0 }}
        >
          <ShimmerLine />
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-elevated)' }}>
            <span style={SECTION_LABEL}>Exercises {exercises.length > 0 ? `(${exercises.length})` : ''}</span>
          </div>
          {exercises.length === 0 ? (
            <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--color-muted)' }}>No exercises added yet.</p>
          ) : (
            exercises.map((pe, i) => (
              <div
                key={pe.id}
                style={{ padding: '12px 20px', borderBottom: i < exercises.length - 1 ? '1px solid var(--color-elevated)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{pe.exercises.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      {pe.sets} sets × {pe.reps} reps{pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                    </div>
                    {pe.therapist_notes && (
                      <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px', fontStyle: 'italic' }}>{pe.therapist_notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeExercise(pe.id)}
                    style={{ fontSize: '12px', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
                {pe.exercises.video_url && <VideoPlayer url={pe.exercises.video_url} className="w-full rounded mt-2" />}
              </div>
            ))
          )}
        </motion.div>

        {/* ExercisePicker — unchanged */}
        <ExercisePicker onAdd={handleAddExercise} weightUnit={weightUnit} />
      </div>
    </SidebarLayout>
  )
}
