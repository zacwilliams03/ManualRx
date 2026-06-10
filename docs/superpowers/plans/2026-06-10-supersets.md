# Supersets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow therapists to group exercises into supersets within a session, and have clients complete them round-by-round (all exercises in the group on one screen per round) in the session wizard.

**Architecture:** New `prescription_exercise_groups` table + two nullable columns on `prescription_exercises` hold the grouping. A shared pure utility (`supersetUtils.js`) normalises raw DB rows into a typed `sessionItems` array consumed identically by the therapist builder and client wizard. Therapist creates supersets via a dedicated modal; client steps through a combined round screen (all exercises visible) with a rest screen between rounds.

**Tech Stack:** React 18, Vite, Supabase (postgres + RLS), inline styles (existing pattern), Vitest for tests, Framer Motion (already in use).

**Spec:** `docs/superpowers/specs/2026-06-10-supersets-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260610000001_supersets.sql` | **Create** | New table, alter, RLS policies, backfill |
| `src/utils/supersetUtils.js` | **Create** | Pure `buildSessionItems` function |
| `src/utils/supersetUtils.test.js` | **Create** | Unit tests for `buildSessionItems` |
| `src/components/therapist/SupersetPickerModal.jsx` | **Create** | Superset creation / edit modal |
| `src/pages/therapist/SessionEdit.jsx` | **Modify** | Fetch groups, build items, render superset blocks, wire modal |
| `src/pages/client/SessionWizard.jsx` | **Modify** | sessionItems model, superset round screen, rest screen, completion |

---

## Task 1 — Database migration

**File:** `supabase/migrations/20260610000001_supersets.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ── New table: prescription_exercise_groups ─────────────────────────────────
CREATE TABLE prescription_exercise_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT '',
  set_count       int  NOT NULL,
  order_index     int  NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ── Alter prescription_exercises ─────────────────────────────────────────────
ALTER TABLE prescription_exercises
  ADD COLUMN group_id          uuid REFERENCES prescription_exercise_groups(id) ON DELETE CASCADE,
  ADD COLUMN position_in_group int,
  ADD COLUMN order_index       int;

-- ── Backfill order_index for existing rows ───────────────────────────────────
-- Uses created_at for deterministic ordering.
-- VERIFY FIRST: confirm prescription_exercises has a created_at column via
-- the Supabase Table Editor or \d prescription_exercises in psql.
-- If not present (uncommon for Supabase-dashboard tables), add it:
--   ALTER TABLE prescription_exercises ADD COLUMN created_at timestamptz DEFAULT now();
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY prescription_id ORDER BY created_at ASC, id ASC) AS rn
  FROM prescription_exercises
)
UPDATE prescription_exercises pe
SET order_index = r.rn
FROM ranked r
WHERE pe.id = r.id;

-- ── RLS: prescription_exercise_groups ────────────────────────────────────────
ALTER TABLE prescription_exercise_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_therapist_all" ON prescription_exercise_groups
  FOR ALL TO authenticated
  USING (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE therapist_id = auth.uid()
    )
  )
  WITH CHECK (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE therapist_id = auth.uid()
    )
  );

-- Matches the shape of prescription_exercises_client_read exactly.
CREATE POLICY "groups_client_read" ON prescription_exercise_groups
  FOR SELECT TO authenticated
  USING (
    prescription_id IN (
      SELECT p.id FROM prescriptions p
      JOIN clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration**

```
npx supabase db push --linked
```

Expected: migration runs without errors. Confirm in the Supabase Table Editor that `prescription_exercise_groups` exists and `prescription_exercises` has the three new columns.

- [ ] **Step 3: Commit**

```
git add supabase/migrations/20260610000001_supersets.sql
git commit -m "feat: add prescription_exercise_groups table and alter prescription_exercises"
```

---

## Task 2 — `buildSessionItems` utility + tests

**Files:**
- Create: `src/utils/supersetUtils.js`
- Create: `src/utils/supersetUtils.test.js`

- [ ] **Step 1: Create `src/utils/supersetUtils.js`**

```js
/**
 * Merges fetched prescription_exercise_groups and prescription_exercises rows
 * into a sorted sessionItems array for use in both SessionEdit and SessionWizard.
 *
 * Each item is one of:
 *   { type: 'exercise', orderIndex, createdAt, ex: prescriptionExerciseRow }
 *   { type: 'superset', orderIndex, createdAt, group: groupRow, exercises: prescriptionExerciseRow[] }
 *
 * Standalone exercises (group_id === null) use their own order_index.
 * Superset groups use the group row's order_index; member exercises are sorted
 * by position_in_group.
 * Tiebreaker: createdAt ASC (robust to null order_index on legacy rows).
 */
export function buildSessionItems(groups, prescriptionExercises) {
  const items = []

  for (const group of groups) {
    const members = prescriptionExercises
      .filter(pe => pe.group_id === group.id)
      .sort((a, b) => (a.position_in_group ?? 0) - (b.position_in_group ?? 0))
    items.push({
      type: 'superset',
      orderIndex: group.order_index,
      createdAt: group.created_at,
      group,
      exercises: members,
    })
  }

  for (const pe of prescriptionExercises) {
    if (pe.group_id == null) {
      items.push({
        type: 'exercise',
        orderIndex: pe.order_index,
        createdAt: pe.created_at ?? null,
        ex: pe,
      })
    }
  }

  items.sort((a, b) => {
    const ao = a.orderIndex ?? Infinity
    const bo = b.orderIndex ?? Infinity
    if (ao !== bo) return ao - bo
    if (a.createdAt && b.createdAt) return new Date(a.createdAt) - new Date(b.createdAt)
    return 0
  })

  return items
}
```

- [ ] **Step 2: Create `src/utils/supersetUtils.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { buildSessionItems } from './supersetUtils'

const makeGroup = (id, orderIndex) => ({
  id,
  label: `Superset ${id}`,
  set_count: 3,
  order_index: orderIndex,
  created_at: '2026-01-01T00:00:00Z',
})

const makeEx = (id, groupId, orderIndex, position = null) => ({
  id,
  group_id: groupId,
  position_in_group: position,
  order_index: orderIndex,
  created_at: '2026-01-01T00:00:00Z',
  exercises: { id: `ex-${id}`, name: 'Test', video_url: null },
})

describe('buildSessionItems', () => {
  it('returns empty array for empty inputs', () => {
    expect(buildSessionItems([], [])).toEqual([])
  })

  it('returns standalone exercises sorted by order_index', () => {
    const exercises = [makeEx('e2', null, 2), makeEx('e1', null, 1)]
    const items = buildSessionItems([], exercises)
    expect(items).toHaveLength(2)
    expect(items[0].ex.id).toBe('e1')
    expect(items[1].ex.id).toBe('e2')
  })

  it('places superset at correct order_index among standalones', () => {
    const groups = [makeGroup('g1', 2)]
    const exercises = [
      makeEx('e1', null, 1),
      makeEx('e3', null, 3),
      makeEx('ea', 'g1', null, 0),
      makeEx('eb', 'g1', null, 1),
    ]
    const items = buildSessionItems(groups, exercises)
    expect(items.map(i => i.type)).toEqual(['exercise', 'superset', 'exercise'])
    expect(items[0].ex.id).toBe('e1')
    expect(items[2].ex.id).toBe('e3')
  })

  it('sorts superset members by position_in_group', () => {
    const groups = [makeGroup('g1', 1)]
    const exercises = [makeEx('eb', 'g1', null, 1), makeEx('ea', 'g1', null, 0)]
    const items = buildSessionItems(groups, exercises)
    expect(items[0].exercises[0].id).toBe('ea')
    expect(items[0].exercises[1].id).toBe('eb')
  })

  it('attaches group metadata to superset item', () => {
    const groups = [makeGroup('g1', 1)]
    const exercises = [makeEx('ea', 'g1', null, 0), makeEx('eb', 'g1', null, 1)]
    const items = buildSessionItems(groups, exercises)
    expect(items[0].group.id).toBe('g1')
    expect(items[0].group.set_count).toBe(3)
  })

  it('places null order_index standalones last', () => {
    const exercises = [makeEx('e1', null, 1), makeEx('e2', null, null)]
    const items = buildSessionItems([], exercises)
    expect(items[0].ex.id).toBe('e1')
    expect(items[1].ex.id).toBe('e2')
  })

  it('returns type exercise for standalone items', () => {
    const exercises = [makeEx('e1', null, 1)]
    const items = buildSessionItems([], exercises)
    expect(items[0].type).toBe('exercise')
    expect(items[0].ex.id).toBe('e1')
  })
})
```

- [ ] **Step 3: Run tests — expect all 7 pass**

```
npm test
```

Expected: 7 new tests pass, 0 failures.

- [ ] **Step 4: Commit**

```
git add src/utils/supersetUtils.js src/utils/supersetUtils.test.js
git commit -m "feat: add buildSessionItems utility with tests"
```

---

## Task 3 — `SupersetPickerModal` component

**File:** `src/components/therapist/SupersetPickerModal.jsx`

This modal handles both **create** mode (no `editGroup` prop) and **edit** mode (`editGroup` + `editMembers` provided).

- [ ] **Step 1: Create `src/components/therapist/SupersetPickerModal.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function SupersetPickerModal({
  prescriptionId,
  existingGroupCount,   // number of groups already on this prescription (for auto-label)
  currentMaxOrderIndex, // used for new group order_index
  onAdd,                // onAdd(group, memberPeRows) — called after DB insert
  onClose,
  editGroup = null,     // group row to edit (null = create mode)
  editMembers = [],     // existing prescription_exercises rows for this group (edit mode)
}) {
  const { profile } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  // In edit mode, pre-populate selected with the exercise definitions from editMembers
  const [selected, setSelected] = useState(() =>
    editMembers.map(em => em.exercises).filter(Boolean)
  )
  const [setCount, setSetCount] = useState(editGroup?.set_count ?? 3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  // Search exercises available to this therapist
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

    // Determine removed members (by exercise id)
    const removedMembers = editMembers.filter(em => !selectedIds.includes(em.exercises?.id))
    if (removedMembers.length > 0) {
      const removedPeIds = removedMembers.map(em => em.id)
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('id')
        .in('prescription_exercise_id', removedPeIds)
        .limit(1)
      if (logs?.length > 0) {
        throw new Error('One or more exercises have logged sessions and cannot be removed from this superset.')
      }
      // Safe to delete
      const { error: delErr } = await supabase
        .from('prescription_exercises')
        .delete()
        .in('id', removedPeIds)
      if (delErr) throw new Error(delErr.message)
    }

    // Insert new members
    const newExercises = selected.filter(e => !existingExerciseIds.includes(e.id))
    let inserted = []
    if (newExercises.length > 0) {
      const newRows = newExercises.map((ex, i) => ({
        prescription_id: prescriptionId,
        exercise_id: ex.id,
        group_id: editGroup.id,
        position_in_group: editMembers.length + i,
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
      inserted = data
    }

    // Update group set_count + propagate to member exercises
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

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises…"
          autoFocus
          style={{ width: '100%', padding: '9px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
        />

        {/* Search results */}
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

        {/* Selected list */}
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

        {/* Set count stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>Sets (applied to all)</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setSetCount(v => Math.max(1, v - 1))} style={{ width: '28px', height: '28px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', width: '24px', textAlign: 'center' }}>{setCount}</span>
            <button onClick={() => setSetCount(v => v + 1)} style={{ width: '28px', height: '28px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
        </div>

        {error && <p style={{ fontSize: '12px', color: 'var(--color-danger)', margin: 0 }}>{error}</p>}

        {/* Actions */}
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
```

- [ ] **Step 2: Commit**

```
git add src/components/therapist/SupersetPickerModal.jsx
git commit -m "feat: add SupersetPickerModal component"
```

---

## Task 4 — SessionEdit: fetch groups + build items

**File:** `src/pages/therapist/SessionEdit.jsx`

This task updates the data layer — fetching groups, building items, and adding the `items` state. The render loop is updated in Task 5. Tests run after Task 5.

- [ ] **Step 1: Add imports at the top of SessionEdit.jsx**

Add to the existing import block:

```js
import { buildSessionItems } from '../../utils/supersetUtils'
import SupersetPickerModal from '../../components/therapist/SupersetPickerModal'
```

- [ ] **Step 2: Add state variables**

Inside `SessionEdit`, after the existing state declarations, add:

```js
const [groups, setGroups] = useState([])
const [items, setItems] = useState([])          // unified sorted items
const [showSupersetModal, setShowSupersetModal] = useState(false)
const [editingSuperset, setEditingSuperset] = useState(null) // { group, members } | null
```

- [ ] **Step 3: Update `fetchData` to also fetch groups**

In the `fetchData` async function, change the parallel fetch from:

```js
const [sessionRes, exercisesRes] = await Promise.all([
  supabase.from('prescriptions').select(...).eq('id', sessionId).eq('therapist_id', profile.id).single(),
  supabase
    .from('prescription_exercises')
    .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
    .eq('prescription_id', sessionId)
    .order('id', { ascending: true }),
])
```

to:

```js
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
```

- [ ] **Step 4: Build items after fetch**

In `fetchData`, replace:
```js
} else {
  setExercises(exercisesRes.data ?? [])
}
```
with:
```js
} else {
  const fetchedExercises = exercisesRes.data ?? []
  const fetchedGroups = groupsRes.data ?? []
  setExercises(fetchedExercises)
  setGroups(fetchedGroups)
  setItems(buildSessionItems(fetchedGroups, fetchedExercises))
}
```

- [ ] **Step 5: Update `handleAddExercise` to set order_index**

`handleAddExercise` currently inserts without `order_index`. Add it so standalone exercises are ordered. Replace the insert call's object:

```js
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
```

Add the helper function before the component function (i.e. in module scope):

```js
function computeNextOrderIndex(groups, exercises) {
  const maxGroup = groups.reduce((m, g) => Math.max(m, g.order_index ?? 0), 0)
  const maxEx = exercises
    .filter(pe => pe.group_id == null)
    .reduce((m, pe) => Math.max(m, pe.order_index ?? 0), 0)
  return Math.max(maxGroup, maxEx) + 1
}
```

After inserting (whether perSetSets or not), rebuild items:

```js
setExercises(prev => {
  const next = [...prev, fresh ?? data]
  setItems(buildSessionItems(groups, next))
  return next
})
```

Change existing lines like `setExercises(prev => [...prev, fresh])` and `setExercises(prev => [...prev, data])` to the pattern above that also calls `setItems`.

- [ ] **Step 6: Update `removeExercise` to rebuild items**

Find `removeExercise`:
```js
async function removeExercise(peId) {
  await supabase.from('prescription_exercises').delete().eq('id', peId)
  setExercises(prev => prev.filter(pe => pe.id !== peId))
}
```

Replace with:
```js
async function removeExercise(peId) {
  await supabase.from('prescription_exercises').delete().eq('id', peId)
  setExercises(prev => {
    const next = prev.filter(pe => pe.id !== peId)
    setItems(buildSessionItems(groups, next))
    return next
  })
}
```

- [ ] **Step 7: Update `saveEdit` to rebuild items after edit**

In the final `setExercises` call inside `saveEdit` (after fresh re-fetch), change:
```js
setExercises(prev => prev.map(e => e.id === peId ? fresh : e))
```
to:
```js
setExercises(prev => {
  const next = prev.map(e => e.id === peId ? fresh : e)
  setItems(buildSessionItems(groups, next))
  return next
})
```

- [ ] **Step 8: Commit**

```
git add src/pages/therapist/SessionEdit.jsx
git commit -m "feat: SessionEdit — fetch groups, build items, add computeNextOrderIndex"
```

---

## Task 5 — SessionEdit: render superset blocks + "Add superset" button

**File:** `src/pages/therapist/SessionEdit.jsx`

This task replaces the exercise list render with an items-based render that displays superset blocks.

- [ ] **Step 1: Replace the exercise list render**

Find the `motion.div` card that renders the exercise list (starts around line 412). Replace the entire inner content that maps `exercises` — specifically this block:

```jsx
{exercises.length === 0 ? (
  <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--color-muted)' }}>No exercises added yet.</p>
) : (
  exercises.map((pe, i) => (
    <div
      key={pe.id}
      style={{ padding: '12px 20px', borderBottom: i < exercises.length - 1 ? '1px solid var(--color-elevated)' : 'none' }}
    >
      ... (exercise row content)
    </div>
  ))
)}
```

Replace with:

```jsx
{items.length === 0 ? (
  <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--color-muted)' }}>No exercises added yet.</p>
) : (
  items.map((item, i) => (
    item.type === 'exercise'
      ? renderExerciseRow(item.ex, i < items.length - 1)
      : renderSupersetBlock(item, i < items.length - 1)
  ))
)}
```

Also update the header count label from `exercises.length` to `items.length`:

```jsx
<span style={SECTION_LABEL}>Exercises {items.length > 0 ? `(${items.length})` : ''}</span>
```

- [ ] **Step 2: Extract existing exercise row to `renderExerciseRow`**

The existing `exercises.map(...)` body is the exercise row. Extract it into a named function inside the component. Place it after the state declarations, before the `return`:

```jsx
function renderExerciseRow(pe, hasBorder) {
  return (
    <div
      key={pe.id}
      style={{ padding: '12px 20px', borderBottom: hasBorder ? '1px solid var(--color-elevated)' : 'none' }}
    >
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>{pe.exercises.name}</div>
      {editingId === pe.id ? (
        // ... paste the entire existing editingId === pe.id block here exactly as-is ...
        // (the block from "display: flex, flexDirection: column, gap: 8px" through to
        //  the Cancel/Save buttons and the closing div)
      ) : (
        // ... paste the entire existing else block here exactly as-is ...
      )}
      {pe.exercises.video_url && <VideoPlayer url={pe.exercises.video_url} className="w-full rounded mt-2" />}
    </div>
  )
}
```

For superset member exercises, the per-set toggle and sets field should be read-only (set count is controlled by the group). Add this at the top of the edit panel inside `renderExerciseRow`:

```jsx
// At the start of the editingId === pe.id block, before the sets/reps/weight fields:
{pe.group_id != null && (
  <div style={{ fontSize: '11px', color: 'var(--color-subtle)', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
    Set count is controlled by the superset ({pe.sets} sets). Edit the superset to change it.
  </div>
)}
```

And hide the per-set toggle for grouped exercises by wrapping the entire per-set section in:

```jsx
{pe.group_id == null && (
  // ... existing per-set toggle block ...
)}
```

- [ ] **Step 3: Add `renderSupersetBlock` function**

Add after `renderExerciseRow`:

```jsx
function renderSupersetBlock(item, hasBorder) {
  const { group, exercises: members } = item
  return (
    <div
      key={group.id}
      style={{ borderBottom: hasBorder ? '1px solid var(--color-elevated)' : 'none' }}
    >
      {/* Superset header */}
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

      {/* Member exercises */}
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

      {/* Add to superset inline */}
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
```

- [ ] **Step 4: Add `handleUngroup` function**

```jsx
async function handleUngroup(group, members) {
  // Check for any logs on member exercises
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
  // Update members: clear group_id, assign sequential order_index
  for (let i = 0; i < members.length; i++) {
    await supabase
      .from('prescription_exercises')
      .update({ group_id: null, position_in_group: null, order_index: group.order_index + i })
      .eq('id', members[i].id)
  }
  // Delete the group row
  await supabase.from('prescription_exercise_groups').delete().eq('id', group.id)
  // Update local state
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
```

- [ ] **Step 5: Add "Add superset" button and wire up modal**

In the return JSX, find the `{/* ExercisePicker — unchanged */}` line at the bottom. Add the modal and button immediately before it:

```jsx
{/* Superset modal */}
{(showSupersetModal || editingSuperset) && (
  <SupersetPickerModal
    prescriptionId={sessionId}
    existingGroupCount={groups.length}
    currentMaxOrderIndex={computeNextOrderIndex(groups, exercises) - 1}
    editGroup={editingSuperset?.group ?? null}
    editMembers={editingSuperset?.members ?? []}
    onAdd={(updatedGroup, newPeRows, removedPeIds = []) => {
      if (editingSuperset) {
        // Edit mode: update groups state, remove deleted members, add new ones
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
        // Create mode
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

{/* Add superset button — sits above ExercisePicker */}
<button
  onClick={() => setShowSupersetModal(true)}
  style={{ width: '100%', padding: '10px', background: 'rgba(41,181,204,0.08)', border: '1px solid rgba(41,181,204,0.25)', borderRadius: '8px', color: '#29B5CC', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
>
  ⚡ Add superset
</button>
```

- [ ] **Step 6: Run dev server and visually verify**

```
npm run dev
```

Navigate to a session in the therapist builder (`/therapist/prescribe/:clientId/sessions/:sessionId`). Verify:
- Existing standalone exercises render as before
- "⚡ Add superset" button appears above ExercisePicker
- Clicking it opens the modal; searching, selecting 2+ exercises, and clicking "Add to session" creates a teal-bordered superset block
- Each member exercise's edit panel shows a read-only set count notice
- Edit/Ungroup controls appear on the superset header
- Ungroup converts the block back to standalone exercises

- [ ] **Step 7: Commit**

```
git add src/pages/therapist/SessionEdit.jsx
git commit -m "feat: SessionEdit — render superset blocks, add superset button, ungroup action"
```

---

## Task 6 — SessionWizard: sessionItems model + step compatibility

**File:** `src/pages/client/SessionWizard.jsx`

This task updates the data layer and step state shape in the wizard, keeping standalone exercise behaviour identical to today.

- [ ] **Step 1: Add import**

Add to existing imports:

```js
import { buildSessionItems } from '../../utils/supersetUtils'
```

- [ ] **Step 2: Add `sessionItems` state and `groups` state**

After existing state declarations:

```js
const [sessionItems, setSessionItems] = useState([])
```

- [ ] **Step 3: Update the exercise fetch to include new columns and fetch groups**

In `fetchData`, change the parallel `Promise.all` from two fetches to three:

```js
const [sessionRes, exercisesRes, clientRes, groupsRes] = await Promise.all([
  supabase.from('prescriptions').select('id, name, therapist_id').eq('id', sessionId).single(),
  supabase
    .from('prescription_exercises')
    .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(id, name, category, video_url)')
    .eq('prescription_id', sessionId),
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
```

Update the error checks to include `groupsRes` (treat group fetch errors as non-fatal — just log and continue with empty groups).

- [ ] **Step 4: Build sessionItems after fetch**

After `setExercises(...)`, add:

```js
const fetchedGroups = groupsRes?.data ?? []
const fetchedExercises = exercisesRes.data ?? []

// Initialise per-exercise client-side state
const exercisesWithState = fetchedExercises.map(pe => ({
  ...pe,
  prescription_exercise_sets: [...(pe.prescription_exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number),
  setsData: Array(pe.sets || 1).fill(null).map(() => ({ reps: '', weight: '' })),
  currentSet: 0,
  allSetsDone: false,
  painRating: null,
  clientNotes: '',
  videoFile: null,
}))

setExercises(exercisesWithState)

// Build sessionItems: supersets carry per-exercise state inside their exercises array
const rawItems = buildSessionItems(fetchedGroups, exercisesWithState)
const itemsWithState = rawItems.map(item => {
  if (item.type === 'superset') {
    return { ...item, currentRound: 0 }
  }
  return item
})
setSessionItems(itemsWithState)
```

Remove the existing `setExercises(...)` call (now replaced by the one above).

- [ ] **Step 5: Update step state shape**

Change the "Start session" button's `onClick` from:
```js
onClick={() => setStep(0)}
```
to:
```js
onClick={() => setStep({ itemIndex: 0 })}
```

- [ ] **Step 6: Update the step guard for standalone exercises**

Change:
```js
if (typeof step === 'number') {
  const ex = exercises[step]
  const isLast = step === exercises.length - 1
```
to:
```js
if (step && typeof step === 'object' && step.restAfterRound === undefined) {
  const item = sessionItems[step.itemIndex]
  if (!item) return null

  // Superset round screen is handled in the next block
  if (item.type === 'superset') {
    // (rendered in Task 7 — leave this as a placeholder for now)
    return <div>Superset screen — Task 7</div>
  }

  const ex = item.ex
  const isLast = step.itemIndex === sessionItems.length - 1
```

- [ ] **Step 7: Update all references to `exercises[step]` and `step` as a number**

Within the standalone exercise step block, change:
- `exercises[step]` → `item.ex` (already done above via `ex`)
- `isLast = step === exercises.length - 1` → `step.itemIndex === sessionItems.length - 1`
- `setStep(step === 0 ? 'intro' : step - 1)` → `setStep(step.itemIndex === 0 ? 'intro' : { itemIndex: step.itemIndex - 1 })`
- `setStep(step + 1)` or next-exercise advance → `setStep(isLast ? 'summary' : { itemIndex: step.itemIndex + 1 })`
- `updateEx(step, ...)` calls pass `step` as an index into `exercises` — these still work because `exercises` array is unchanged; no changes needed to `updateEx` / `updateSetField` / `completeSet`

- [ ] **Step 8: Update progress bar**

Change the progress bar to use `sessionItems`:

```jsx
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
```

Change the label:
```jsx
<span style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-subtle)' }}>
  {step.itemIndex + 1} / {sessionItems.length}
</span>
```

- [ ] **Step 9: Update the 'done' / completion screen**

The `'done'` step uses `exercises.length` in the count text. Change to:
```jsx
{sessionItems.length} item{sessionItems.length !== 1 ? 's' : ''} completed and logged.
```

- [ ] **Step 10: Run dev server on a session with no supersets**

```
npm run dev
```

Log in as a client. Open any existing session (no supersets). Verify:
- Intro screen shows correctly
- All exercises step through exactly as before (no regression)
- Progress bar and counts are correct

- [ ] **Step 11: Commit**

```
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: SessionWizard — sessionItems model, update step shape for standalone exercises"
```

---

## Task 7 — SessionWizard: superset round screen + rest screen + completion

**File:** `src/pages/client/SessionWizard.jsx`

- [ ] **Step 1: Add helper for superset per-exercise state updates**

After the existing `updateEx`, `updateSetField`, `completeSet` helpers, add:

```js
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

function advanceSupersetRound(itemIndex) {
  setSessionItems(prev => {
    const next = [...prev]
    next[itemIndex] = { ...next[itemIndex], currentRound: next[itemIndex].currentRound + 1 }
    return next
  })
}
```

- [ ] **Step 2: Replace the superset placeholder with the round screen**

Replace the `return <div>Superset screen — Task 7</div>` placeholder from Task 6 Step 6 with the full superset round screen.

Find the condition `if (item.type === 'superset')` and replace its body:

```jsx
if (item.type === 'superset') {
  const { group, exercises: superExs, currentRound } = item
  const isLastRound = currentRound === group.set_count - 1
  const isLastItem = step.itemIndex === sessionItems.length - 1

  function handleCompleteRound() {
    if (!isLastRound) {
      // Go to rest screen
      setStep({ itemIndex: step.itemIndex, restAfterRound: currentRound })
      advanceSupersetRound(step.itemIndex)
    } else {
      // Last round: advance to next session item
      setStep(isLastItem ? 'summary' : { itemIndex: step.itemIndex + 1 })
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      {/* Sticky progress header */}
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
        {/* Superset badge + round */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(41,181,204,0.10)', border: '1px solid rgba(41,181,204,0.22)', color: '#29B5CC', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
            ⚡ {group.label}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Round {currentRound + 1} of {group.set_count}</span>
        </div>

        {/* Exercise cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {superExs.map((exItem, exIdx) => {
            const pe = exItem
            const roundData = pe.setsData[currentRound] ?? { reps: '', weight: '' }
            const [videoOpen, setVideoOpen] = useState(false)
            return (
              <div key={pe.id} style={{ ...CARD, padding: 0, overflow: 'hidden', position: 'relative' }}>
                <ShimmerLine />
                {/* Exercise header */}
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
                        onClick={() => setVideoOpen(v => !v)}
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
                {/* Reps / weight inputs */}
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
            ? (isLastItem ? 'Complete round → finish session' : 'Complete round → next exercise')
            : `Complete round ${currentRound + 1} → rest`}
        </button>
      </div>
    </div>
  )
}
```

**Note:** Using `useState` inside `.map()` is not allowed in React. Replace the per-card `videoOpen` state with a single `openVideoId` state at the component level:

```js
const [openVideoId, setOpenVideoId] = useState(null)
```

Then in the exercise card render:
```jsx
// Replace: const [videoOpen, setVideoOpen] = useState(false)
// With:
const videoOpen = openVideoId === pe.id
// Replace: onClick={() => setVideoOpen(v => !v)}
// With:
onClick={() => setOpenVideoId(v => v === pe.id ? null : pe.id)}
```

- [ ] **Step 3: Add the rest screen**

After the superset block (still inside `if (step && typeof step === 'object')`), add a check for `step.restAfterRound`:

```jsx
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

        {/* Round summary */}
        <div style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
          {superExs.map((pe, i) => {
            const logged = pe.setsData[completedRound] ?? {}
            return (
              <div
                key={pe.id}
                style={{ padding: '9px 12px', borderBottom: i < superExs.length - 1 ? '1px solid var(--color-elevated)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}
              >
                <span style={{ color: 'var(--color-text)' }}>{pe.exercises?.name}</span>
                <span style={{ color: '#29B5CC', fontWeight: 600 }}>
                  {logged.reps || pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                  {logged.weight ? ` · ${formatWeight(toCanonical(parseFloat(logged.weight), weightUnit), weightUnit)}` : ''} ✓
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
```

- [ ] **Step 4: Update `handleComplete` to log all exercises from sessionItems**

In `handleComplete`, replace the loop that iterates `exercises` with one that iterates `sessionItems`:

```js
// Collect all exercise entries from sessionItems
const allExerciseEntries = sessionItems.flatMap(item => {
  if (item.type === 'exercise') return [item.ex]
  return item.exercises // superset members
})

// Replace: exercises.map(ex => ({...}))
// With: allExerciseEntries.map(ex => ({...}))
// (the object shape inside .map is identical — no other changes needed)
```

Also update the video upload loop from `for (const ex of exercises)` to `for (const ex of allExerciseEntries)`.

- [ ] **Step 5: Run dev server and test with a superset session**

```
npm run dev
```

Log in as a client. Open a session that has a superset (create one in the therapist builder first). Verify:
- Intro shows correctly
- Superset item shows the round screen with all exercises visible
- Each exercise has reps/weight inputs
- "▶ Video" toggles the video inline
- "Complete round → rest" transitions to the rest screen
- Rest screen shows the logged values from the completed round
- "Start Round N+1 →" returns to the round screen
- After the final round, advances to the next item (or summary)
- Completing the session logs all exercises correctly (check Supabase exercise_logs)

- [ ] **Step 6: Run tests**

```
npm test
```

Expected: all tests pass including the 7 `buildSessionItems` tests.

- [ ] **Step 7: Commit**

```
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: SessionWizard — superset round screen, rest screen, updated completion logging"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Plan task |
|---|---|
| §1.1 new table | Task 1 |
| §1.2 alter prescription_exercises, backfill | Task 1 |
| §1.3 RLS policies | Task 1 |
| §2.1 fetch groups, build items | Task 4 |
| §2.2 "Add superset" button | Task 5 Step 5 |
| §2.3 SupersetPickerModal create mode | Task 3 |
| §2.3 SupersetPickerModal edit mode | Task 3 |
| §2.4 superset block rendering | Task 5 Steps 1–3 |
| §2.4 Edit action | Task 5 Step 5 (onAdd edit branch) |
| §2.4 Ungroup action | Task 5 Step 4 |
| §2.4 "+ Add exercise to superset" | Task 5 Step 3 (opens edit modal) |
| §2.5 order_index management | Task 4 Step 5 (computeNextOrderIndex) |
| §3.1 updated wizard fetch | Task 6 Step 3 |
| §3.2 sessionItems model | Task 6 Step 4 |
| §3.3 step state shape | Task 6 Steps 5–7 |
| §3.4 superset round screen | Task 7 Step 2 |
| §3.4 rest screen | Task 7 Step 3 |
| §3.5 progress bar | Task 6 Steps 8–9 |
| §3.6 completion logging | Task 7 Step 4 |
| §5 label auto-assignment | Task 3 (getLetter helper) |
| §6 edge cases | Handled across Tasks 3 (min 2 guard), 5 (ungroup log guard), 7 (single-round no rest) |

All spec sections covered. No gaps.

**Placeholder scan:** No TBD, TODO, or incomplete steps. All code is concrete.

**Type consistency:**
- `buildSessionItems` defined in Task 2; consumed in Tasks 4 (SessionEdit) and 6 (SessionWizard) — signatures match.
- `computeNextOrderIndex(groups, exercises)` defined and called in Task 4 — used again in Task 5 Step 5 for modal prop — consistent.
- `updateSupersetSetField(itemIndex, exIndex, round, field, value)` defined in Task 7 Step 1; called in Task 7 Step 2 — consistent.
- `advanceSupersetRound(itemIndex)` defined in Task 7 Step 1; called in Task 7 Step 2 — consistent.
- `onAdd(group, newPeRows, removedPeIds)` signature defined in Task 3 (`handleCreate` passes 2 args, `handleEdit` passes 3); consumed in Task 5 Step 5 with `removedPeIds = []` default — consistent.
- `openVideoId` state added in Task 7 Step 2 note — must be added to SessionWizard state declarations in Task 6 Step 1. **Adding this now:** add `const [openVideoId, setOpenVideoId] = useState(null)` to Task 6 Step 2 (alongside `sessionItems` state).
