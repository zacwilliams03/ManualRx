# Tempo Prescription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow therapists to optionally prescribe a 4-phase movement tempo (e.g. `3-1-2-1`) per exercise; clients see a compact code with a tappable `?` that expands a plain-English breakdown; tempo flows through templates, session copies, and PDF exports.

**Architecture:** 4 nullable integer columns on `prescription_exercises` and `template_exercises`. A shared `formatTempo` utility converts raw values to compact and breakdown forms. All UI components import this utility — no inline formatting logic.

**Tech Stack:** React (Vite), Supabase (direct client), Vitest, @react-pdf/renderer, Tailwind (light use), inline styles (primary pattern in this codebase).

---

## File Map

| Action | File |
|--------|------|
| Create | `src/utils/formatTempo.js` |
| Create | `src/utils/formatTempo.test.js` |
| Modify | `src/components/therapist/ExercisePicker.jsx` |
| Modify | `src/pages/therapist/SessionEdit.jsx` |
| Modify | `src/pages/therapist/TemplateEdit.jsx` |
| Modify | `src/components/therapist/ApplyTemplateModal.jsx` |
| Modify | `src/pages/client/SessionWizard.jsx` |
| Modify | `src/components/therapist/PrescriptionPDF.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.jsx` |
| Modify | `src/components/therapist/ProgramPDF.jsx` |
| Modify | `src/pages/therapist/Prescribe.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.test.jsx` |
| DB     | Apply migration via Supabase dashboard |

---

## Task 1: Database Migration

**Files:**
- DB only — no source files

- [ ] **Step 1: Open Supabase dashboard SQL editor and run this migration**

```sql
ALTER TABLE prescription_exercises
  ADD COLUMN tempo_eccentric    integer,
  ADD COLUMN tempo_bottom_pause integer,
  ADD COLUMN tempo_concentric   integer,
  ADD COLUMN tempo_top_pause    integer;

ALTER TABLE template_exercises
  ADD COLUMN tempo_eccentric    integer,
  ADD COLUMN tempo_bottom_pause integer,
  ADD COLUMN tempo_concentric   integer,
  ADD COLUMN tempo_top_pause    integer;
```

- [ ] **Step 2: Verify in Supabase table editor**

Open `prescription_exercises` — confirm 4 new nullable integer columns. Repeat for `template_exercises`.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: apply tempo columns migration to prescription_exercises and template_exercises"
```

---

## Task 2: `formatTempo` Utility

**Files:**
- Create: `src/utils/formatTempo.js`
- Create: `src/utils/formatTempo.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/formatTempo.test.js`:

```js
import { formatTempo } from './formatTempo'

describe('formatTempo', () => {
  test('returns null when any value is null', () => {
    expect(formatTempo(null, 1, 2, 1)).toBeNull()
    expect(formatTempo(3, null, 2, 1)).toBeNull()
    expect(formatTempo(3, 1, null, 1)).toBeNull()
    expect(formatTempo(3, 1, 2, null)).toBeNull()
  })

  test('returns compact string for valid inputs', () => {
    expect(formatTempo(3, 1, 2, 1).compact).toBe('3-1-2-1')
    expect(formatTempo(4, 0, 2, 0).compact).toBe('4-0-2-0')
  })

  test('returns 4-item breakdown array with correct labels', () => {
    const { breakdown } = formatTempo(3, 1, 2, 1)
    expect(breakdown).toHaveLength(4)
    expect(breakdown[0]).toEqual({ value: 3, label: 'sec on the way down' })
    expect(breakdown[1]).toEqual({ value: 1, label: 'sec hold at the bottom' })
    expect(breakdown[2]).toEqual({ value: 2, label: 'sec on the way up' })
    expect(breakdown[3]).toEqual({ value: 1, label: 'sec hold at the top' })
  })

  test('allows zero for pause phases', () => {
    const result = formatTempo(3, 0, 2, 0)
    expect(result).not.toBeNull()
    expect(result.compact).toBe('3-0-2-0')
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test formatTempo
```

Expected: 4 failures — `formatTempo` is not defined.

- [ ] **Step 3: Create the utility**

Create `src/utils/formatTempo.js`:

```js
export function formatTempo(eccentric, bottomPause, concentric, topPause) {
  if ([eccentric, bottomPause, concentric, topPause].some(v => v == null)) return null
  return {
    compact: `${eccentric}-${bottomPause}-${concentric}-${topPause}`,
    breakdown: [
      { value: eccentric,   label: 'sec on the way down' },
      { value: bottomPause, label: 'sec hold at the bottom' },
      { value: concentric,  label: 'sec on the way up' },
      { value: topPause,    label: 'sec hold at the top' },
    ],
  }
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npm test formatTempo
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatTempo.js src/utils/formatTempo.test.js
git commit -m "feat: add formatTempo utility"
```

---

## Task 3: ExercisePicker — Tempo Toggle + Validation + Extended `onAdd`

**Files:**
- Modify: `src/components/therapist/ExercisePicker.jsx`

- [ ] **Step 1: Add import for `formatTempo`**

At the top of `ExercisePicker.jsx`, after the existing imports, add:

```js
import { formatTempo } from '../../utils/formatTempo'
```

- [ ] **Step 2: Add tempo state variables**

After the existing `const [addError, setAddError] = useState(null)` (line 47), add:

```js
const [configTempoEnabled, setConfigTempoEnabled] = useState(false)
const [configTempoDown, setConfigTempoDown] = useState('')
const [configTempoHold, setConfigTempoHold] = useState('')
const [configTempoUp, setConfigTempoUp] = useState('')
const [configTempoTop, setConfigTempoTop] = useState('')
```

- [ ] **Step 3: Reset tempo state in `selectExercise`**

`selectExercise` currently ends with `setPickerView('configure')`. Before that line, add:

```js
setConfigTempoEnabled(false)
setConfigTempoDown('')
setConfigTempoHold('')
setConfigTempoUp('')
setConfigTempoTop('')
```

- [ ] **Step 4: Replace `handleConfirmAdd` with validated version**

Replace the entire `handleConfirmAdd` function (lines 94–115) with:

```js
async function handleConfirmAdd() {
  setAddError(null)

  if (configTempoEnabled) {
    const e = parseInt(configTempoDown)
    const b = parseInt(configTempoHold)
    const c = parseInt(configTempoUp)
    const t = parseInt(configTempoTop)
    const valid =
      !isNaN(e) && !isNaN(b) && !isNaN(c) && !isNaN(t) &&
      e >= 1 && e <= 9 && c >= 1 && c <= 9 &&
      b >= 0 && b <= 9 && t >= 0 && t <= 9
    if (!valid) {
      setAddError('Tempo: down and up must be 1–9; hold and top must be 0–9.')
      return
    }
  }

  setAdding(true)
  try {
    await onAdd({
      exerciseId: pickerExercise.id,
      sets: parseInt(configSets) || null,
      reps: parseInt(configReps) || null,
      weight: configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null,
      notes: configNotes.trim() || null,
      measurementType: configMeasurementType,
      bilateral: configBilateral,
      tempoEccentric:   configTempoEnabled ? parseInt(configTempoDown) : null,
      tempoBottomPause: configTempoEnabled ? parseInt(configTempoHold) : null,
      tempoConcentric:  configTempoEnabled ? parseInt(configTempoUp)   : null,
      tempoTopPause:    configTempoEnabled ? parseInt(configTempoTop)   : null,
    })
    setPickerView('browse')
    setPickerExercise(null)
    setSearch('')
  } catch (e) {
    setAddError(e.message || 'Failed to add exercise')
  } finally {
    setAdding(false)
  }
}
```

- [ ] **Step 5: Add tempo section to configure step JSX**

In the configure step JSX (around line 308), replace the bilateral label and notes field section. The bilateral checkbox is currently:

```jsx
{/* Bilateral checkbox */}
<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
```

Add the following **after** the bilateral `<label>` closing tag and **before** the notes `<div>`:

```jsx
{/* Tempo — optional */}
<div>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: configTempoEnabled ? '8px' : 0 }}>
    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)' }}>
      Tempo <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
    </span>
    <button
      type="button"
      onClick={() => setConfigTempoEnabled(v => !v)}
      style={{
        width: '32px', height: '18px', borderRadius: '9px', border: 'none',
        cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s',
        background: configTempoEnabled ? '#29B5CC' : 'var(--color-border)',
      }}
    >
      <span style={{
        display: 'block', width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '2px', transition: 'left 0.15s',
        left: configTempoEnabled ? '16px' : '2px',
      }} />
    </button>
  </div>
  {configTempoEnabled && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <input type="number" min={1} max={9} value={configTempoDown} onChange={e => setConfigTempoDown(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px' }} />
          <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>DOWN</span>
        </div>
        <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '20px' }}>—</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <input type="number" min={0} max={9} value={configTempoHold} onChange={e => setConfigTempoHold(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px' }} />
          <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HOLD</span>
        </div>
        <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '20px' }}>—</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <input type="number" min={1} max={9} value={configTempoUp} onChange={e => setConfigTempoUp(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px' }} />
          <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UP</span>
        </div>
        <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '20px' }}>—</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <input type="number" min={0} max={9} value={configTempoTop} onChange={e => setConfigTempoTop(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px' }} />
          <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOP</span>
        </div>
      </div>
      {(() => {
        const e = parseInt(configTempoDown), b = parseInt(configTempoHold)
        const c = parseInt(configTempoUp), t = parseInt(configTempoTop)
        if ([e, b, c, t].some(isNaN)) return null
        const tempo = formatTempo(e, b, c, t)
        return tempo ? (
          <p style={{ margin: 0, fontSize: '11px', color: '#29B5CC', fontStyle: 'italic', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
            {tempo.breakdown.map(ph => `${ph.value}s ${ph.label}`).join(' · ')}
          </p>
        ) : null
      })()}
    </div>
  )}
</div>
```

- [ ] **Step 6: Run existing tests to check for regressions**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/therapist/ExercisePicker.jsx
git commit -m "feat: add tempo toggle and inputs to ExercisePicker"
```

---

## Task 4: SessionEdit — Tempo in Queries, Display Badge, and Edit Form

**Files:**
- Modify: `src/pages/therapist/SessionEdit.jsx`

- [ ] **Step 1: Add import for `formatTempo`**

After the existing imports at the top of `SessionEdit.jsx`, add:

```js
import { formatTempo } from '../../utils/formatTempo'
```

- [ ] **Step 2: Add `saveEditError` state**

After `const [savingEdit, setSavingEdit] = useState(false)` (line 38), add:

```js
const [saveEditError, setSaveEditError] = useState(null)
```

- [ ] **Step 3: Update `fetchData` select**

In `fetchData`, change the `prescription_exercises` select (line 50) from:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
```

to:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
```

- [ ] **Step 4: Update `handleAddExercise` to accept and insert tempo fields**

Replace the entire `handleAddExercise` function (lines 100–117) with:

```js
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
```

- [ ] **Step 5: Update `startEdit` to include tempo fields**

Replace the `startEdit` function (lines 124–132) with:

```js
function startEdit(pe) {
  setEditingId(pe.id)
  setSaveEditError(null)
  setEditValues({
    sets: String(pe.sets),
    reps: String(pe.reps),
    weight: pe.weight ? String(fromCanonical(pe.weight, weightUnit)) : '',
    notes: pe.therapist_notes ?? '',
    tempoEnabled: pe.tempo_eccentric != null,
    tempoDown: pe.tempo_eccentric != null ? String(pe.tempo_eccentric) : '',
    tempoHold: pe.tempo_bottom_pause != null ? String(pe.tempo_bottom_pause) : '',
    tempoUp: pe.tempo_concentric != null ? String(pe.tempo_concentric) : '',
    tempoTop: pe.tempo_top_pause != null ? String(pe.tempo_top_pause) : '',
  })
}
```

- [ ] **Step 6: Replace `saveEdit` with validated version**

Replace the entire `saveEdit` function (lines 134–154) with:

```js
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
  if (!updateError) {
    setExercises(prev => prev.map(e => e.id === peId ? data : e))
    setEditingId(null)
  }
}
```

- [ ] **Step 7: Add tempo badge to display mode**

In the display mode section (the `else` branch of `editingId === pe.id`), find the stats line:

```jsx
<div style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>
  {pe.sets} sets × {pe.reps} ...
  {pe.bilateral ? ' · Both sides' : ''}
</div>
```

After that `</div>`, add:

```jsx
{(() => {
  const t = formatTempo(pe.tempo_eccentric, pe.tempo_bottom_pause, pe.tempo_concentric, pe.tempo_top_pause)
  return t ? (
    <span style={{ display: 'inline-block', marginTop: '3px', background: 'rgba(41,181,204,0.1)', border: '1px solid rgba(41,181,204,0.2)', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', color: '#29B5CC', fontFamily: 'monospace', fontWeight: 600 }}>
      ⏱ {t.compact}
    </span>
  ) : null
})()}
```

- [ ] **Step 8: Add tempo section to edit mode form**

In the edit mode section, after the notes `<input>` and before the `<div style={{ display: 'flex', gap: '8px' }}>` buttons row, add:

```jsx
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
```

- [ ] **Step 9: Run existing tests to check for regressions**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 10: Commit**

```bash
git add src/pages/therapist/SessionEdit.jsx
git commit -m "feat: add tempo to SessionEdit — display badge and edit form"
```

---

## Task 5: TemplateEdit — Tempo in Queries and Display

**Files:**
- Modify: `src/pages/therapist/TemplateEdit.jsx`

TemplateEdit has no inline edit UI — exercises can only be added or removed. Changes are: import, select, insert, and display badge.

- [ ] **Step 1: Add import**

At the top of `TemplateEdit.jsx`, after existing imports:

```js
import { formatTempo } from '../../utils/formatTempo'
```

- [ ] **Step 2: Update `fetchData` select**

In `fetchData`, change the `template_exercises` select (line 46) from:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
```

to:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
```

- [ ] **Step 3: Update `handleAddExercise` to accept and insert tempo fields**

Replace the entire `handleAddExercise` function (lines 94–110) with:

```js
async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral, tempoEccentric, tempoBottomPause, tempoConcentric, tempoTopPause }) {
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
    .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
    .single()
  if (insertError) throw new Error(insertError.message)
  setExercises(prev => [...prev, data])
}
```

- [ ] **Step 4: Add tempo badge to exercise display**

In the exercise display section, find the stats line (around line 278):

```jsx
<div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>
  {te.sets} sets × {te.reps} {te.measurement_type === 'seconds' ? 'sec' : 'reps'}
  {te.weight ? ` · ${formatWeight(te.weight, weightUnit)}` : ''}
  {te.bilateral ? ' · Both sides' : ''}
</div>
```

After this `</div>`, add:

```jsx
{(() => {
  const t = formatTempo(te.tempo_eccentric, te.tempo_bottom_pause, te.tempo_concentric, te.tempo_top_pause)
  return t ? (
    <span style={{ display: 'inline-block', marginTop: '3px', background: 'rgba(41,181,204,0.1)', border: '1px solid rgba(41,181,204,0.2)', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', color: '#29B5CC', fontFamily: 'monospace', fontWeight: 600 }}>
      ⏱ {t.compact}
    </span>
  ) : null
})()}
```

- [ ] **Step 5: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/pages/therapist/TemplateEdit.jsx
git commit -m "feat: add tempo to TemplateEdit"
```

---

## Task 6: ApplyTemplateModal — Fix Template Copy Paths

**Files:**
- Modify: `src/components/therapist/ApplyTemplateModal.jsx`

- [ ] **Step 1: Update `fetchTemplates` select to include tempo columns**

In `fetchTemplates` (around line 40), change the `template_exercises` nested select from:

```js
template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name))
```

to:

```js
template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(name))
```

- [ ] **Step 2: Update `startCustomise` to carry tempo through to the editable state**

In `startCustomise` (around line 57), the `initial` mapping currently ends with `bilateral: te.bilateral ?? false`. Add 4 more fields after it:

```js
tempoEccentric:   te.tempo_eccentric    ?? null,
tempoBottomPause: te.tempo_bottom_pause ?? null,
tempoConcentric:  te.tempo_concentric   ?? null,
tempoTopPause:    te.tempo_top_pause    ?? null,
```

- [ ] **Step 3: Update `applyAsIs` exerciseRows to include tempo**

In `applyAsIs` (around line 116), the `exerciseRows` map currently ends with `bilateral: te.bilateral ?? false`. Add 4 fields after it:

```js
tempo_eccentric:    te.tempo_eccentric    ?? null,
tempo_bottom_pause: te.tempo_bottom_pause ?? null,
tempo_concentric:   te.tempo_concentric   ?? null,
tempo_top_pause:    te.tempo_top_pause    ?? null,
```

- [ ] **Step 4: Update `applyCustomised` exerciseRows to include tempo**

In `applyCustomised` (around line 143), the `exerciseRows` map currently ends with `bilateral: ex.bilateral ?? false`. Add 4 fields after it:

```js
tempo_eccentric:    ex.tempoEccentric    ?? null,
tempo_bottom_pause: ex.tempoBottomPause  ?? null,
tempo_concentric:   ex.tempoConcentric   ?? null,
tempo_top_pause:    ex.tempoTopPause     ?? null,
```

- [ ] **Step 5: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/therapist/ApplyTemplateModal.jsx
git commit -m "feat: carry tempo through template-to-session copy in ApplyTemplateModal"
```

---

## Task 7: SessionWizard — Client Tempo Row with `?` Toggle

**Files:**
- Modify: `src/pages/client/SessionWizard.jsx`

- [ ] **Step 1: Add import for `formatTempo`**

At the top of `SessionWizard.jsx`, after existing imports:

```js
import { formatTempo } from '../../utils/formatTempo'
```

- [ ] **Step 2: Add `showTempo` state**

Near the top of the component, with the other `useState` declarations, add:

```js
const [showTempo, setShowTempo] = useState(false)
```

- [ ] **Step 3: Update `prescription_exercises` select to include tempo columns**

In the `useEffect` or data-fetching code that selects from `prescription_exercises` (line 71), change from:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
```

to:

```js
.select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(id, name, category, video_url)')
```

- [ ] **Step 4: Reset `showTempo` on exercise step change**

Find where the exercise step changes (the "next exercise" or step navigation handler). Add `setShowTempo(false)` inside that handler before the step increment. This prevents the breakdown panel from staying open on the next exercise.

- [ ] **Step 5: Add tempo row to the exercise view**

In the exercise view JSX, find where `ex.bilateral` is rendered (around line 399):

```jsx
{ex.bilateral && (
  <div style={{ background: 'rgba(41,181,204,0.06)', ...
```

After the bilateral block and before the `{ex.therapist_notes && ...}` block, add:

```jsx
{(() => {
  const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause)
  if (!t) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Tempo</span>
        <span style={{ fontSize: '13px', color: 'var(--color-text)', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>{t.compact}</span>
        <button
          type="button"
          onClick={() => setShowTempo(v => !v)}
          style={{
            width: '18px', height: '18px', borderRadius: '50%', border: '1px solid rgba(41,181,204,0.3)',
            background: showTempo ? 'rgba(41,181,204,0.2)' : 'rgba(41,181,204,0.08)',
            color: '#29B5CC', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
          }}
        >
          ?
        </button>
      </div>
      {showTempo && (
        <div style={{ marginTop: '8px', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '10px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
            {t.breakdown.map(ph => (
              <React.Fragment key={ph.label}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#29B5CC' }}>{ph.value}</span>
                <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{ph.label}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})()}
```

Ensure `React` is imported (it must be in scope for `React.Fragment`). If the file uses named imports only (e.g. `import { useState } from 'react'`), change to `import React, { useState, ... } from 'react'`.

- [ ] **Step 6: Run existing tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: add tempo row with expandable breakdown to SessionWizard"
```

---

## Task 8: PDF Components and Prescribe.jsx Data Fetches

**Files:**
- Modify: `src/components/therapist/PrescriptionPDF.jsx`
- Modify: `src/components/therapist/AllSessionsPDF.jsx`
- Modify: `src/components/therapist/ProgramPDF.jsx`
- Modify: `src/pages/therapist/Prescribe.jsx`
- Modify: `src/components/therapist/AllSessionsPDF.test.jsx`

### 8a — Add tempo to PDF render components

- [ ] **Step 1: Update `PrescriptionPDF.jsx`**

Add import after the existing imports:

```js
import { formatTempo } from '../../utils/formatTempo'
```

In the exercise loop (around line 128), the `<Text style={styles.exerciseMeta}>` block currently ends with `{ex.bilateral ? ' — Both sides' : ''}`. Add to the end of that Text's content:

```jsx
{(() => { const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause); return t ? ` — Tempo: ${t.compact}` : '' })()}
```

The full updated Text becomes:

```jsx
<Text style={styles.exerciseMeta}>
  {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
  {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
  {ex.bilateral ? ' — Both sides' : ''}
  {(() => { const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause); return t ? ` — Tempo: ${t.compact}` : '' })()}
</Text>
```

- [ ] **Step 2: Update `AllSessionsPDF.jsx`**

Same two changes as Step 1 but in `AllSessionsPDF.jsx`:

```js
import { formatTempo } from '../../utils/formatTempo'
```

And the same IIFE appended to the exerciseMeta `<Text>` (around line 149).

- [ ] **Step 3: Update `ProgramPDF.jsx`**

Same two changes as Step 1 but in `ProgramPDF.jsx`:

```js
import { formatTempo } from '../../utils/formatTempo'
```

And the same IIFE appended to the exerciseMeta `<Text>` (around line 198).

### 8b — Update Prescribe.jsx data fetches

- [ ] **Step 4: Update `downloadPDF` select and map**

In `downloadPDF` (line 402), change the select from:

```js
.select('sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
```

to:

```js
.select('sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(name)')
```

In the `exercises` map (line 407), add 4 fields after `bilateral: pe.bilateral ?? false`:

```js
tempo_eccentric:    pe.tempo_eccentric    ?? null,
tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
tempo_concentric:   pe.tempo_concentric   ?? null,
tempo_top_pause:    pe.tempo_top_pause    ?? null,
```

- [ ] **Step 5: Update `downloadProgramPDF` select and map**

In `downloadProgramPDF` (line 447), change the select from:

```js
.select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
```

to:

```js
.select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(name)')
```

In the `exercisesByPrescription` push (line 455), add 4 fields after `bilateral: pe.bilateral ?? false`:

```js
tempo_eccentric:    pe.tempo_eccentric    ?? null,
tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
tempo_concentric:   pe.tempo_concentric   ?? null,
tempo_top_pause:    pe.tempo_top_pause    ?? null,
```

- [ ] **Step 6: Update `downloadAllPDF` select and map**

In `downloadAllPDF` (line 523), change the select from:

```js
.select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
```

to:

```js
.select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(name)')
```

In the `byId` push (line 531), add 4 fields after `bilateral: row.bilateral ?? false`:

```js
tempo_eccentric:    row.tempo_eccentric    ?? null,
tempo_bottom_pause: row.tempo_bottom_pause ?? null,
tempo_concentric:   row.tempo_concentric   ?? null,
tempo_top_pause:    row.tempo_top_pause    ?? null,
```

- [ ] **Step 7: Update `emailPDF` select and map**

In `emailPDF` (around line 581), change the select from:

```js
.select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
```

to:

```js
.select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, exercises(name)')
```

In the `byId` push (around line 590), add 4 fields after `bilateral: row.bilateral ?? false`:

```js
tempo_eccentric:    row.tempo_eccentric    ?? null,
tempo_bottom_pause: row.tempo_bottom_pause ?? null,
tempo_concentric:   row.tempo_concentric   ?? null,
tempo_top_pause:    row.tempo_top_pause    ?? null,
```

- [ ] **Step 9: Update reactivate session exercise copy**

In the reactivate copy function (around line 361–380), change the select from:

```js
.select('exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral')
```

to:

```js
.select('exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause')
```

In the `copies` map (line 369), add 4 fields after `bilateral: e.bilateral ?? false`:

```js
tempo_eccentric:    e.tempo_eccentric    ?? null,
tempo_bottom_pause: e.tempo_bottom_pause ?? null,
tempo_concentric:   e.tempo_concentric   ?? null,
tempo_top_pause:    e.tempo_top_pause    ?? null,
```

### 8c — Test the PDF change

- [ ] **Step 10: Write the failing test**

In `AllSessionsPDF.test.jsx`, add a new test at the end of the describe block:

```js
test('renders exercise with tempo without crashing', async () => {
  const props = {
    ...BASE_PROPS,
    prescriptions: [
      {
        name: 'Tempo Session',
        frequencyLabel: 'Daily',
        exercises: [
          {
            name: 'Romanian Deadlift',
            sets: 3, reps: 10, weight: 60,
            therapist_notes: null,
            measurement_type: 'reps',
            bilateral: false,
            tempo_eccentric: 3, tempo_bottom_pause: 1, tempo_concentric: 2, tempo_top_pause: 1,
          },
        ],
      },
    ],
  }
  const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBeGreaterThan(0)
})

test('renders exercise without tempo without crashing', async () => {
  const props = {
    ...BASE_PROPS,
    prescriptions: [
      {
        name: 'No Tempo Session',
        frequencyLabel: 'Daily',
        exercises: [
          {
            name: 'Squat',
            sets: 3, reps: 10, weight: 80,
            therapist_notes: null,
            measurement_type: 'reps',
            bilateral: false,
            tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
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

- [ ] **Step 11: Run to verify tests fail**

```bash
npm test AllSessionsPDF
```

Expected: 2 new failures — `formatTempo` not yet imported in AllSessionsPDF.

(If they pass before Step 3 changes were made, that means the PDF component is not yet importing formatTempo — check Step 2 was applied.)

- [ ] **Step 12: Run after all 8a–8b changes are in**

```bash
npm test
```

Expected: all tests pass including the 2 new tempo tests.

- [ ] **Step 13: Commit**

```bash
git add src/components/therapist/PrescriptionPDF.jsx \
        src/components/therapist/AllSessionsPDF.jsx \
        src/components/therapist/ProgramPDF.jsx \
        src/pages/therapist/Prescribe.jsx \
        src/components/therapist/AllSessionsPDF.test.jsx
git commit -m "feat: add tempo to PDF exports and data fetches"
```
