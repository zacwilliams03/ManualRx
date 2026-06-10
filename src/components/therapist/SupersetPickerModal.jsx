import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function SupersetPickerModal({
  prescriptionId,
  existingGroupCount,   // number of groups already on this prescription (for auto-label)
  currentMaxOrderIndex, // used for new group order_index
  onAdd,                // onAdd(group, memberPeRows, removedPeIds?) — called after DB write
  onClose,
  editGroup = null,     // group row to edit (null = create mode)
  editMembers = [],     // existing prescription_exercises rows for this group (edit mode)
}) {
  const { profile } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(() =>
    editMembers.map(em => em.exercises).filter(Boolean)
  )
  const [setCount, setSetCount] = useState(editGroup?.set_count ?? 3)
  const [saving, setSaving] = useState(false)
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
    setSelected(prev =>
      isSelected(exercise.id)
        ? prev.filter(e => e.id !== exercise.id)
        : [...prev, exercise]
    )
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
      .from('prescription_exercise_groups')
      .insert({
        prescription_id: prescriptionId,
        label: `Superset ${label}`,
        set_count: setCount,
        order_index: currentMaxOrderIndex + 1,
      })
      .select('id, label, set_count, order_index, created_at')
      .single()
    if (gErr) throw new Error(gErr.message)

    const peRows = selected.map((ex, i) => ({
      prescription_id: prescriptionId,
      exercise_id: ex.id,
      group_id: group.id,
      position_in_group: i,
      sets: setCount,
      reps: ex.default_reps ?? 10,
      weight: null,
      therapist_notes: null,
      measurement_type: 'reps',
      bilateral: false,
    }))
    const { data: inserted, error: peErr } = await supabase
      .from('prescription_exercises')
      .insert(peRows)
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
    if (peErr) throw new Error(peErr.message)

    onAdd(group, inserted)
  }

  async function handleEdit() {
    const existingExerciseIds = editMembers.map(em => em.exercises?.id).filter(Boolean)
    const selectedIds = selected.map(e => e.id)

    const removedMembers = editMembers.filter(em => !selectedIds.includes(em.exercises?.id))
    if (removedMembers.length > 0) {
      const removedPeIds = removedMembers.map(em => em.id)
      const { data: logs, error: logsErr } = await supabase
        .from('exercise_logs')
        .select('id')
        .in('prescription_exercise_id', removedPeIds)
        .limit(1)
      if (logsErr) throw new Error('Could not verify session history. Please try again.')
      if (logs?.length > 0) {
        throw new Error('One or more exercises have logged sessions and cannot be removed from this superset.')
      }
      const { error: delErr } = await supabase
        .from('prescription_exercises')
        .delete()
        .in('id', removedPeIds)
      if (delErr) throw new Error(delErr.message)
    }

    // Reindex surviving members to close position gaps
    const survivingMembers = editMembers.filter(em => !removedMembers.some(r => r.id === em.id))
    for (let i = 0; i < survivingMembers.length; i++) {
      if (survivingMembers[i].position_in_group !== i) {
        await supabase
          .from('prescription_exercises')
          .update({ position_in_group: i })
          .eq('id', survivingMembers[i].id)
      }
    }

    const newExercises = selected.filter(e => !existingExerciseIds.includes(e.id))
    let inserted = []
    if (newExercises.length > 0) {
      const newRows = newExercises.map((ex, i) => ({
        prescription_id: prescriptionId,
        exercise_id: ex.id,
        group_id: editGroup.id,
        position_in_group: survivingMembers.length + i,
        sets: setCount,
        reps: ex.default_reps ?? 10,
        weight: null,
        therapist_notes: null,
        measurement_type: 'reps',
        bilateral: false,
      }))
      const { data, error: peErr } = await supabase
        .from('prescription_exercises')
        .insert(newRows)
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      if (peErr) throw new Error(peErr.message)
      inserted = data ?? []
    }

    const { error: upErr } = await supabase
      .from('prescription_exercise_groups')
      .update({ set_count: setCount })
      .eq('id', editGroup.id)
    if (upErr) throw new Error(upErr.message)

    const { error: peUpErr } = await supabase
      .from('prescription_exercises')
      .update({ sets: setCount })
      .eq('group_id', editGroup.id)
    if (peUpErr) throw new Error(peUpErr.message)

    onAdd({ ...editGroup, set_count: setCount }, inserted, removedMembers.map(em => em.id))
  }

  const isEditMode = !!editGroup
  const canConfirm = selected.length >= 2 && !saving

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
            Pick 2 or more exercises. All will share the same set count.
          </div>
        </div>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises…"
          autoFocus
          style={{ width: '100%', padding: '9px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
        />

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '160px', overflowY: 'auto' }}>
            {results.map(ex => (
              <div
                key={ex.id}
                onClick={() => toggleExercise(ex)}
                style={{
                  padding: '8px 10px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  background: isSelected(ex.id) ? 'rgba(41,181,204,0.08)' : 'var(--color-elevated)',
                  border: isSelected(ex.id) ? '1px solid rgba(41,181,204,0.25)' : '1px solid transparent',
                }}
              >
                <div style={{ fontSize: '13px', flex: 1, color: 'var(--color-text)', fontWeight: isSelected(ex.id) ? 600 : 400 }}>{ex.name}</div>
                {isSelected(ex.id) && <span style={{ fontSize: '11px', color: '#29B5CC' }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {selected.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-subtle)', marginBottom: '6px' }}>
              Selected ({selected.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {selected.map(ex => (
                <div key={ex.id} style={{ background: 'var(--color-elevated)', border: '1px solid rgba(41,181,204,0.18)', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '24px', background: '#29B5CC', borderRadius: '2px', opacity: 0.5, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{ex.name}</div>
                  <button onClick={() => toggleExercise(ex)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
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
