import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { fromCanonical, toCanonical } from '../../utils/weightUtils'

// mode: 'prescription' (default) | 'template'
// parentId: the prescription_id or template_id
// prescriptionId: legacy alias for parentId (prescription mode only)
export default function SupersetPickerModal({
  prescriptionId,
  parentId: parentIdProp,
  mode = 'prescription',
  existingGroupCount,
  currentMaxOrderIndex,
  onAdd,
  onClose,
  editGroup = null,
  editMembers = [],
}) {
  const parentId = parentIdProp ?? prescriptionId

  const groupTable    = mode === 'template' ? 'template_exercise_groups'    : 'prescription_exercise_groups'
  const exerciseTable = mode === 'template' ? 'template_exercises'           : 'prescription_exercises'
  const parentField   = mode === 'template' ? 'template_id'                  : 'prescription_id'
  const setsFk        = mode === 'template' ? 'template_exercise_sets'       : 'prescription_exercise_sets'
  const exSelect      = `id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, ${setsFk}(id, set_number, reps, weight), exercises(id, name, category, video_url)`

  const { profile } = useAuth()
  const weightUnit = useWeightUnit()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(() =>
    editMembers.map(em => em.exercises).filter(Boolean)
  )

  const [bilateralMap, setBilateralMap] = useState(() => {
    const map = {}
    for (const em of editMembers) {
      if (em.exercises?.id) map[em.exercises.id] = em.bilateral ?? false
    }
    return map
  })

  const [measurementTypeMap, setMeasurementTypeMap] = useState(() => {
    const map = {}
    for (const em of editMembers) {
      if (em.exercises?.id) map[em.exercises.id] = em.measurement_type ?? 'reps'
    }
    return map
  })

  const [repsMap, setRepsMap] = useState(() => {
    const map = {}
    for (const em of editMembers) {
      if (em.exercises?.id) map[em.exercises.id] = em.reps != null ? String(em.reps) : '10'
    }
    return map
  })

  const [weightMap, setWeightMap] = useState(() => {
    const map = {}
    for (const em of editMembers) {
      if (em.exercises?.id) map[em.exercises.id] = ''
    }
    return map
  })

  // Re-initialize weight display values once weightUnit resolves
  useEffect(() => {
    if (!weightUnit || editMembers.length === 0) return
    setWeightMap(() => {
      const map = {}
      for (const em of editMembers) {
        if (em.exercises?.id) {
          map[em.exercises.id] = em.weight != null
            ? String(parseFloat(fromCanonical(em.weight, weightUnit).toFixed(1)))
            : ''
        }
      }
      return map
    })
  }, [weightUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  const [setCount, setSetCount] = useState(editGroup?.set_count ?? 3)
  const [saving, setSaving] = useState(false)
  const [restSeconds, setRestSeconds] = useState(
    editGroup?.rest_seconds != null ? String(editGroup.rest_seconds) : ''
  )
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('exercises')
        .select('id, name, category, default_reps, default_sets')
        .or(`is_custom.eq.false,created_by.eq.${profile.id}`)
        .ilike('name', `%${q}%`)
        .order('name', { ascending: true })
        .limit(20)
      setResults(data ?? [])
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [query, profile.id])

  function isSelected(id) { return selected.some(e => e.id === id) }

  function toggleExercise(exercise) {
    if (isSelected(exercise.id)) {
      setSelected(prev => prev.filter(e => e.id !== exercise.id))
      setBilateralMap(prev => { const next = { ...prev }; delete next[exercise.id]; return next })
      setMeasurementTypeMap(prev => { const next = { ...prev }; delete next[exercise.id]; return next })
      setRepsMap(prev => { const next = { ...prev }; delete next[exercise.id]; return next })
      setWeightMap(prev => { const next = { ...prev }; delete next[exercise.id]; return next })
    } else {
      setSelected(prev => [...prev, exercise])
      setBilateralMap(prev => ({ ...prev, [exercise.id]: false }))
      setMeasurementTypeMap(prev => ({ ...prev, [exercise.id]: 'reps' }))
      setRepsMap(prev => ({ ...prev, [exercise.id]: String(exercise.default_reps ?? 10) }))
      setWeightMap(prev => ({ ...prev, [exercise.id]: '' }))
      setQuery('')
      setResults([])
    }
  }

  function toggleBilateral(exId) {
    setBilateralMap(prev => ({ ...prev, [exId]: !prev[exId] }))
  }

  async function handleConfirm() {
    if (selected.length < 2) return
    setSaving(true)
    setError(null)
    try {
      if (editGroup) {
        await handleEdit()
      } else {
        await handleCreate()
      }
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function handleCreate() {
    const label = getLetter(existingGroupCount)
    const { data: group, error: gErr } = await supabase
      .from(groupTable)
      .insert({
        [parentField]: parentId,
        label: `Superset ${label}`,
        set_count: setCount,
        order_index: currentMaxOrderIndex + 1,
        rest_seconds: restSeconds !== '' && parseInt(restSeconds) > 0
          ? parseInt(restSeconds)
          : null,
      })
      .select('id, label, set_count, order_index, created_at, rest_seconds')
      .single()
    if (gErr) throw new Error(gErr.message)

    const rows = selected.map((ex, i) => ({
      [parentField]: parentId,
      exercise_id: ex.id,
      group_id: group.id,
      position_in_group: i,
      sets: setCount,
      reps: parseInt(repsMap[ex.id]) || ex.default_reps || 10,
      weight: weightMap[ex.id] ? toCanonical(parseFloat(weightMap[ex.id]), weightUnit ?? 'kg') : null,
      therapist_notes: null,
      measurement_type: measurementTypeMap[ex.id] ?? 'reps',
      bilateral: bilateralMap[ex.id] ?? false,
    }))
    const { data: inserted, error: exErr } = await supabase
      .from(exerciseTable)
      .insert(rows)
      .select(exSelect)
    if (exErr) throw new Error(exErr.message)

    onAdd(group, inserted ?? [])
  }

  async function handleEdit() {
    const existingExerciseIds = editMembers.map(em => em.exercises?.id).filter(Boolean)
    const selectedIds = selected.map(e => e.id)

    const removedMembers = editMembers.filter(em => !selectedIds.includes(em.exercises?.id))
    if (removedMembers.length > 0) {
      const removedIds = removedMembers.map(em => em.id)

      if (mode === 'prescription') {
        const { data: logs, error: logsErr } = await supabase
          .from('exercise_logs')
          .select('id')
          .in('prescription_exercise_id', removedIds)
          .limit(1)
        if (logsErr) throw new Error('Could not verify session history. Please try again.')
        if (logs?.length > 0) {
          throw new Error('One or more exercises have logged sessions and cannot be removed from this superset.')
        }
      }

      const { error: delErr } = await supabase
        .from(exerciseTable)
        .delete()
        .in('id', removedIds)
      if (delErr) throw new Error(delErr.message)
    }

    const survivingMembers = editMembers.filter(em => !removedMembers.some(r => r.id === em.id))

    // Update position + all editable fields for surviving members
    for (let i = 0; i < survivingMembers.length; i++) {
      const em = survivingMembers[i]
      const exId = em.exercises?.id
      await supabase
        .from(exerciseTable)
        .update({
          position_in_group: i,
          reps: parseInt(repsMap[exId]) || em.reps || 10,
          weight: weightMap[exId] ? toCanonical(parseFloat(weightMap[exId]), weightUnit ?? 'kg') : null,
          measurement_type: measurementTypeMap[exId] ?? em.measurement_type ?? 'reps',
          bilateral: bilateralMap[exId] ?? false,
        })
        .eq('id', em.id)
    }

    const newExercises = selected.filter(e => !existingExerciseIds.includes(e.id))
    let inserted = []
    if (newExercises.length > 0) {
      const newRows = newExercises.map((ex, i) => ({
        [parentField]: parentId,
        exercise_id: ex.id,
        group_id: editGroup.id,
        position_in_group: survivingMembers.length + i,
        sets: setCount,
        reps: parseInt(repsMap[ex.id]) || ex.default_reps || 10,
        weight: weightMap[ex.id] ? toCanonical(parseFloat(weightMap[ex.id]), weightUnit ?? 'kg') : null,
        therapist_notes: null,
        measurement_type: measurementTypeMap[ex.id] ?? 'reps',
        bilateral: bilateralMap[ex.id] ?? false,
      }))
      const { data, error: exErr } = await supabase
        .from(exerciseTable)
        .insert(newRows)
        .select(exSelect)
      if (exErr) throw new Error(exErr.message)
      inserted = data ?? []
    }

    const { error: upErr } = await supabase
      .from(groupTable)
      .update({
        set_count: setCount,
        rest_seconds: restSeconds !== '' && parseInt(restSeconds) > 0
          ? parseInt(restSeconds)
          : null,
      })
      .eq('id', editGroup.id)
    if (upErr) throw new Error(upErr.message)

    const { error: exUpErr } = await supabase
      .from(exerciseTable)
      .update({ sets: setCount })
      .eq('group_id', editGroup.id)
    if (exUpErr) throw new Error(exUpErr.message)

    onAdd(
      {
        ...editGroup,
        set_count: setCount,
        rest_seconds: restSeconds !== '' && parseInt(restSeconds) > 0 ? parseInt(restSeconds) : null,
      },
      inserted,
      removedMembers.map(em => em.id)
    )
  }

  const isEditMode = !!editGroup
  const canConfirm = selected.length >= 2 && !saving
  const wu = weightUnit ?? 'kg'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--color-surface)', border: '1px solid rgba(41,181,204,0.25)', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '440px', maxHeight: '80vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '3px' }}>
            {isEditMode ? 'Edit superset' : 'Add superset'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
            Pick 2 or more exercises. All share the same set count.
          </div>
        </div>

        {/* Search with floating results dropdown */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises…"
            autoFocus
            style={{ width: '100%', padding: '9px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: 'var(--color-surface)', border: '1px solid rgba(41,181,204,0.25)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
              {results.map(ex => (
                <div
                  key={ex.id}
                  onClick={() => toggleExercise(ex)}
                  style={{
                    padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    background: isSelected(ex.id) ? 'rgba(41,181,204,0.08)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: '13px', flex: 1, color: 'var(--color-text)', fontWeight: isSelected(ex.id) ? 600 : 400 }}>{ex.name}</div>
                  {isSelected(ex.id) && <span style={{ fontSize: '11px', color: '#29B5CC' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-subtle)', marginBottom: '6px' }}>
              Selected ({selected.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selected.map(ex => (
                <div key={ex.id} style={{ background: 'var(--color-elevated)', border: '1px solid rgba(41,181,204,0.18)', borderRadius: '8px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {/* Name + remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '24px', background: '#29B5CC', borderRadius: '2px', opacity: 0.5, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{ex.name}</div>
                    <button onClick={() => toggleExercise(ex)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                  {/* Measurement type + reps + weight */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingLeft: '11px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0 }}>
                      {['reps', 'seconds'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setMeasurementTypeMap(prev => ({ ...prev, [ex.id]: type }))}
                          style={{
                            padding: '3px 9px', fontSize: '11px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            background: (measurementTypeMap[ex.id] ?? 'reps') === type ? '#29B5CC' : 'var(--color-surface)',
                            color: (measurementTypeMap[ex.id] ?? 'reps') === type ? '#000' : 'var(--color-muted)',
                            fontWeight: (measurementTypeMap[ex.id] ?? 'reps') === type ? 700 : 400,
                          }}
                        >
                          {type === 'reps' ? 'Reps' : 'Sec'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number" min="1"
                      value={repsMap[ex.id] ?? '10'}
                      onChange={e => setRepsMap(prev => ({ ...prev, [ex.id]: e.target.value }))}
                      placeholder={(measurementTypeMap[ex.id] ?? 'reps') === 'seconds' ? 'sec' : 'reps'}
                      style={{ width: '56px', padding: '3px 6px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '12px', outline: 'none', colorScheme: 'dark', textAlign: 'center' }}
                    />
                    <input
                      type="number" min="0" step="0.5"
                      value={weightMap[ex.id] ?? ''}
                      onChange={e => setWeightMap(prev => ({ ...prev, [ex.id]: e.target.value }))}
                      placeholder={`wt (${wu})`}
                      style={{ width: '76px', padding: '3px 6px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', fontSize: '12px', outline: 'none', colorScheme: 'dark', textAlign: 'center' }}
                    />
                  </div>
                  {/* Bilateral */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', paddingLeft: '11px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bilateralMap[ex.id] ?? false}
                      onChange={() => toggleBilateral(ex.id)}
                      style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#29B5CC' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Both sides</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>Sets (applied to all)</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setSetCount(v => Math.max(1, v - 1))} style={{ width: '28px', height: '28px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', width: '24px', textAlign: 'center' }}>{setCount}</span>
            <button onClick={() => setSetCount(v => v + 1)} style={{ width: '28px', height: '28px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>
            Rest between rounds <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="number"
              min="0"
              step="5"
              value={restSeconds}
              onChange={e => setRestSeconds(e.target.value)}
              placeholder="—"
              style={{ width: '64px', padding: '5px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', colorScheme: 'dark', textAlign: 'center' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>sec</span>
          </div>
        </div>

        {error && <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{ flex: 2, padding: '10px', background: canConfirm ? '#29B5CC' : 'rgba(41,181,204,0.3)', color: canConfirm ? '#000' : '#555', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: canConfirm ? 'pointer' : 'default', fontFamily: 'inherit' }}
          >
            {saving ? 'Saving…' : isEditMode ? 'Save changes' : 'Add to session'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getLetter(n) {
  return String.fromCharCode(65 + (n % 26))
}
