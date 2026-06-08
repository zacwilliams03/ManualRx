import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ExercisePicker from '../../components/therapist/ExercisePicker'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight, fromCanonical, toCanonical } from '../../utils/weightUtils'
import { formatTempo } from '../../utils/formatTempo'
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SECTION_LABEL } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import VideoPlayer from '../../components/VideoPlayer'
import useIsMobile from '../../hooks/useIsMobile'

export default function SessionEdit() {
  const { clientId, sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const programId = searchParams.get('programId')
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
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveEditError, setSaveEditError] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [sessionId, profile?.id])

  async function fetchData() {
    setLoading(true)
    const [sessionRes, exercisesRes] = await Promise.all([
      supabase.from('prescriptions').select('id, name, frequency_days, start_date, duration_weeks').eq('id', sessionId).single(),
      supabase
        .from('prescription_exercises')
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
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
    navigate(programId
      ? `/therapist/prescribe/${clientId}/programs/${programId}`
      : `/therapist/prescribe/${clientId}`)
  }

  async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral, tempoEccentric, tempoBottomPause, tempoConcentric, tempoTopPause }) {
    const { data, error: insertError } = await supabase
      .from('prescription_exercises')
      .insert({
        prescription_id: sessionId,
        exercise_id: exerciseId,
        sets,
        reps,
        weight,
        therapist_notes: notes,
        measurement_type: measurementType ?? 'reps',
        bilateral: bilateral ?? false,
        tempo_eccentric:    tempoEccentric    ?? null,
        tempo_bottom_pause: tempoBottomPause  ?? null,
        tempo_concentric:   tempoConcentric   ?? null,
        tempo_top_pause:    tempoTopPause     ?? null,
      })
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
      .single()
    if (insertError) throw new Error(insertError.message)
    setExercises(prev => [...prev, data])
  }

  async function removeExercise(peId) {
    await supabase.from('prescription_exercises').delete().eq('id', peId)
    setExercises(prev => prev.filter(e => e.id !== peId))
  }

  function startEdit(pe) {
    setEditingId(pe.id)
    setSaveEditError(null)
    setEditValues({
      sets: String(pe.sets),
      reps: String(pe.reps),
      weight: pe.weight ? String(fromCanonical(pe.weight, weightUnit)) : '',
      notes: pe.therapist_notes ?? '',
      tempoEnabled: pe.tempo_eccentric != null && pe.tempo_bottom_pause != null && pe.tempo_concentric != null && pe.tempo_top_pause != null,
      tempoDown: pe.tempo_eccentric != null ? String(pe.tempo_eccentric) : '',
      tempoHold: pe.tempo_bottom_pause != null ? String(pe.tempo_bottom_pause) : '',
      tempoUp: pe.tempo_concentric != null ? String(pe.tempo_concentric) : '',
      tempoTop: pe.tempo_top_pause != null ? String(pe.tempo_top_pause) : '',
    })
  }

  async function saveEdit(peId) {
    setSaveEditError(null)
    const v = editValues

    if (v.tempoEnabled) {
      const e = parseInt(v.tempoDown), b = parseInt(v.tempoHold)
      const c = parseInt(v.tempoUp), t = parseInt(v.tempoTop)
      const valid =
        !isNaN(e) && !isNaN(b) && !isNaN(c) && !isNaN(t) &&
        e >= 1 && e <= 9 && c >= 1 && c <= 9 &&
        b >= 0 && b <= 9 && t >= 0 && t <= 9
      if (!valid) {
        setSaveEditError('Tempo: down and up must be 1–9; hold and top must be 0–9.')
        return
      }
    }

    setSavingEdit(true)
    const weightVal = v.weight.trim() ? toCanonical(parseFloat(v.weight), weightUnit) : null
    const { data, error: updateError } = await supabase
      .from('prescription_exercises')
      .update({
        sets: parseInt(v.sets) || 1,
        reps: parseInt(v.reps) || 1,
        weight: weightVal,
        therapist_notes: v.notes.trim() || null,
        tempo_eccentric:    v.tempoEnabled ? parseInt(v.tempoDown) : null,
        tempo_bottom_pause: v.tempoEnabled ? parseInt(v.tempoHold) : null,
        tempo_concentric:   v.tempoEnabled ? parseInt(v.tempoUp)   : null,
        tempo_top_pause:    v.tempoEnabled ? parseInt(v.tempoTop)   : null,
      })
      .eq('id', peId)
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
      .single()
    setSavingEdit(false)
    if (updateError) {
      setSaveEditError(updateError.message || 'Failed to save.')
    } else {
      setExercises(prev => prev.map(e => e.id === peId ? data : e))
      setEditingId(null)
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
        back={{
          label: programId ? 'Program' : 'Prescribe',
          to: programId
            ? `/therapist/prescribe/${clientId}/programs/${programId}`
            : `/therapist/prescribe/${clientId}`
        }}
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
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>{pe.exercises.name}</div>
                {editingId === pe.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--color-muted)' }}>
                        Sets
                        <input
                          type="number" min="1"
                          value={editValues.sets}
                          onChange={e => setEditValues(v => ({ ...v, sets: e.target.value }))}
                          style={{ width: '60px', padding: '5px 8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--color-muted)' }}>
                        {pe.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}
                        <input
                          type="number" min="1"
                          value={editValues.reps}
                          onChange={e => setEditValues(v => ({ ...v, reps: e.target.value }))}
                          style={{ width: '70px', padding: '5px 8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--color-muted)' }}>
                        Weight ({weightUnit})
                        <input
                          type="number" min="0" step="0.5"
                          value={editValues.weight}
                          onChange={e => setEditValues(v => ({ ...v, weight: e.target.value }))}
                          placeholder="—"
                          style={{ width: '80px', padding: '5px 8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }}
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editValues.notes}
                      onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                      placeholder="Therapist notes (optional)"
                      style={{ padding: '5px 8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '12px', outline: 'none' }}
                    />
                    {/* Tempo edit */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editValues.tempoEnabled ? '6px' : 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: 500 }}>
                          Tempo <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setSaveEditError(null); setEditValues(v => ({ ...v, tempoEnabled: !v.tempoEnabled })) }}
                          style={{
                            width: '28px', height: '16px', borderRadius: '8px', border: 'none',
                            cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s',
                            background: editValues.tempoEnabled ? '#29B5CC' : 'var(--color-border)',
                          }}
                        >
                          <span style={{
                            display: 'block', width: '12px', height: '12px', borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: '2px', transition: 'left 0.15s',
                            left: editValues.tempoEnabled ? '14px' : '2px',
                          }} />
                        </button>
                      </div>
                      {editValues.tempoEnabled && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <input type="number" min={1} max={9} value={editValues.tempoDown ?? ''} onChange={e => setEditValues(v => ({ ...v, tempoDown: e.target.value }))}
                              style={{ width: '100%', padding: '5px 4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, outline: 'none', textAlign: 'center', colorScheme: 'dark' }} />
                            <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>DOWN</span>
                          </div>
                          <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '14px' }}>—</span>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <input type="number" min={0} max={9} value={editValues.tempoHold ?? ''} onChange={e => setEditValues(v => ({ ...v, tempoHold: e.target.value }))}
                              style={{ width: '100%', padding: '5px 4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, outline: 'none', textAlign: 'center', colorScheme: 'dark' }} />
                            <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>HOLD</span>
                          </div>
                          <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '14px' }}>—</span>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <input type="number" min={1} max={9} value={editValues.tempoUp ?? ''} onChange={e => setEditValues(v => ({ ...v, tempoUp: e.target.value }))}
                              style={{ width: '100%', padding: '5px 4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, outline: 'none', textAlign: 'center', colorScheme: 'dark' }} />
                            <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>UP</span>
                          </div>
                          <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '14px' }}>—</span>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <input type="number" min={0} max={9} value={editValues.tempoTop ?? ''} onChange={e => setEditValues(v => ({ ...v, tempoTop: e.target.value }))}
                              style={{ width: '100%', padding: '5px 4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, outline: 'none', textAlign: 'center', colorScheme: 'dark' }} />
                            <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>TOP</span>
                          </div>
                        </div>
                      )}
                      {saveEditError && <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: '4px 0 0' }}>{saveEditError}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => saveEdit(pe.id)}
                        disabled={savingEdit}
                        style={{ fontSize: '12px', padding: '4px 12px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ fontSize: '12px', padding: '4px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => removeExercise(pe.id)}
                        style={{ fontSize: '12px', padding: '4px 10px', background: 'none', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>
                        {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                        {pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                        {pe.bilateral ? ' · Both sides' : ''}
                      </div>
                      {(() => {
                        const t = formatTempo(pe.tempo_eccentric, pe.tempo_bottom_pause, pe.tempo_concentric, pe.tempo_top_pause)
                        return t ? (
                          <span style={{ display: 'inline-block', marginTop: '3px', background: 'rgba(41,181,204,0.1)', border: '1px solid rgba(41,181,204,0.2)', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', color: '#29B5CC', fontFamily: 'monospace', fontWeight: 600 }}>
                            ⏱ {t.compact}
                          </span>
                        ) : null
                      })()}
                      {pe.therapist_notes && (
                        <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px', fontStyle: 'italic' }}>{pe.therapist_notes}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(pe)}
                        style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeExercise(pe.id)}
                        style={{ fontSize: '12px', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
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
