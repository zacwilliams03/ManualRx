import { useState, useEffect, Fragment } from 'react'
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
import { buildSessionItems } from '../../utils/supersetUtils'
import SupersetPickerModal from '../../components/therapist/SupersetPickerModal'

function computeNextOrderIndex(groups, exercises) {
  const maxGroup = groups.reduce((m, g) => Math.max(m, g.order_index ?? 0), 0)
  const maxEx = exercises
    .filter(pe => pe.group_id == null)
    .reduce((m, pe) => Math.max(m, pe.order_index ?? 0), 0)
  return Math.max(maxGroup, maxEx) + 1
}

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

  const [groups, setGroups] = useState([])
  const [items, setItems] = useState([])
  const [showSupersetModal, setShowSupersetModal] = useState(false)
  const [editingSuperset, setEditingSuperset] = useState(null)

  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [saveTemplateError, setSaveTemplateError] = useState(null)
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState(false)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [sessionId, profile?.id])

  async function fetchData() {
    setLoading(true)
    const [sessionRes, exercisesRes, groupsRes] = await Promise.all([
      supabase.from('prescriptions').select('id, name, frequency_days, start_date, duration_weeks').eq('id', sessionId).eq('therapist_id', profile.id).single(),
      supabase
        .from('prescription_exercises')
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
        .eq('prescription_id', sessionId),
      supabase
        .from('prescription_exercise_groups')
        .select('id, label, set_count, order_index, created_at')
        .eq('prescription_id', sessionId)
        .order('order_index', { ascending: true }),
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
      const fetchedExercises = exercisesRes.data ?? []
      const fetchedGroups = groupsRes.data ?? []
      setExercises(fetchedExercises)
      setGroups(fetchedGroups)
      setItems(buildSessionItems(fetchedGroups, fetchedExercises))
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

  async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral, tempoEccentric, tempoBottomPause, tempoConcentric, tempoTopPause, perSetSets }) {
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
        order_index: computeNextOrderIndex(groups, exercises),
      })
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      .single()
    if (insertError) throw new Error(insertError.message)

    if (perSetSets?.length > 0) {
      const { error: setsError } = await supabase.from('prescription_exercise_sets').insert(
        perSetSets.map(s => ({
          prescription_exercise_id: data.id,
          set_number: s.set_number,
          reps: s.reps,
          weight: s.weight ?? null,
        }))
      )
      if (setsError) throw new Error(setsError.message)
      const { data: fresh, error: freshError } = await supabase
        .from('prescription_exercises')
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
        .eq('id', data.id)
        .single()
      if (freshError || !fresh) throw new Error('Failed to refresh exercise after adding per-set rows.')
      setExercises(prev => {
        const next = [...prev, fresh]
        setItems(buildSessionItems(groups, next))
        return next
      })
    } else {
      setExercises(prev => {
        const next = [...prev, data]
        setItems(buildSessionItems(groups, next))
        return next
      })
    }
  }

  async function removeExercise(peId) {
    await supabase.from('prescription_exercises').delete().eq('id', peId)
    setExercises(prev => {
      const next = prev.filter(pe => pe.id !== peId)
      setItems(buildSessionItems(groups, next))
      return next
    })
  }

  function startEdit(pe) {
    setEditingId(pe.id)
    setSaveEditError(null)
    const perSetRows = pe.prescription_exercise_sets ?? []
    setEditValues({
      sets: String(pe.sets),
      reps: String(pe.reps ?? ''),
      groupId: pe.group_id ?? null,
      weight: pe.weight ? String(parseFloat(fromCanonical(pe.weight, weightUnit).toFixed(1))) : '',
      notes: pe.therapist_notes ?? '',
      tempoEnabled: pe.tempo_eccentric != null && pe.tempo_bottom_pause != null && pe.tempo_concentric != null && pe.tempo_top_pause != null,
      tempoDown: pe.tempo_eccentric != null ? String(pe.tempo_eccentric) : '',
      tempoHold: pe.tempo_bottom_pause != null ? String(pe.tempo_bottom_pause) : '',
      tempoUp: pe.tempo_concentric != null ? String(pe.tempo_concentric) : '',
      tempoTop: pe.tempo_top_pause != null ? String(pe.tempo_top_pause) : '',
      perSetEnabled: perSetRows.length > 0,
      perSetRows: perSetRows
        .slice().sort((a, b) => a.set_number - b.set_number)
        .map(s => ({
          reps: String(s.reps),
          weight: s.weight != null ? String(parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1))) : '',
        })),
    })
  }

  async function saveEdit(peId) {
    setSaveEditError(null)
    const v = editValues

    if (v.perSetEnabled) {
      if (!v.perSetRows?.length) { setSaveEditError('At least one set is required.'); return }
      const invalid = v.perSetRows.some(r => !r.reps || isNaN(parseInt(r.reps)) || parseInt(r.reps) < 1)
      if (invalid) { setSaveEditError('Per-set: each set must have reps ≥ 1.'); return }
    }

    if (v.tempoEnabled) {
      const e = parseInt(v.tempoDown), b = parseInt(v.tempoHold)
      const c = parseInt(v.tempoUp), t = parseInt(v.tempoTop)
      const valid =
        !isNaN(e) && !isNaN(b) && !isNaN(c) && !isNaN(t) &&
        e >= 1 && e <= 9 && c >= 1 && c <= 9 &&
        b >= 0 && b <= 9 && t >= 0 && t <= 9
      if (!valid) { setSaveEditError('Tempo: down and up must be 1–9; hold and top must be 0–9.'); return }
    }

    setSavingEdit(true)
    const setsCount = v.perSetEnabled ? v.perSetRows.length : (parseInt(v.sets) || 1)
    const weightVal = v.weight.trim() ? toCanonical(parseFloat(v.weight), weightUnit) : null

    // Update parent first — if this fails, child rows are untouched (no orphan state)
    const { error: updateError } = await supabase
      .from('prescription_exercises')
      .update({
        ...(v.groupId == null ? { sets: setsCount } : {}),
        reps: v.perSetEnabled ? null : (parseInt(v.reps) || 1),
        weight: v.perSetEnabled ? null : weightVal,
        therapist_notes: v.notes.trim() || null,
        tempo_eccentric:    v.tempoEnabled ? parseInt(v.tempoDown) : null,
        tempo_bottom_pause: v.tempoEnabled ? parseInt(v.tempoHold) : null,
        tempo_concentric:   v.tempoEnabled ? parseInt(v.tempoUp)   : null,
        tempo_top_pause:    v.tempoEnabled ? parseInt(v.tempoTop)   : null,
      })
      .eq('id', peId)
    if (updateError) { setSavingEdit(false); setSaveEditError(updateError.message || 'Failed to save.'); return }

    // Delete+reinsert child rows after parent is confirmed saved
    const { error: deleteError } = await supabase
      .from('prescription_exercise_sets')
      .delete()
      .eq('prescription_exercise_id', peId)
    if (deleteError) { setSavingEdit(false); setSaveEditError(deleteError.message); return }

    if (v.perSetEnabled) {
      const rows = v.perSetRows.map((r, i) => ({
        prescription_exercise_id: peId,
        set_number: i + 1,
        reps: parseInt(r.reps),
        weight: r.weight !== '' && r.weight != null ? toCanonical(parseFloat(r.weight), weightUnit) : null,
      }))
      const { error: insertError } = await supabase.from('prescription_exercise_sets').insert(rows)
      if (insertError) { setSavingEdit(false); setSaveEditError(insertError.message); return }
    }

    // Re-fetch to get clean canonical data with child rows (avoids manual unit conversion of local state)
    const { data: fresh, error: freshError } = await supabase
      .from('prescription_exercises')
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      .eq('id', peId)
      .single()

    setSavingEdit(false)
    if (freshError || !fresh) {
      setSaveEditError('Saved, but failed to refresh — please reload.')
      return
    }
    setExercises(prev => {
      const next = prev.map(e => e.id === peId ? fresh : e)
      setItems(buildSessionItems(groups, next))
      return next
    })
    setEditingId(null)
  }

  async function handleUngroup(group, members) {
    const memberIds = members.map(m => m.id)
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('id')
      .in('prescription_exercise_id', memberIds)
      .limit(1)
    if (logs?.length > 0) {
      alert('This superset has logged sessions. Ungroup is not available.')
      return
    }
    for (let i = 0; i < members.length; i++) {
      const { error: updateErr } = await supabase
        .from('prescription_exercises')
        .update({ group_id: null, position_in_group: null, order_index: group.order_index + i })
        .eq('id', members[i].id)
      if (updateErr) { alert('Failed to ungroup: ' + updateErr.message); return }
    }
    const { error: deleteErr } = await supabase.from('prescription_exercise_groups').delete().eq('id', group.id)
    if (deleteErr) { alert('Failed to remove superset: ' + deleteErr.message); return }
    const updatedExercises = exercises.map(pe => {
      if (pe.group_id === group.id) {
        const idx = members.findIndex(m => m.id === pe.id)
        return { ...pe, group_id: null, position_in_group: null, order_index: group.order_index + idx }
      }
      return pe
    })
    const updatedGroups = groups.filter(g => g.id !== group.id)
    setExercises(updatedExercises)
    setGroups(updatedGroups)
    setItems(buildSessionItems(updatedGroups, updatedExercises))
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    setSaveTemplateError(null)
    try {
      const { data: tmpl, error: tmplErr } = await supabase
        .from('templates')
        .insert({ therapist_id: profile.id, name: templateName.trim() })
        .select('id')
        .single()
      if (tmplErr) throw new Error(tmplErr.message)

      const groupIdMap = {}
      for (const g of groups) {
        const { data: tg, error: gErr } = await supabase
          .from('template_exercise_groups')
          .insert({
            template_id: tmpl.id,
            label: g.label,
            set_count: g.set_count,
            order_index: g.order_index,
          })
          .select('id')
          .single()
        if (gErr) throw new Error(gErr.message)
        groupIdMap[g.id] = tg.id
      }

      for (const pe of exercises) {
        const { data: te, error: exErr } = await supabase
          .from('template_exercises')
          .insert({
            template_id: tmpl.id,
            exercise_id: pe.exercises.id,
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
            group_id: pe.group_id ? (groupIdMap[pe.group_id] ?? null) : null,
            position_in_group: pe.position_in_group ?? null,
            order_index: pe.order_index ?? null,
          })
          .select('id')
          .single()
        if (exErr) throw new Error(exErr.message)
        const perSetRows = pe.prescription_exercise_sets ?? []
        if (perSetRows.length > 0) {
          const { error: setsErr } = await supabase.from('template_exercise_sets').insert(
            perSetRows.map(s => ({
              template_exercise_id: te.id,
              set_number: s.set_number,
              reps: s.reps,
              weight: s.weight ?? null,
            }))
          )
          if (setsErr) throw new Error(setsErr.message)
        }
      }

      setSaveTemplateSuccess(true)
      setTimeout(() => {
        setShowSaveAsTemplate(false)
        setSaveTemplateSuccess(false)
        setTemplateName('')
      }, 1200)
    } catch (e) {
      setSaveTemplateError(e.message || 'Failed to save template.')
    } finally {
      setSavingTemplate(false)
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

  function renderExerciseRow(pe, hasBorder) {
    return (
      <div
        key={pe.id}
        style={{ padding: '12px 20px', borderBottom: hasBorder ? '1px solid var(--color-elevated)' : 'none' }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>{pe.exercises.name}</div>
        {editingId === pe.id ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pe.group_id != null && (
              <div style={{ fontSize: '11px', color: 'var(--color-subtle)', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
                Set count is controlled by the superset ({pe.sets} sets). Edit the superset header to change it.
              </div>
            )}
            {!editValues.perSetEnabled && (
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
            )}
            <input
              type="text"
              value={editValues.notes}
              onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
              placeholder="Therapist notes (optional)"
              style={{ padding: '5px 8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '12px', outline: 'none' }}
            />
            {/* Per-set edit */}
            {pe.group_id == null && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editValues.perSetEnabled ? '6px' : 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: 500 }}>
                    Per-set weights & reps <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editValues.perSetEnabled) {
                        const n = Math.max(1, parseInt(editValues.sets) || 1)
                        setEditValues(v => ({
                          ...v,
                          perSetEnabled: true,
                          perSetRows: Array.from({ length: n }, () => ({ reps: v.reps, weight: v.weight })),
                        }))
                      } else {
                        setEditValues(v => ({ ...v, perSetEnabled: false }))
                      }
                    }}
                    style={{
                      width: '28px', height: '16px', borderRadius: '8px', border: 'none',
                      cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s',
                      background: editValues.perSetEnabled ? '#29B5CC' : 'var(--color-border)',
                    }}
                  >
                    <span style={{
                      display: 'block', width: '12px', height: '12px', borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: '2px', transition: 'left 0.15s',
                      left: editValues.perSetEnabled ? '14px' : '2px',
                    }} />
                  </button>
                </div>
                {editValues.perSetEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 20px', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', textAlign: 'center' }}>Set</span>
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', textAlign: 'center' }}>Reps</span>
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', textAlign: 'center' }}>Wt ({weightUnit})</span>
                      <span />
                    </div>
                    {(editValues.perSetRows ?? []).map((row, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 20px', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#29B5CC', textAlign: 'center', fontFamily: 'monospace' }}>{i + 1}</span>
                        <input
                          type="number" min="1" value={row.reps}
                          onChange={e => setEditValues(v => ({ ...v, perSetRows: v.perSetRows.map((r, j) => j === i ? { ...r, reps: e.target.value } : r) }))}
                          style={{ width: '100%', padding: '4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, outline: 'none', textAlign: 'center', colorScheme: 'dark', boxSizing: 'border-box' }}
                        />
                        <input
                          type="number" min="0" step="0.5" value={row.weight} placeholder="BW"
                          onChange={e => setEditValues(v => ({ ...v, perSetRows: v.perSetRows.map((r, j) => j === i ? { ...r, weight: e.target.value } : r) }))}
                          style={{ width: '100%', padding: '4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, outline: 'none', textAlign: 'center', colorScheme: 'dark', boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditValues(v => ({ ...v, perSetRows: v.perSetRows.length > 1 ? v.perSetRows.filter((_, j) => j !== i) : v.perSetRows }))}
                          style={{ fontSize: '12px', color: (editValues.perSetRows?.length ?? 0) > 1 ? 'var(--color-muted)' : 'var(--color-border)', background: 'none', border: 'none', cursor: (editValues.perSetRows?.length ?? 0) > 1 ? 'pointer' : 'default', padding: 0, textAlign: 'center' }}
                        >✕</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditValues(v => ({ ...v, perSetRows: [...(v.perSetRows ?? []), { reps: '', weight: '' }] }))}
                      style={{ fontSize: '11px', padding: '4px', background: 'rgba(41,181,204,0.08)', border: '1px dashed rgba(41,181,204,0.3)', color: '#29B5CC', borderRadius: '5px', cursor: 'pointer' }}
                    >+ Add set</button>
                  </div>
                )}
              </div>
            )}
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
                    <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>Eccentric</span>
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
                    <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>Concentric</span>
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
              {pe.prescription_exercise_sets?.length > 0 ? (
                <div style={{ marginTop: '2px' }}>
                  <div style={{ fontSize: '11px', color: '#29B5CC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Per-set · {pe.prescription_exercise_sets.length} sets
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr', gap: '2px 8px' }}>
                    {pe.prescription_exercise_sets
                      .slice().sort((a, b) => a.set_number - b.set_number)
                      .flatMap((s, i) => [
                        <span key={`${i}-n`} style={{ fontFamily: 'monospace', fontWeight: 700, color: '#29B5CC', fontSize: '11px' }}>{s.set_number}</span>,
                        <span key={`${i}-r`} style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{s.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}</span>,
                        <span key={`${i}-w`} style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>{s.weight != null ? formatWeight(s.weight, weightUnit) : 'Bodyweight'}</span>,
                      ])
                    }
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>
                  {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                  {pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                  {pe.bilateral ? ' · Both sides' : ''}
                </div>
              )}
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
    )
  }

  function renderSupersetBlock(item, hasBorder) {
    const { group, exercises: members } = item
    return (
      <div
        key={group.id}
        style={{ borderBottom: hasBorder ? '1px solid var(--color-elevated)' : 'none' }}
      >
        <div style={{ padding: '8px 14px', background: 'rgba(41,181,204,0.06)', borderBottom: '1px solid rgba(41,181,204,0.12)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#29B5CC', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
            ⚡ {group.label} · {group.set_count} sets
          </span>
          <button
            onClick={() => setEditingSuperset({ group, members })}
            style={{ fontSize: '11px', color: 'rgba(41,181,204,0.7)', background: 'none', border: '1px solid rgba(41,181,204,0.2)', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}
          >
            Edit
          </button>
          <button
            onClick={() => handleUngroup(group, members)}
            style={{ fontSize: '11px', color: 'var(--color-muted)', background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}
          >
            Ungroup
          </button>
        </div>
        {members.map((pe, mi) => (
          <div
            key={pe.id}
            style={{ padding: '10px 14px', borderBottom: mi < members.length - 1 ? '1px solid rgba(41,181,204,0.08)' : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
          >
            <div style={{ width: '3px', minHeight: '28px', background: '#29B5CC', borderRadius: '2px', opacity: 0.4, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              {renderExerciseRow(pe, false)}
            </div>
          </div>
        ))}
        <div style={{ padding: '8px 14px' }}>
          <span
            onClick={() => setEditingSuperset({ group, members })}
            style={{ fontSize: '12px', color: 'rgba(41,181,204,0.55)', cursor: 'pointer' }}
          >
            + Add exercise to superset
          </span>
        </div>
      </div>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => { setTemplateName(name); setShowSaveAsTemplate(true); setSaveTemplateError(null) }}
              style={{ padding: '9px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save as template
            </button>
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
          </div>
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
            <span style={SECTION_LABEL}>Exercises {items.length > 0 ? `(${items.length})` : ''}</span>
          </div>
          {items.length === 0 ? (
            <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--color-muted)' }}>No exercises added yet.</p>
          ) : (
            items.map((item, i) => (
              item.type === 'exercise'
                ? <Fragment key={item.ex.id}>{renderExerciseRow(item.ex, i < items.length - 1)}</Fragment>
                : <Fragment key={item.group.id}>{renderSupersetBlock(item, i < items.length - 1)}</Fragment>
            ))
          )}
        </motion.div>

        {(showSupersetModal || editingSuperset) && (
          <SupersetPickerModal
            prescriptionId={sessionId}
            existingGroupCount={groups.length}
            currentMaxOrderIndex={computeNextOrderIndex(groups, exercises) - 1}
            editGroup={editingSuperset?.group ?? null}
            editMembers={editingSuperset?.members ?? []}
            onAdd={(updatedGroup, newPeRows, removedPeIds = []) => {
              if (editingSuperset) {
                const updatedGroups = groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
                const updatedExercises = [
                  ...exercises.filter(pe => !removedPeIds.includes(pe.id)).map(pe =>
                    pe.group_id === updatedGroup.id ? { ...pe, sets: updatedGroup.set_count } : pe
                  ),
                  ...newPeRows,
                ]
                setGroups(updatedGroups)
                setExercises(updatedExercises)
                setItems(buildSessionItems(updatedGroups, updatedExercises))
                setEditingSuperset(null)
              } else {
                const updatedGroups = [...groups, updatedGroup]
                const updatedExercises = [...exercises, ...newPeRows]
                setGroups(updatedGroups)
                setExercises(updatedExercises)
                setItems(buildSessionItems(updatedGroups, updatedExercises))
                setShowSupersetModal(false)
              }
            }}
            onClose={() => { setShowSupersetModal(false); setEditingSuperset(null) }}
          />
        )}

        <button
          onClick={() => setShowSupersetModal(true)}
          style={{ width: '100%', padding: '10px', background: 'rgba(41,181,204,0.08)', border: '1px solid rgba(41,181,204,0.25)', borderRadius: '8px', color: '#29B5CC', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ⚡ Add superset
        </button>

        {/* ExercisePicker — unchanged */}
        <ExercisePicker onAdd={handleAddExercise} weightUnit={weightUnit} />
      </div>

      {showSaveAsTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowSaveAsTemplate(false); setSaveTemplateError(null) } }}
        >
          <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(41,181,204,0.25)', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '3px' }}>Save as template</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Creates a reusable template with all exercises{groups.length > 0 ? ' and supersets' : ''} from this session.</div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                Template name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) handleSaveAsTemplate() }}
                autoFocus
                style={{ width: '100%', padding: '9px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {saveTemplateError && <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: 0 }}>{saveTemplateError}</p>}
            {saveTemplateSuccess && <p style={{ fontSize: '12px', color: '#29B5CC', margin: 0 }}>Template saved!</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowSaveAsTemplate(false); setSaveTemplateError(null) }} style={{ flex: 1, padding: '10px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate || !templateName.trim()}
                style={{ flex: 2, padding: '10px', background: (savingTemplate || !templateName.trim()) ? 'rgba(41,181,204,0.3)' : '#29B5CC', color: (savingTemplate || !templateName.trim()) ? '#555' : '#000', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: (savingTemplate || !templateName.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >
                {savingTemplate ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
