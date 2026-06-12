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
    .filter(te => te.group_id == null)
    .reduce((m, te) => Math.max(m, te.order_index ?? 0), 0)
  return Math.max(maxGroup, maxEx) + 1
}

export default function TemplateEdit() {
  const { templateId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const backTo = searchParams.get('backTo')
  const weightUnit = useWeightUnit()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exercises, setExercises] = useState([])

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(null)
  const [customWeeks, setCustomWeeks] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingCategories, setExistingCategories] = useState([])

  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveEditError, setSaveEditError] = useState(null)

  const [groups, setGroups] = useState([])
  const [items, setItems] = useState([])
  const [showSupersetModal, setShowSupersetModal] = useState(false)
  const [editingSuperset, setEditingSuperset] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [templateId, profile?.id])

  async function fetchData() {
    setLoading(true)
    const [templateRes, exercisesRes, groupsRes, allTemplatesRes] = await Promise.all([
      supabase.from('templates').select('id, name, category, duration_weeks').eq('id', templateId).single(),
      supabase
        .from('template_exercises')
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, rest_seconds, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
        .eq('template_id', templateId),
      supabase
        .from('template_exercise_groups')
        .select('id, label, set_count, order_index, created_at, rest_seconds')
        .eq('template_id', templateId)
        .order('order_index', { ascending: true }),
      supabase
        .from('templates')
        .select('category')
        .eq('therapist_id', profile.id)
        .not('category', 'is', null),
    ])

    if (templateRes.error) { setError('Template not found.'); setLoading(false); return }
    const data = templateRes.data
    setName(data.name)
    setCategory(data.category ?? '')

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

    const cats = [...new Set((allTemplatesRes.data ?? []).map(t => t.category).filter(Boolean))].sort()
    setExistingCategories(cats)

    setLoading(false)
  }

  async function saveMeta() {
    if (editingId) {
      const ok = await saveEdit(editingId)
      if (!ok) return
    }
    setSaving(true)
    const dw = durationWeeks === 'custom' ? parseInt(customWeeks) || null : durationWeeks
    await supabase
      .from('templates')
      .update({ name, category: category.trim() || null, duration_weeks: dw })
      .eq('id', templateId)
    setSaving(false)
    navigate('/therapist/templates')
  }

  async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral, tempoEccentric, tempoBottomPause, tempoConcentric, tempoTopPause, perSetSets, restSeconds }) {
    const { data, error: insertError } = await supabase
      .from('template_exercises')
      .insert({
        template_id: templateId,
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
        rest_seconds: restSeconds ?? null,
        order_index: computeNextOrderIndex(groups, exercises),
      })
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, rest_seconds, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      .single()
    if (insertError) throw new Error(insertError.message)

    if (perSetSets?.length > 0) {
      const { error: setsError } = await supabase.from('template_exercise_sets').insert(
        perSetSets.map(s => ({
          template_exercise_id: data.id,
          set_number: s.set_number,
          reps: s.reps,
          weight: s.weight ?? null,
        }))
      )
      if (setsError) throw new Error(setsError.message)
      const { data: fresh, error: freshError } = await supabase
        .from('template_exercises')
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, rest_seconds, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
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

  async function removeExercise(teId) {
    await supabase.from('template_exercises').delete().eq('id', teId)
    setExercises(prev => {
      const next = prev.filter(e => e.id !== teId)
      setItems(buildSessionItems(groups, next))
      return next
    })
  }

  function startEdit(te) {
    setEditingId(te.id)
    setSaveEditError(null)
    const perSetRows = te.template_exercise_sets ?? []
    setEditValues({
      sets: String(te.sets),
      reps: String(te.reps ?? ''),
      groupId: te.group_id ?? null,
      weight: te.weight ? String(parseFloat(fromCanonical(te.weight, weightUnit).toFixed(1))) : '',
      notes: te.therapist_notes ?? '',
      tempoEnabled: te.tempo_eccentric != null && te.tempo_bottom_pause != null && te.tempo_concentric != null && te.tempo_top_pause != null,
      tempoDown: te.tempo_eccentric != null ? String(te.tempo_eccentric) : '',
      tempoHold: te.tempo_bottom_pause != null ? String(te.tempo_bottom_pause) : '',
      tempoUp: te.tempo_concentric != null ? String(te.tempo_concentric) : '',
      tempoTop: te.tempo_top_pause != null ? String(te.tempo_top_pause) : '',
      restSeconds: te.rest_seconds != null ? String(te.rest_seconds) : '',
      measurementType: te.measurement_type ?? 'reps',
      perSetEnabled: perSetRows.length > 0,
      perSetRows: perSetRows
        .slice().sort((a, b) => a.set_number - b.set_number)
        .map(s => ({
          reps: String(s.reps),
          weight: s.weight != null ? String(parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1))) : '',
        })),
    })
  }

  async function saveEdit(teId) {
    setSaveEditError(null)
    const v = editValues

    if (v.perSetEnabled) {
      if (!v.perSetRows?.length) { setSaveEditError('At least one set is required.'); return false }
      const invalid = v.perSetRows.some(r => !r.reps || isNaN(parseInt(r.reps)) || parseInt(r.reps) < 1)
      if (invalid) { setSaveEditError('Per-set: each set must have reps ≥ 1.'); return false }
    }

    if (v.tempoEnabled) {
      const e = parseInt(v.tempoDown), b = parseInt(v.tempoHold)
      const c = parseInt(v.tempoUp), t = parseInt(v.tempoTop)
      const valid =
        !isNaN(e) && !isNaN(b) && !isNaN(c) && !isNaN(t) &&
        e >= 1 && e <= 9 && c >= 1 && c <= 9 &&
        b >= 0 && b <= 9 && t >= 0 && t <= 9
      if (!valid) { setSaveEditError('Tempo: down and up must be 1–9; hold and top must be 0–9.'); return false }
    }

    setSavingEdit(true)
    const setsCount = v.perSetEnabled ? v.perSetRows.length : (parseInt(v.sets) || 1)
    const weightVal = v.weight.trim() ? toCanonical(parseFloat(v.weight), weightUnit) : null

    const { error: updateError } = await supabase
      .from('template_exercises')
      .update({
        ...(v.groupId == null ? { sets: setsCount } : {}),
        reps: v.perSetEnabled ? null : (parseInt(v.reps) || 1),
        weight: v.perSetEnabled ? null : weightVal,
        therapist_notes: v.notes.trim() || null,
        measurement_type: v.measurementType ?? 'reps',
        tempo_eccentric:    v.tempoEnabled ? parseInt(v.tempoDown) : null,
        tempo_bottom_pause: v.tempoEnabled ? parseInt(v.tempoHold) : null,
        tempo_concentric:   v.tempoEnabled ? parseInt(v.tempoUp)   : null,
        tempo_top_pause:    v.tempoEnabled ? parseInt(v.tempoTop)   : null,
        rest_seconds: v.restSeconds !== '' && parseInt(v.restSeconds) > 0
          ? parseInt(v.restSeconds)
          : null,
      })
      .eq('id', teId)
    if (updateError) { setSavingEdit(false); setSaveEditError(updateError.message || 'Failed to save.'); return false }

    const { error: deleteError } = await supabase
      .from('template_exercise_sets')
      .delete()
      .eq('template_exercise_id', teId)
    if (deleteError) { setSavingEdit(false); setSaveEditError(deleteError.message); return false }

    if (v.perSetEnabled) {
      const rows = v.perSetRows.map((r, i) => ({
        template_exercise_id: teId,
        set_number: i + 1,
        reps: parseInt(r.reps),
        weight: r.weight !== '' && r.weight != null ? toCanonical(parseFloat(r.weight), weightUnit) : null,
      }))
      const { error: insertError } = await supabase.from('template_exercise_sets').insert(rows)
      if (insertError) { setSavingEdit(false); setSaveEditError(insertError.message); return false }
    }

    const { data: fresh, error: freshError } = await supabase
      .from('template_exercises')
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, rest_seconds, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      .eq('id', teId)
      .single()

    setSavingEdit(false)
    if (freshError || !fresh) {
      setSaveEditError('Saved, but failed to refresh — please reload.')
      return false
    }
    setExercises(prev => {
      const next = prev.map(e => e.id === teId ? fresh : e)
      setItems(buildSessionItems(groups, next))
      return next
    })
    setEditingId(null)
    return true
  }

  async function handleUngroup(group, members) {
    for (let i = 0; i < members.length; i++) {
      const { error: updateErr } = await supabase
        .from('template_exercises')
        .update({ group_id: null, position_in_group: null, order_index: group.order_index + i })
        .eq('id', members[i].id)
      if (updateErr) { alert('Failed to ungroup: ' + updateErr.message); return }
    }
    const { error: deleteErr } = await supabase.from('template_exercise_groups').delete().eq('id', group.id)
    if (deleteErr) { alert('Failed to remove superset: ' + deleteErr.message); return }
    const updatedExercises = exercises.map(te => {
      if (te.group_id === group.id) {
        const idx = members.findIndex(m => m.id === te.id)
        return { ...te, group_id: null, position_in_group: null, order_index: group.order_index + idx }
      }
      return te
    })
    const updatedGroups = groups.filter(g => g.id !== group.id)
    setExercises(updatedExercises)
    setGroups(updatedGroups)
    setItems(buildSessionItems(updatedGroups, updatedExercises))
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
          <Link to="/therapist/templates" className="mt-2 inline-block text-sm text-dark-accent hover:underline">
            Back to templates
          </Link>
        </div>
      </SidebarLayout>
    )
  }

  function renderExerciseRow(te, hasBorder) {
    return (
      <div
        key={te.id}
        style={{ padding: '12px 20px', borderBottom: hasBorder ? '1px solid var(--color-elevated)' : 'none' }}
      >
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>{te.exercises?.name}</div>
        {editingId === te.id ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {te.group_id != null && (
              <div style={{ fontSize: '11px', color: 'var(--color-subtle)', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
                Set count is controlled by the superset ({te.sets} sets). Edit the superset header to change it.
              </div>
            )}
            {/* Measurement type toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Type</span>
              <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                {['reps', 'seconds'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditValues(v => ({ ...v, measurementType: type }))}
                    style={{
                      padding: '4px 10px', fontSize: '11px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: (editValues.measurementType ?? 'reps') === type ? '#29B5CC' : 'var(--color-elevated)',
                      color: (editValues.measurementType ?? 'reps') === type ? '#000' : 'var(--color-muted)',
                      fontWeight: (editValues.measurementType ?? 'reps') === type ? 700 : 400,
                    }}
                  >
                    {type === 'reps' ? 'Reps' : 'Seconds'}
                  </button>
                ))}
              </div>
            </div>
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
                  {(editValues.measurementType ?? 'reps') === 'seconds' ? 'Seconds' : 'Reps'}
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
            {/* Per-set */}
            {te.group_id == null && (
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
                        setEditValues(v => ({ ...v, perSetEnabled: true, perSetRows: Array.from({ length: n }, () => ({ reps: v.reps, weight: v.weight })) }))
                      } else {
                        setEditValues(v => ({ ...v, perSetEnabled: false }))
                      }
                    }}
                    style={{ width: '28px', height: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s', background: editValues.perSetEnabled ? '#29B5CC' : 'var(--color-border)' }}
                  >
                    <span style={{ display: 'block', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', transition: 'left 0.15s', left: editValues.perSetEnabled ? '14px' : '2px' }} />
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
                        <input type="number" min="1" value={row.reps}
                          onChange={e => setEditValues(v => ({ ...v, perSetRows: v.perSetRows.map((r, j) => j === i ? { ...r, reps: e.target.value } : r) }))}
                          style={{ width: '100%', padding: '4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, outline: 'none', textAlign: 'center', colorScheme: 'dark', boxSizing: 'border-box' }}
                        />
                        <input type="number" min="0" step="0.5" value={row.weight} placeholder="BW"
                          onChange={e => setEditValues(v => ({ ...v, perSetRows: v.perSetRows.map((r, j) => j === i ? { ...r, weight: e.target.value } : r) }))}
                          style={{ width: '100%', padding: '4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, outline: 'none', textAlign: 'center', colorScheme: 'dark', boxSizing: 'border-box' }}
                        />
                        <button type="button"
                          onClick={() => setEditValues(v => ({ ...v, perSetRows: v.perSetRows.length > 1 ? v.perSetRows.filter((_, j) => j !== i) : v.perSetRows }))}
                          style={{ fontSize: '12px', color: (editValues.perSetRows?.length ?? 0) > 1 ? 'var(--color-muted)' : 'var(--color-border)', background: 'none', border: 'none', cursor: (editValues.perSetRows?.length ?? 0) > 1 ? 'pointer' : 'default', padding: 0, textAlign: 'center' }}
                        >✕</button>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setEditValues(v => ({ ...v, perSetRows: [...(v.perSetRows ?? []), { reps: '', weight: '' }] }))}
                      style={{ fontSize: '11px', padding: '4px', background: 'rgba(41,181,204,0.08)', border: '1px dashed rgba(41,181,204,0.3)', color: '#29B5CC', borderRadius: '5px', cursor: 'pointer' }}
                    >+ Add set</button>
                  </div>
                )}
              </div>
            )}
            {/* Tempo */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editValues.tempoEnabled ? '6px' : 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: 500 }}>Tempo <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span></span>
                <button type="button"
                  onClick={() => { setSaveEditError(null); setEditValues(v => ({ ...v, tempoEnabled: !v.tempoEnabled })) }}
                  style={{ width: '28px', height: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s', background: editValues.tempoEnabled ? '#29B5CC' : 'var(--color-border)' }}
                >
                  <span style={{ display: 'block', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', transition: 'left 0.15s', left: editValues.tempoEnabled ? '14px' : '2px' }} />
                </button>
              </div>
              {editValues.tempoEnabled && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                  {[['tempoDown', 'Eccentric', 1], ['tempoHold', 'Hold', 0], ['tempoUp', 'Concentric', 1], ['tempoTop', 'Top', 0]].map(([key, label, min], idx, arr) => (
                    <Fragment key={key}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <input type="number" min={min} max={9} value={editValues[key] ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, [key]: e.target.value }))}
                          style={{ width: '100%', padding: '5px 4px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, outline: 'none', textAlign: 'center', colorScheme: 'dark' }} />
                        <span style={{ fontSize: '8px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>{label}</span>
                      </div>
                      {idx < arr.length - 1 && <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '14px' }}>—</span>}
                    </Fragment>
                  ))}
                </div>
              )}
              {saveEditError && <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: '4px 0 0' }}>{saveEditError}</p>}
            </div>
            {/* Rest */}
            {te.group_id == null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', flex: 1 }}>
                  Rest between sets <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input type="number" min="0" step="5"
                    value={editValues.restSeconds ?? ''}
                    onChange={e => setEditValues(v => ({ ...v, restSeconds: e.target.value }))}
                    placeholder="—"
                    style={{ width: '64px', padding: '5px 8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', colorScheme: 'dark', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>sec</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => saveEdit(te.id)} disabled={savingEdit}
                style={{ fontSize: '12px', padding: '4px 12px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingId(null)}
                style={{ fontSize: '12px', padding: '4px 10px', background: 'none', color: 'var(--color-muted)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => removeExercise(te.id)}
                style={{ fontSize: '12px', padding: '4px 10px', background: 'none', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              {te.template_exercise_sets?.length > 0 ? (
                <div style={{ marginTop: '2px' }}>
                  <div style={{ fontSize: '11px', color: '#29B5CC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Per-set · {te.template_exercise_sets.length} sets
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr', gap: '2px 8px' }}>
                    {te.template_exercise_sets
                      .slice().sort((a, b) => a.set_number - b.set_number)
                      .flatMap((s, i) => [
                        <span key={`${i}-n`} style={{ fontFamily: 'monospace', fontWeight: 700, color: '#29B5CC', fontSize: '11px' }}>{s.set_number}</span>,
                        <span key={`${i}-r`} style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{s.reps} {te.measurement_type === 'seconds' ? 'sec' : 'reps'}</span>,
                        <span key={`${i}-w`} style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>{s.weight != null ? formatWeight(s.weight, weightUnit) : 'Bodyweight'}</span>,
                      ])
                    }
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                    {te.sets} sets × {te.reps} {te.measurement_type === 'seconds' ? 'sec' : 'reps'}
                    {te.weight ? ` · ${formatWeight(te.weight, weightUnit)}` : ''}
                    {te.bilateral ? ' · Both sides' : ''}
                  </div>
                  {(() => {
                    const t = formatTempo(te.tempo_eccentric, te.tempo_bottom_pause, te.tempo_concentric, te.tempo_top_pause)
                    return t ? (
                      <span style={{ display: 'inline-block', marginTop: '3px', background: 'rgba(41,181,204,0.1)', border: '1px solid rgba(41,181,204,0.2)', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', color: '#29B5CC', fontFamily: 'monospace', fontWeight: 600 }}>
                        ⏱ {t.compact}
                      </span>
                    ) : null
                  })()}
                </>
              )}
              {te.therapist_notes && (
                <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px', fontStyle: 'italic' }}>{te.therapist_notes}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={() => startEdit(te)}
                style={{ fontSize: '12px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => removeExercise(te.id)}
                style={{ fontSize: '12px', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>
        )}
        {te.exercises?.video_url && <VideoPlayer url={te.exercises.video_url} className="w-full rounded mt-2" />}
      </div>
    )
  }

  function renderSupersetBlock(item, hasBorder) {
    const { group, exercises: members } = item
    return (
      <div
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
        {members.map((te, mi) => (
          <div
            key={te.id}
            style={{ padding: '10px 14px', borderBottom: mi < members.length - 1 ? '1px solid rgba(41,181,204,0.08)' : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
          >
            <div style={{ width: '3px', minHeight: '28px', background: '#29B5CC', borderRadius: '2px', opacity: 0.4, flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              {renderExerciseRow(te, false)}
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

  return (
    <SidebarLayout>
      <PageHero
        title={name || 'Edit Template'}
        back={{ label: backTo ? 'Program Template' : 'Templates', to: backTo ?? '/therapist/templates' }}
        actions={
          <button
            onClick={saveMeta}
            disabled={saving || !name.trim()}
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: (saving || !name.trim()) ? 'default' : 'pointer',
              opacity: (saving || !name.trim()) ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />

      <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Template details glass card */}
        <div style={{ ...CARD }}>
          <ShimmerLine />
          <div style={{ marginBottom: '16px' }}>
            <span style={SECTION_LABEL}>Template Details</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Category */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                Category <span style={{ color: 'var(--color-subtle)' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Rotator Cuff"
                list="template-categories"
                style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
              <datalist id="template-categories">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Duration pills */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>
                Duration <span style={{ color: 'var(--color-subtle)' }}>(optional default)</span>
              </label>
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
                    className={`rounded-full px-3 py-1 text-sm cursor-pointer transition-colors duration-150 ${
                      durationWeeks === opt.value
                        ? 'bg-brand-primary text-white'
                        : 'bg-dark-elevated border border-dark-border text-dark-muted hover:text-dark-text'
                    }`}
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
            mode="template"
            parentId={templateId}
            existingGroupCount={groups.length}
            currentMaxOrderIndex={computeNextOrderIndex(groups, exercises) - 1}
            editGroup={editingSuperset?.group ?? null}
            editMembers={editingSuperset?.members ?? []}
            onAdd={(updatedGroup, newTeRows, removedTeIds = []) => {
              if (editingSuperset) {
                const updatedGroups = groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
                const updatedExercises = [
                  ...exercises.filter(te => !removedTeIds.includes(te.id)).map(te =>
                    te.group_id === updatedGroup.id ? { ...te, sets: updatedGroup.set_count } : te
                  ),
                  ...newTeRows,
                ]
                setGroups(updatedGroups)
                setExercises(updatedExercises)
                setItems(buildSessionItems(updatedGroups, updatedExercises))
                setEditingSuperset(null)
              } else {
                const updatedGroups = [...groups, updatedGroup]
                const updatedExercises = [...exercises, ...newTeRows]
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

        <ExercisePicker onAdd={handleAddExercise} weightUnit={weightUnit} confirmLabel="Add to template" />
      </div>
    </SidebarLayout>
  )
}
