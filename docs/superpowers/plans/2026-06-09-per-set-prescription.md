# Per-Set Prescription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow therapists to optionally prescribe different reps and weight per set of an exercise, flowing through all copy paths, the client session wizard, and PDF exports.

**Architecture:** Two new child tables (`prescription_exercise_sets`, `template_exercise_sets`) store per-set rows. Per-set mode is detected by the presence of child rows — no flag column. A shared `formatPerSetSummary` utility handles all display formatting. All copy paths (ApplyTemplateModal, ApplyProgramTemplateModal, ProgramEdit week copy, Prescribe reactivate) switch from bulk inserts to per-exercise loops to capture IDs for child row insertion.

**Tech Stack:** React (Vite), Supabase JS client, Vitest, @react-pdf/renderer, inline styles (primary pattern).

---

## File Map

| Action | File |
|--------|------|
| DB | Migration: `prescription_exercise_sets`, `template_exercise_sets`, RLS |
| Create | `src/utils/formatPerSetSummary.js` |
| Create | `src/utils/formatPerSetSummary.test.js` |
| Modify | `src/components/therapist/ExercisePicker.jsx` |
| Modify | `src/pages/therapist/SessionEdit.jsx` |
| Modify | `src/pages/therapist/TemplateEdit.jsx` |
| Modify | `src/components/therapist/ApplyTemplateModal.jsx` |
| Modify | `src/components/therapist/ApplyProgramTemplateModal.jsx` |
| Modify | `src/pages/therapist/ProgramEdit.jsx` |
| Modify | `src/pages/therapist/Prescribe.jsx` |
| Modify | `src/pages/client/SessionWizard.jsx` |
| Modify | `src/components/therapist/PrescriptionPDF.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.jsx` |
| Modify | `src/components/therapist/ProgramPDF.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.test.jsx` |

---

## Task 1: Database Migration

**Files:** DB only — no source files

- [ ] **Step 1: Run the following SQL in the Supabase dashboard SQL editor**

```sql
CREATE TABLE prescription_exercise_sets (
  id                       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_exercise_id uuid    NOT NULL REFERENCES prescription_exercises(id) ON DELETE CASCADE,
  set_number               integer NOT NULL,
  reps                     integer NOT NULL,
  weight                   float8   -- canonical kg (same scale as prescription_exercises.weight); NULL = bodyweight
);

CREATE TABLE template_exercise_sets (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  template_exercise_id uuid    NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  set_number           integer NOT NULL,
  reps                 integer NOT NULL,
  weight               float8
);

-- RLS: prescription_exercise_sets
ALTER TABLE prescription_exercise_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist full access" ON prescription_exercise_sets
  USING (
    EXISTS (
      SELECT 1 FROM prescription_exercises pe
      JOIN prescriptions p ON p.id = pe.prescription_id
      WHERE pe.id = prescription_exercise_sets.prescription_exercise_id
        AND p.therapist_id = auth.uid()
    )
  );

CREATE POLICY "client read own" ON prescription_exercise_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prescription_exercises pe
      JOIN prescriptions p ON p.id = pe.prescription_id
      JOIN clients c ON c.id = p.client_id
      WHERE pe.id = prescription_exercise_sets.prescription_exercise_id
        AND c.user_id = auth.uid()
    )
  );

-- RLS: template_exercise_sets
ALTER TABLE template_exercise_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist full access" ON template_exercise_sets
  USING (
    EXISTS (
      SELECT 1 FROM template_exercises te
      JOIN templates t ON t.id = te.template_id
      WHERE te.id = template_exercise_sets.template_exercise_id
        AND t.therapist_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Verify in Supabase Table Editor**

Open `prescription_exercise_sets` — confirm columns `id`, `prescription_exercise_id`, `set_number`, `reps`, `weight`. Repeat for `template_exercise_sets`.

- [ ] **Step 3: Commit (empty — DB only)**

```bash
git commit --allow-empty -m "feat: create prescription_exercise_sets and template_exercise_sets tables with RLS"
```

---

## Task 2: `formatPerSetSummary` Utility (TDD)

**Files:**
- Create: `src/utils/formatPerSetSummary.js`
- Create: `src/utils/formatPerSetSummary.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/formatPerSetSummary.test.js`:

```js
import { formatPerSetSummary } from './formatPerSetSummary'

describe('formatPerSetSummary', () => {
  test('returns empty string for null or empty sets', () => {
    expect(formatPerSetSummary(null, 'kg')).toBe('')
    expect(formatPerSetSummary([], 'kg')).toBe('')
  })

  test('compact: reps×weight with unit at end', () => {
    const sets = [
      { set_number: 1, reps: 10, weight: 40 },
      { set_number: 2, reps: 8,  weight: 55 },
      { set_number: 3, reps: 6,  weight: 70 },
    ]
    expect(formatPerSetSummary(sets, 'kg')).toBe('10×40 · 8×55 · 6×70 kg')
  })

  test('compact: all bodyweight shows reps only', () => {
    const sets = [
      { set_number: 1, reps: 12, weight: null },
      { set_number: 2, reps: 10, weight: null },
    ]
    expect(formatPerSetSummary(sets, 'kg')).toBe('12 · 10 reps')
  })

  test('compact: mixed bodyweight and weighted uses BW placeholder', () => {
    const sets = [
      { set_number: 1, reps: 10, weight: null },
      { set_number: 2, reps: 8,  weight: 20 },
    ]
    expect(formatPerSetSummary(sets, 'kg')).toBe('10×BW · 8×20 kg')
  })

  test('pdf: builds Set N: reps × weight format', () => {
    const sets = [
      { set_number: 1, reps: 10, weight: 40 },
      { set_number: 2, reps: 8,  weight: 55 },
    ]
    expect(formatPerSetSummary(sets, 'kg', { pdf: true }))
      .toBe('Set 1: 10 × 40 kg  ·  Set 2: 8 × 55 kg')
  })

  test('pdf: omits weight when null', () => {
    const sets = [{ set_number: 1, reps: 12, weight: null }]
    expect(formatPerSetSummary(sets, 'kg', { pdf: true })).toBe('Set 1: 12 reps')
  })

  test('compact: single set', () => {
    const sets = [{ set_number: 1, reps: 10, weight: 60 }]
    expect(formatPerSetSummary(sets, 'kg')).toBe('10×60 kg')
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test formatPerSetSummary
```

Expected: 7 failures — `formatPerSetSummary` not defined.

- [ ] **Step 3: Create the utility**

Create `src/utils/formatPerSetSummary.js`:

```js
import { fromCanonical } from './weightUtils'

export function formatPerSetSummary(sets, weightUnit, { pdf = false } = {}) {
  if (!sets?.length) return ''

  if (pdf) {
    return sets.map(s => {
      if (s.weight != null) {
        const w = parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1))
        return `Set ${s.set_number}: ${s.reps} × ${w} ${weightUnit}`
      }
      return `Set ${s.set_number}: ${s.reps} reps`
    }).join('  ·  ')
  }

  const allBodyweight = sets.every(s => s.weight == null)
  if (allBodyweight) {
    return sets.map(s => s.reps).join(' · ') + ' reps'
  }

  const parts = sets.map(s => {
    const w = s.weight != null
      ? String(parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1)))
      : 'BW'
    return `${s.reps}×${w}`
  })
  return `${parts.join(' · ')} ${weightUnit}`
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npm test formatPerSetSummary
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatPerSetSummary.js src/utils/formatPerSetSummary.test.js
git commit -m "feat: add formatPerSetSummary utility"
```

---

## Task 3: ExercisePicker — Per-Set Toggle + Row Table

**Files:**
- Modify: `src/components/therapist/ExercisePicker.jsx`

- [ ] **Step 1: Add import and new state variables**

After the existing `import { formatTempo } from '../../utils/formatTempo'` line, add:

```js
import { formatPerSetSummary } from '../../utils/formatPerSetSummary'
```

After `const [configTempoTop, setConfigTempoTop] = useState('')` (last tempo state var), add:

```js
const [configPerSetEnabled, setConfigPerSetEnabled] = useState(false)
const [configPerSetRows, setConfigPerSetRows] = useState([])
```

- [ ] **Step 2: Reset per-set state in `selectExercise`**

In `selectExercise`, before `setPickerView('configure')`, add:

```js
setConfigPerSetEnabled(false)
setConfigPerSetRows([])
```

- [ ] **Step 3: Add per-set validation to `handleConfirmAdd`**

In `handleConfirmAdd`, after `setAddError(null)` and before the tempo validation block, add:

```js
if (configPerSetEnabled) {
  if (configPerSetRows.length === 0) {
    setAddError('Per-set: at least one set is required.')
    return
  }
  const invalid = configPerSetRows.some(r => !r.reps || isNaN(parseInt(r.reps)) || parseInt(r.reps) < 1)
  if (invalid) {
    setAddError('Per-set: each set must have reps ≥ 1.')
    return
  }
}
```

- [ ] **Step 4: Update `onAdd` call in `handleConfirmAdd`**

Replace the existing `await onAdd({...})` call (the entire object literal) with:

```js
await onAdd({
  exerciseId: pickerExercise.id,
  sets: configPerSetEnabled ? configPerSetRows.length : (parseInt(configSets) || null),
  reps: configPerSetEnabled ? null : (parseInt(configReps) || null),
  weight: configPerSetEnabled ? null : (configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null),
  notes: configNotes.trim() || null,
  measurementType: configMeasurementType,
  bilateral: configBilateral,
  tempoEccentric:   configTempoEnabled ? parseInt(configTempoDown) : null,
  tempoBottomPause: configTempoEnabled ? parseInt(configTempoHold) : null,
  tempoConcentric:  configTempoEnabled ? parseInt(configTempoUp)   : null,
  tempoTopPause:    configTempoEnabled ? parseInt(configTempoTop)   : null,
  perSetSets: configPerSetEnabled
    ? configPerSetRows.map((r, i) => ({
        set_number: i + 1,
        reps: parseInt(r.reps),
        weight: r.weight !== '' && r.weight != null ? toCanonical(parseFloat(r.weight), weightUnit) : null,
      }))
    : null,
})
```

- [ ] **Step 5: Add per-set UI section to the configure step JSX**

In the configure step JSX, the bilateral checkbox is currently followed by the tempo section. Find the closing `</label>` of the bilateral checkbox and the opening `{/* Tempo — optional */}` comment. Insert the following between them:

```jsx
{/* Per-set weights & reps — optional */}
<div>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: configPerSetEnabled ? '8px' : 0 }}>
    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)' }}>
      Per-set weights & reps <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
    </span>
    <button
      type="button"
      onClick={() => {
        if (!configPerSetEnabled) {
          const n = Math.max(1, parseInt(configSets) || 1)
          const defaultReps = configReps || ''
          const defaultWeight = configWeight || ''
          setConfigPerSetRows(Array.from({ length: n }, () => ({ reps: defaultReps, weight: defaultWeight })))
        }
        setConfigPerSetEnabled(v => !v)
      }}
      style={{
        width: '32px', height: '18px', borderRadius: '9px', border: 'none',
        cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s',
        background: configPerSetEnabled ? '#29B5CC' : 'var(--color-border)',
      }}
    >
      <span style={{
        display: 'block', width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '2px', transition: 'left 0.15s',
        left: configPerSetEnabled ? '16px' : '2px',
      }} />
    </button>
  </div>
  {configPerSetEnabled && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 24px', gap: '6px', alignItems: 'center', padding: '0 2px' }}>
        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', textAlign: 'center' }}>Set</span>
        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', textAlign: 'center' }}>Reps</span>
        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', textAlign: 'center' }}>Wt ({weightUnit})</span>
        <span />
      </div>
      {configPerSetRows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 24px', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#29B5CC', textAlign: 'center', fontFamily: 'monospace' }}>{i + 1}</span>
          <input
            type="number" min="1" value={row.reps}
            onChange={e => setConfigPerSetRows(prev => prev.map((r, j) => j === i ? { ...r, reps: e.target.value } : r))}
            style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', padding: '6px 4px', colorScheme: 'dark' }}
          />
          <input
            type="number" min="0" step="0.5" value={row.weight} placeholder="BW"
            onChange={e => setConfigPerSetRows(prev => prev.map((r, j) => j === i ? { ...r, weight: e.target.value } : r))}
            style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', padding: '6px 4px', colorScheme: 'dark' }}
          />
          <button
            type="button"
            onClick={() => setConfigPerSetRows(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
            style={{ fontSize: '14px', color: configPerSetRows.length > 1 ? 'var(--color-muted)' : 'var(--color-border)', background: 'none', border: 'none', cursor: configPerSetRows.length > 1 ? 'pointer' : 'default', textAlign: 'center', padding: 0 }}
          >✕</button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setConfigPerSetRows(prev => [...prev, { reps: '', weight: '' }])}
        style={{ fontSize: '12px', padding: '6px', background: 'rgba(41,181,204,0.08)', border: '1px dashed rgba(41,181,204,0.3)', color: '#29B5CC', borderRadius: '6px', cursor: 'pointer' }}
      >
        + Add set
      </button>
      {(() => {
        const allValid = configPerSetRows.every(r => r.reps !== '' && !isNaN(parseInt(r.reps)))
        if (!allValid || configPerSetRows.length === 0) return null
        const canonical = configPerSetRows.map((r, i) => ({
          set_number: i + 1,
          reps: parseInt(r.reps),
          weight: r.weight !== '' && r.weight != null ? toCanonical(parseFloat(r.weight), weightUnit) : null,
        }))
        return (
          <p style={{ margin: 0, fontSize: '11px', color: '#29B5CC', fontStyle: 'italic', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
            {configPerSetRows.length} sets — {formatPerSetSummary(canonical, weightUnit)}
          </p>
        )
      })()}
    </div>
  )}
</div>
```

- [ ] **Step 6: Hide the Sets/Reps/Weight grid when per-set is ON**

Find the `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>` that wraps the three labelled inputs for Sets, Reps/Seconds, and Weight. This is the only `gridTemplateColumns: '1fr 1fr 1fr'` div in the configure step — it contains `<label>` elements with `configSets`, `configReps`, and `configWeight`. Wrap the entire div (from its opening `<div` to its closing `</div>`) in a conditional:

```jsx
{!configPerSetEnabled && (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
    {/* ... existing Sets, Reps/Seconds, Weight label+input blocks unchanged ... */}
  </div>
)}
```

- [ ] **Step 7: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add src/components/therapist/ExercisePicker.jsx
git commit -m "feat: add per-set toggle and row table to ExercisePicker"
```

---

## Task 4: SessionEdit — Fetch, Display Badge, and Edit Form

**Files:**
- Modify: `src/pages/therapist/SessionEdit.jsx`

- [ ] **Step 1: Update `fetchData` select**

In `fetchData`, change the `prescription_exercises` `.select(...)` from:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
```

to:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
```

- [ ] **Step 2: Update `handleAddExercise` signature and body**

Replace the entire `handleAddExercise` function with:

```js
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
    })
    .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
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
    const { data: fresh } = await supabase
      .from('prescription_exercises')
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      .eq('id', data.id)
      .single()
    setExercises(prev => [...prev, fresh])
  } else {
    setExercises(prev => [...prev, data])
  }
}
```

- [ ] **Step 3: Update `startEdit` to detect per-set rows**

Replace the entire `startEdit` function with:

```js
function startEdit(pe) {
  setEditingId(pe.id)
  setSaveEditError(null)
  const perSetRows = pe.prescription_exercise_sets ?? []
  setEditValues({
    sets: String(pe.sets),
    reps: String(pe.reps ?? ''),
    weight: pe.weight ? String(parseFloat(fromCanonical(pe.weight, weightUnit).toFixed(1))) : '',
    notes: pe.therapist_notes ?? '',
    tempoEnabled: pe.tempo_eccentric != null && pe.tempo_bottom_pause != null && pe.tempo_concentric != null && pe.tempo_top_pause != null,
    tempoDown: pe.tempo_eccentric != null ? String(pe.tempo_eccentric) : '',
    tempoHold: pe.tempo_bottom_pause != null ? String(pe.tempo_bottom_pause) : '',
    tempoUp: pe.tempo_concentric != null ? String(pe.tempo_concentric) : '',
    tempoTop: pe.tempo_top_pause != null ? String(pe.tempo_top_pause) : '',
    perSetEnabled: perSetRows.length > 0,
    perSetRows: perSetRows
      .sort((a, b) => a.set_number - b.set_number)
      .map(s => ({
        reps: String(s.reps),
        weight: s.weight != null ? String(parseFloat(fromCanonical(s.weight, weightUnit).toFixed(1))) : '',
      })),
  })
}
```

- [ ] **Step 4: Replace `saveEdit` with validated per-set version**

Replace the entire `saveEdit` function with:

```js
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
      sets: setsCount,
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
  const { data: fresh } = await supabase
    .from('prescription_exercises')
    .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
    .eq('id', peId)
    .single()

  setSavingEdit(false)
  setExercises(prev => prev.map(e => e.id === peId ? fresh : e))
  setEditingId(null)
}
```

- [ ] **Step 5: Replace the display stats line with conditional mini-table**

In the display mode (the `else` branch of `editingId === pe.id`), find and replace the `<div style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>` stats line (the one showing sets × reps etc.) with:

```jsx
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
```

- [ ] **Step 6: Hide Sets/Reps/Weight edit inputs when per-set is ON and add per-set edit rows**

In the edit mode form, wrap the existing `<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>` row (Sets/Reps/Weight inputs) in a conditional:

```jsx
{!editValues.perSetEnabled && (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {/* ... existing Sets, Reps, Weight label+input groups unchanged ... */}
  </div>
)}
```

Then add this per-set section after the notes `<input>` and before the `{/* Tempo edit */}` block:

```jsx
{/* Per-set edit */}
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
```

- [ ] **Step 7: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add src/pages/therapist/SessionEdit.jsx
git commit -m "feat: add per-set display badge and edit form to SessionEdit"
```

---

## Task 5: TemplateEdit — Fetch, Display Badge, and Add

**Files:**
- Modify: `src/pages/therapist/TemplateEdit.jsx`

TemplateEdit has no inline edit UI — exercises are display-only with a Remove button. Changes: fetch, handleAddExercise, display badge.

- [ ] **Step 1: Update `fetchData` select**

In `fetchData`, change the `template_exercises` `.select(...)` from:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
```

to:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
```

- [ ] **Step 2: Update `handleAddExercise`**

Replace the entire `handleAddExercise` function with:

```js
async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral, tempoEccentric, tempoBottomPause, tempoConcentric, tempoTopPause, perSetSets }) {
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
    })
    .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
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
    const { data: fresh } = await supabase
      .from('template_exercises')
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, template_exercise_sets(id, set_number, reps, weight), exercises(id, name, category, video_url)')
      .eq('id', data.id)
      .single()
    setExercises(prev => [...prev, fresh])
  } else {
    setExercises(prev => [...prev, data])
  }
}
```

- [ ] **Step 3: Add mini-table display to exercise list**

In the exercise list, find the stats `<div>` (the one showing `{te.sets} sets × {te.reps}...`) and replace it and the tempo badge block with:

```jsx
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
```

- [ ] **Step 4: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/TemplateEdit.jsx
git commit -m "feat: add per-set display and add to TemplateEdit"
```

---

## Task 6: ApplyTemplateModal — Carry Per-Set Through Template Copy

**Files:**
- Modify: `src/components/therapist/ApplyTemplateModal.jsx`

- [ ] **Step 1: Update `fetchTemplates` select**

In `fetchTemplates`, change the `template_exercises(...)` nested select from its current value to:

```js
template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, template_exercise_sets(id, set_number, reps, weight), exercises(name))
```

- [ ] **Step 2: Update `startCustomise` to carry per-set rows (but drop in customise path)**

In `startCustomise`, the `initial` mapping adds `tempoTopPause` at the end. After that field, add:

```js
hasPerSetRows: (te.template_exercise_sets ?? []).length > 0,
```

This flag is only used to display a note in the customise UI (see Step 3) — it is NOT passed through to `applyCustomised`.

- [ ] **Step 3: Add informational note in the customise UI**

In the customise step JSX, below the exercise name `<p>` and above the 3-column grid, add conditionally for exercises that had per-set rows:

```jsx
{ex.hasPerSetRows && (
  <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--color-muted)', fontStyle: 'italic' }}>
    Per-set configuration will be cleared — edit the session after applying if needed.
  </p>
)}
```

- [ ] **Step 4: Replace `applyAsIs` bulk insert with per-exercise loop**

Replace the entire body of `applyAsIs` (keeping the try/catch/finally wrapper) with:

```js
async function applyAsIs(tmpl) {
  const t = tmpl ?? selectedTemplate
  setApplying(true)
  setApplyError(null)
  try {
    const prescription = await createPrescription(t)
    for (const te of t.template_exercises ?? []) {
      const { data: pe, error: exErr } = await supabase
        .from('prescription_exercises')
        .insert({
          prescription_id: prescription.id,
          exercise_id: te.exercise_id,
          sets: te.sets,
          reps: te.reps,
          weight: te.weight,
          therapist_notes: te.therapist_notes,
          measurement_type: te.measurement_type ?? 'reps',
          bilateral: te.bilateral ?? false,
          tempo_eccentric:    te.tempo_eccentric    ?? null,
          tempo_bottom_pause: te.tempo_bottom_pause ?? null,
          tempo_concentric:   te.tempo_concentric   ?? null,
          tempo_top_pause:    te.tempo_top_pause    ?? null,
        })
        .select('id')
        .single()
      if (exErr) throw new Error(exErr.message)
      const sets = te.template_exercise_sets ?? []
      if (sets.length > 0) {
        const { error: setsErr } = await supabase.from('prescription_exercise_sets').insert(
          sets.map(s => ({
            prescription_exercise_id: pe.id,
            set_number: s.set_number,
            reps: s.reps,
            weight: s.weight ?? null,
          }))
        )
        if (setsErr) throw new Error(setsErr.message)
      }
    }
    onApplied()
  } catch (e) {
    setApplyError(e.message || 'Failed to apply template.')
  } finally {
    setApplying(false)
  }
}
```

- [ ] **Step 5: Confirm `applyCustomised` is intentionally unchanged**

`applyCustomised` still uses the bulk insert and does **not** insert per-set child rows. This is intentional: the customise flow presents flat Sets/Reps/Weight fields, so per-set rows are dropped when the user applies customised. The UI note added in Step 3 informs the user of this. Do NOT add per-exercise looping to `applyCustomised`.

- [ ] **Step 6: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/components/therapist/ApplyTemplateModal.jsx
git commit -m "feat: carry per-set rows through ApplyTemplateModal applyAsIs"
```

---

## Task 7: ApplyProgramTemplateModal — Fix Bulk Insert + Add Per-Set

**Files:**
- Modify: `src/components/therapist/ApplyProgramTemplateModal.jsx`

- [ ] **Step 1: Update the `template_exercises` select inside `handleApply`**

In `handleApply`, find the `supabase.from('template_exercises').select(...)` call and change the select string from:

```js
'exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral'
```

to:

```js
'exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, template_exercise_sets(set_number, reps, weight)'
```

- [ ] **Step 2: Replace the bulk exercise insert with a per-exercise loop**

Find and replace the block:

```js
if (templateExercises.length > 0) {
  const exerciseRows = templateExercises.map(te => ({...}))
  const { error: exErr } = await supabase.from('prescription_exercises').insert(exerciseRows)
  if (exErr) throw new Error(exErr.message)
}
```

with:

```js
for (const te of templateExercises) {
  const { data: pe, error: exErr } = await supabase
    .from('prescription_exercises')
    .insert({
      prescription_id: prescription.id,
      exercise_id: te.exercise_id,
      sets: te.sets,
      reps: te.reps,
      weight: te.weight,
      therapist_notes: te.therapist_notes,
      measurement_type: te.measurement_type ?? 'reps',
      bilateral: te.bilateral ?? false,
      tempo_eccentric:    te.tempo_eccentric    ?? null,
      tempo_bottom_pause: te.tempo_bottom_pause ?? null,
      tempo_concentric:   te.tempo_concentric   ?? null,
      tempo_top_pause:    te.tempo_top_pause    ?? null,
    })
    .select('id')
    .single()
  if (exErr) throw new Error(exErr.message)
  const sets = te.template_exercise_sets ?? []
  if (sets.length > 0) {
    const { error: setsErr } = await supabase.from('prescription_exercise_sets').insert(
      sets.map(s => ({
        prescription_exercise_id: pe.id,
        set_number: s.set_number,
        reps: s.reps,
        weight: s.weight ?? null,
      }))
    )
    if (setsErr) throw new Error(setsErr.message)
  }
}
```

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/therapist/ApplyProgramTemplateModal.jsx
git commit -m "feat: fix bulk insert and add per-set + tempo to ApplyProgramTemplateModal"
```

---

## Task 8: ProgramEdit — Fix `handleRepeatWeek` Per-Exercise Copy

**Files:**
- Modify: `src/pages/therapist/ProgramEdit.jsx`

- [ ] **Step 1: Update the `prescription_exercises` select in `handleRepeatWeek`**

In the `mode === 'program'` branch of `handleRepeatWeek`, change the `.select(...)` on `prescription_exercises` from:

```js
'exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral'
```

to:

```js
'exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight)'
```

- [ ] **Step 2: Replace the bulk exercise insert with a per-exercise loop**

Find and replace the block:

```js
if (exercises?.length > 0) {
  await supabase.from('prescription_exercises').insert(
    exercises.map(ex => ({ ...ex, prescription_id: newPrescription.id }))
  )
}
```

with:

```js
for (const ex of exercises ?? []) {
  const { data: newEx, error: exErr } = await supabase
    .from('prescription_exercises')
    .insert({
      prescription_id: newPrescription.id,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      therapist_notes: ex.therapist_notes,
      measurement_type: ex.measurement_type ?? 'reps',
      bilateral: ex.bilateral ?? false,
      tempo_eccentric:    ex.tempo_eccentric    ?? null,
      tempo_bottom_pause: ex.tempo_bottom_pause ?? null,
      tempo_concentric:   ex.tempo_concentric   ?? null,
      tempo_top_pause:    ex.tempo_top_pause    ?? null,
    })
    .select('id')
    .single()
  if (exErr) continue  // silent skip — intentional; matches existing handleRepeatWeek error handling
  const sets = ex.prescription_exercise_sets ?? []
  if (sets.length > 0) {
    // per-set insert failure is also silently swallowed — intentional, consistent with the rest of the loop
    await supabase.from('prescription_exercise_sets').insert(
      sets.map(s => ({
        prescription_exercise_id: newEx.id,
        set_number: s.set_number,
        reps: s.reps,
        weight: s.weight ?? null,
      }))
    )
  }
}
```

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/ProgramEdit.jsx
git commit -m "feat: carry per-set rows through handleRepeatWeek in ProgramEdit"
```

---

## Task 9: Prescribe.jsx — Reactivate Copy + PDF Download Fetches

**Files:**
- Modify: `src/pages/therapist/Prescribe.jsx`

### 9a — Reactivate copy

- [ ] **Step 1: Update the `prescription_exercises` select in `reactivatePrescription`**

Change the `.select(...)` from:

```js
'exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause'
```

to:

```js
'exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight)'
```

- [ ] **Step 2: Replace the bulk insert in `reactivatePrescription` with a per-exercise loop**

Find and replace the block:

```js
if (origExercises.length > 0) {
  const copies = origExercises.map(e => ({...}))
  const { error: copyError } = await supabase.from('prescription_exercises').insert(copies)
  if (copyError) { alert('Failed to copy exercises.'); setReactivating(null); return }
}
```

with:

```js
for (const e of origExercises) {
  const { data: newEx, error: exErr } = await supabase
    .from('prescription_exercises')
    .insert({
      prescription_id: newPrescription.id,
      exercise_id: e.exercise_id,
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      therapist_notes: e.therapist_notes,
      measurement_type: e.measurement_type ?? 'reps',
      bilateral: e.bilateral ?? false,
      tempo_eccentric:    e.tempo_eccentric    ?? null,
      tempo_bottom_pause: e.tempo_bottom_pause ?? null,
      tempo_concentric:   e.tempo_concentric   ?? null,
      tempo_top_pause:    e.tempo_top_pause    ?? null,
    })
    .select('id')
    .single()
  if (exErr) { alert('Failed to copy exercises.'); setReactivating(null); return }
  const sets = e.prescription_exercise_sets ?? []
  if (sets.length > 0) {
    await supabase.from('prescription_exercise_sets').insert(
      sets.map(s => ({
        prescription_exercise_id: newEx.id,
        set_number: s.set_number,
        reps: s.reps,
        weight: s.weight ?? null,
      }))
    )
  }
}
```

### 9b — PDF download fetch selects

- [ ] **Step 3: Update `downloadPDF` select**

In `downloadPDF`, change the `.select(...)` from:

```js
'sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(name)'
```

to:

```js
'sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)'
```

In the `exercises` map that follows, add after `tempo_top_pause: pe.tempo_top_pause ?? null,`:

```js
prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
```

- [ ] **Step 4: Update `downloadProgramPDF` select and map**

Same change as Step 3 but in `downloadProgramPDF`. The select and the push to `exercisesByPrescription` both need the addition.

In the select: add `prescription_exercise_sets(set_number, reps, weight)`.
In the push object: add `prescription_exercise_sets: pe.prescription_exercise_sets ?? [],`.

- [ ] **Step 5: Update `downloadAllPDF` select and map**

Same as Step 3 but in `downloadAllPDF`. The select and the `byId[...]` push both need the addition.

In the select: add `prescription_exercise_sets(set_number, reps, weight)`.
In the push object: add `prescription_exercise_sets: row.prescription_exercise_sets ?? [],`.

- [ ] **Step 6: Update `emailPDF` select and map**

Same as Step 3 but in `emailPDF`. The select and the `byId[...]` push both need the addition.

**Before editing:** read the actual `emailPDF` function in `Prescribe.jsx` and verify the current select string matches the anchor below. Prior plans updated `emailPDF` for `measurement_type`/`bilateral`/tempo — the current select may already include those fields. Match your edit to the actual current select string, not a prior-plan version.

In the select: add `prescription_exercise_sets(set_number, reps, weight)`.
In the push object: add `prescription_exercise_sets: row.prescription_exercise_sets ?? [],`.

- [ ] **Step 7: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx
git commit -m "feat: add per-set to Prescribe.jsx — reactivate copy and PDF fetch functions"
```

---

## Task 10: SessionWizard — Per-Set Target Display

**Files:**
- Modify: `src/pages/client/SessionWizard.jsx`

- [ ] **Step 1: Update `prescription_exercises` select**

In `fetchData`, change the `prescription_exercises` `.select(...)` from:

```js
'id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)'
```

to:

```js
'id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(id, name, category, video_url)'
```

- [ ] **Step 2: Sort per-set rows on exercise init**

In the `setExercises` call inside `fetchData`, change:

```js
setExercises(
  (exercisesRes.data ?? []).map(pe => ({
    ...pe,
    setsData: Array(pe.sets || 1).fill(null).map(() => ({ reps: '', weight: '' })),
    currentSet: 0,
    allSetsDone: false,
    painRating: null,
    clientNotes: '',
    videoFile: null,
  }))
)
```

to:

```js
setExercises(
  (exercisesRes.data ?? []).map(pe => ({
    ...pe,
    prescription_exercise_sets: [...(pe.prescription_exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number),
    setsData: Array(pe.sets || 1).fill(null).map(() => ({ reps: '', weight: '' })),
    currentSet: 0,
    allSetsDone: false,
    painRating: null,
    clientNotes: '',
    videoFile: null,
  }))
)
```

- [ ] **Step 3: Replace the target block with a conditional per-set view**

Find the target block in the exercise view JSX:

```jsx
<div style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 14px' }}>
  <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: '4px' }}>Target</p>
  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
    {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
    {ex.weight ? ` @ ${formatWeight(ex.weight, weightUnit)}` : ''}
  </p>
</div>
```

Replace it with:

```jsx
<div style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px 14px' }}>
  <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: '4px' }}>Target</p>
  {ex.prescription_exercise_sets?.length > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {ex.prescription_exercise_sets.map((s, i) => {
        const isDone = i < ex.currentSet
        const isCurrent = i === ex.currentSet
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px',
            background: isCurrent ? 'rgba(41,181,204,0.08)' : 'rgba(255,255,255,0.03)',
            border: isCurrent ? '1px solid rgba(41,181,204,0.25)' : '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: isCurrent ? '12px' : '11px', fontWeight: 700, color: isCurrent ? '#29B5CC' : '#555', fontFamily: 'monospace', width: '16px', textAlign: 'center' }}>
              {s.set_number}
            </span>
            <span style={{ fontSize: isCurrent ? '13px' : '12px', fontWeight: isCurrent ? 600 : 400, color: isCurrent ? 'var(--color-text)' : '#666', flex: 1 }}>
              {s.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
              {s.weight != null ? ` @ ${formatWeight(s.weight, weightUnit)}` : ''}
            </span>
            {isDone && <span style={{ fontSize: '11px', color: '#29B5CC', fontWeight: 600 }}>✓</span>}
            {isCurrent && <span style={{ fontSize: '11px', color: '#29B5CC' }}>← now</span>}
          </div>
        )
      })}
    </div>
  ) : (
    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
      {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
      {ex.weight ? ` @ ${formatWeight(ex.weight, weightUnit)}` : ''}
    </p>
  )}
</div>
```

- [ ] **Step 4: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: show per-set target list with current set highlighted in SessionWizard"
```

---

## Task 11: PDF Components + Test

**Files:**
- Modify: `src/components/therapist/PrescriptionPDF.jsx`
- Modify: `src/components/therapist/AllSessionsPDF.jsx`
- Modify: `src/components/therapist/ProgramPDF.jsx`
- Modify: `src/components/therapist/AllSessionsPDF.test.jsx`

### 11a — Write the failing tests first

- [ ] **Step 1: Add two per-set tests to `AllSessionsPDF.test.jsx`**

Append these tests at the end of the `describe` block:

```js
test('renders exercise with per-set rows without crashing', async () => {
  const props = {
    ...BASE_PROPS,
    prescriptions: [
      {
        name: 'Pyramid Session',
        frequencyLabel: 'Daily',
        exercises: [
          {
            name: 'Romanian Deadlift',
            sets: 3, reps: null, weight: null,
            therapist_notes: null, measurement_type: 'reps', bilateral: false,
            tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
            prescription_exercise_sets: [
              { set_number: 1, reps: 10, weight: 40 },
              { set_number: 2, reps: 8,  weight: 55 },
              { set_number: 3, reps: 6,  weight: 70 },
            ],
          },
        ],
      },
    ],
  }
  const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBeGreaterThan(0)
})

test('renders exercise with empty prescription_exercise_sets without crashing', async () => {
  const props = {
    ...BASE_PROPS,
    prescriptions: [
      {
        name: 'Normal Session',
        frequencyLabel: 'Daily',
        exercises: [
          {
            name: 'Squat',
            sets: 3, reps: 10, weight: 80,
            therapist_notes: null, measurement_type: 'reps', bilateral: false,
            tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
            prescription_exercise_sets: [],
          },
        ],
      },
    ],
  }
  const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to verify the new tests pass**

```bash
npm test AllSessionsPDF
```

Expected: all tests pass. These are **smoke tests** (crash-only guards), not strict TDD — the PDF component can't assert on rendered text content, so both tests pass even before the per-set rendering is added in Steps 3–5. Their purpose is to prevent regressions (ensure a per-set exercise object doesn't crash the component), not to assert per-set text appears in the output.

### 11b — Update PDF components

- [ ] **Step 3: Update `PrescriptionPDF.jsx`**

Add import after the existing imports:

```js
import { formatPerSetSummary } from '../../utils/formatPerSetSummary'
```

In the exercise loop, replace the `<Text style={styles.exerciseMeta}>` block with:

```jsx
{(() => {
  const perSet = ex.prescription_exercise_sets ?? []
  if (perSet.length > 0) {
    return (
      <Text style={styles.exerciseMeta}>
        {formatPerSetSummary(perSet, weightUnit, { pdf: true })}
      </Text>
    )
  }
  const tempo = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause)
  return (
    <Text style={styles.exerciseMeta}>
      {`${ex.sets} sets × ${ex.reps} ${ex.measurement_type === 'seconds' ? 'sec' : 'reps'}`}
      {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
      {ex.bilateral ? ' — Both sides' : ''}
      {tempo ? ` — Tempo: ${tempo.compact}` : ''}
    </Text>
  )
})()}
```

- [ ] **Step 4: Update `AllSessionsPDF.jsx`** — identical change to Step 3 applied to `AllSessionsPDF.jsx`.

Add the same `formatPerSetSummary` import. Replace the same `<Text style={styles.exerciseMeta}>` block with the same IIFE pattern.

- [ ] **Step 5: Update `ProgramPDF.jsx`** — identical change to Step 3 applied to `ProgramPDF.jsx`.

Add the same `formatPerSetSummary` import. Replace the same `<Text style={styles.exerciseMeta}>` block with the same IIFE pattern.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass including the 2 new per-set PDF tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/therapist/PrescriptionPDF.jsx \
        src/components/therapist/AllSessionsPDF.jsx \
        src/components/therapist/ProgramPDF.jsx \
        src/components/therapist/AllSessionsPDF.test.jsx
git commit -m "feat: add per-set rendering to PDF components and tests"
```
