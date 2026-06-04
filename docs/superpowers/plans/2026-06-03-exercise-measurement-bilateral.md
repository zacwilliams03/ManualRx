# Exercise Measurement Type & Bilateral Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow exercises to be prescribed in seconds (not just reps), and add a per-prescription "complete on both sides" flag that reminds clients to work each side for unilateral exercises.

**Architecture:** Add `is_timed`/`is_bilateral` defaults to the exercises library table, and `measurement_type`/`bilateral` overrides to `prescription_exercises` and `template_exercises`. The existing `reps` column doubles as a seconds value when `measurement_type = 'seconds'` — no new column needed. All display surfaces (ExercisePicker config, SessionWizard, Prescribe history, PDFs) branch on `measurement_type`.

**Tech Stack:** React + Vite, Supabase (no migration files — run SQL in dashboard), Vitest for tests, `@react-pdf/renderer` for PDFs.

---

## File Map

| File | Change |
|------|--------|
| Supabase dashboard SQL | Add 6 new columns across 3 tables |
| `src/components/therapist/ExercisePicker.jsx` | Measurement toggle + bilateral checkbox in configure view |
| `src/pages/therapist/ExerciseUpload.jsx` | is_timed toggle + is_bilateral checkbox when creating custom exercises |
| `src/pages/therapist/SessionEdit.jsx` | Accept + insert new fields; update exercise list display |
| `src/pages/therapist/TemplateEdit.jsx` | Same as SessionEdit but for `template_exercises` |
| `src/components/therapist/ApplyTemplateModal.jsx` | Carry new fields through "apply as-is" and "customise" flows |
| `src/pages/client/SessionWizard.jsx` | Timed inputs, bilateral reminder banner, updated set summaries |
| `src/pages/therapist/Prescribe.jsx` | History display, reactivation copy, PDF query updates |
| `src/components/therapist/PrescriptionPDF.jsx` | Updated exercise meta line + bilateral label |
| `src/components/therapist/AllSessionsPDF.jsx` | Same as PrescriptionPDF |
| `src/components/therapist/AllSessionsPDF.test.jsx` | Update fixtures + add timed/bilateral test cases |
| `src/pages/client/History.jsx` | Update exercise log display for timed exercises |

---

## Task 1: Database Migration

**Run this SQL in the Supabase dashboard (SQL Editor → New query):**

- [ ] **Step 1: Run the migration SQL**

```sql
-- Library defaults
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS is_timed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bilateral boolean NOT NULL DEFAULT false;

-- Per-prescription overrides
ALTER TABLE prescription_exercises
  ADD COLUMN IF NOT EXISTS measurement_type text NOT NULL DEFAULT 'reps'
    CHECK (measurement_type IN ('reps', 'seconds')),
  ADD COLUMN IF NOT EXISTS bilateral boolean NOT NULL DEFAULT false;

-- Per-template overrides (mirrors prescription_exercises)
ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS measurement_type text NOT NULL DEFAULT 'reps'
    CHECK (measurement_type IN ('reps', 'seconds')),
  ADD COLUMN IF NOT EXISTS bilateral boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Verify columns exist**

Run this in the SQL Editor to confirm:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('exercises', 'prescription_exercises', 'template_exercises')
  AND column_name IN ('is_timed', 'is_bilateral', 'measurement_type', 'bilateral')
ORDER BY table_name, column_name;
```

Expected: 6 rows returned, one for each new column.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: no-op placeholder — DB migration run in Supabase dashboard"
```

(Nothing to stage — this is a reminder commit.)

---

## Task 2: ExercisePicker — Measurement Type Toggle + Bilateral Checkbox

**File:** `src/components/therapist/ExercisePicker.jsx`

This is the most visible therapist-facing change. The configure view gains a Reps/Seconds toggle and a "Complete on both sides" checkbox. The reps input label changes dynamically; the underlying `configReps` state stores the value regardless of unit.

- [ ] **Step 1: Add two new state variables after `configNotes`**

Find:
```js
  const [configNotes, setConfigNotes] = useState('')
  const [adding, setAdding] = useState(false)
```

Replace with:
```js
  const [configNotes, setConfigNotes] = useState('')
  const [configMeasurementType, setConfigMeasurementType] = useState('reps')
  const [configBilateral, setConfigBilateral] = useState(false)
  const [adding, setAdding] = useState(false)
```

- [ ] **Step 2: Add `is_timed` and `is_bilateral` to both Supabase select queries**

In `runSearch`, find:
```js
      .select('id, name, category, categories, default_sets, default_reps, video_url')
```
Replace with:
```js
      .select('id, name, category, categories, default_sets, default_reps, is_timed, is_bilateral, video_url')
```

In `selectCategory`, find:
```js
    let query = supabase.from('exercises').select('id, name, category, categories, default_sets, default_reps, video_url')
```
Replace with:
```js
    let query = supabase.from('exercises').select('id, name, category, categories, default_sets, default_reps, is_timed, is_bilateral, video_url')
```

- [ ] **Step 3: Set defaults from exercise when entering configure view**

Find:
```js
  function selectExercise(ex) {
    setPickerExercise(ex)
    setConfigSets(String(ex.default_sets ?? 3))
    setConfigReps(String(ex.default_reps ?? 10))
    setConfigWeight('')
    setConfigNotes('')
    setAddError(null)
    setPickerView('configure')
  }
```

Replace with:
```js
  function selectExercise(ex) {
    setPickerExercise(ex)
    setConfigSets(String(ex.default_sets ?? 3))
    setConfigReps(String(ex.default_reps ?? 10))
    setConfigWeight('')
    setConfigNotes('')
    setConfigMeasurementType(ex.is_timed ? 'seconds' : 'reps')
    setConfigBilateral(ex.is_bilateral ?? false)
    setAddError(null)
    setPickerView('configure')
  }
```

- [ ] **Step 4: Update `handleConfirmAdd` to pass the new fields**

Find:
```js
      await onAdd({
        exerciseId: pickerExercise.id,
        sets: parseInt(configSets) || null,
        reps: parseInt(configReps) || null,
        weight: configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null,
        notes: configNotes.trim() || null,
      })
```

Replace with:
```js
      await onAdd({
        exerciseId: pickerExercise.id,
        sets: parseInt(configSets) || null,
        reps: parseInt(configReps) || null,
        weight: configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null,
        notes: configNotes.trim() || null,
        measurementType: configMeasurementType,
        bilateral: configBilateral,
      })
```

- [ ] **Step 5: Add the measurement toggle and bilateral checkbox in the configure view**

Find the configure panel's inner `<div>` that contains the 3-column grid:
```jsx
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Sets</label>
```

Replace the entire configure panel content (from the opening `<div style={{ padding: '16px 20px'...` down to just before `{addError &&...`) with:

```jsx
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Measurement type toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Measurement</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['reps', 'seconds'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfigMeasurementType(type)}
                    style={{
                      flex: 1, padding: '8px', fontSize: '12px', fontWeight: 500,
                      borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s',
                      border: configMeasurementType === type ? 'none' : '1px solid var(--color-border)',
                      background: configMeasurementType === type ? '#29B5CC' : 'var(--color-elevated)',
                      color: configMeasurementType === type ? '#000' : 'var(--color-muted)',
                    }}
                  >
                    {type === 'reps' ? 'Reps' : 'Seconds'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Sets</label>
                <input
                  type="number" min="1" value={configSets}
                  onChange={e => setConfigSets(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>
                  {configMeasurementType === 'seconds' ? 'Seconds' : 'Reps'}
                </label>
                <input
                  type="number" min="1" value={configReps}
                  onChange={e => setConfigReps(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Weight ({weightUnit})</label>
                <input
                  type="number" min="0" step="0.5" value={configWeight}
                  onChange={e => setConfigWeight(e.target.value)}
                  placeholder="optional"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Bilateral checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={configBilateral}
                onChange={e => setConfigBilateral(e.target.checked)}
                style={{ accentColor: '#29B5CC', width: '14px', height: '14px' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>Complete on both sides</span>
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>
                Notes for client <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
              </label>
              <input
                type="text" value={configNotes}
                onChange={e => setConfigNotes(e.target.value)}
                placeholder="e.g. keep back straight, stop if painful"
                style={inputStyle}
              />
            </div>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/therapist/ExercisePicker.jsx
git commit -m "feat: add measurement type toggle and bilateral checkbox to ExercisePicker"
```

---

## Task 3: ExerciseUpload — Library Defaults for Custom Exercises

**File:** `src/pages/therapist/ExerciseUpload.jsx`

When a therapist creates a custom exercise, they can now set whether it defaults to reps or seconds, and whether it defaults to bilateral.

- [ ] **Step 1: Add two state variables after `defaultReps`**

Find:
```js
  const [defaultReps, setDefaultReps] = useState('')
  const [videoFile, setVideoFile] = useState(null)
```
Replace with:
```js
  const [defaultReps, setDefaultReps] = useState('')
  const [isTimed, setIsTimed] = useState(false)
  const [isBilateral, setIsBilateral] = useState(false)
  const [videoFile, setVideoFile] = useState(null)
```

- [ ] **Step 2: Include new fields in the Supabase insert**

Find:
```js
        default_sets: defaultSets ? parseInt(defaultSets) : null,
        default_reps: defaultReps ? parseInt(defaultReps) : null,
      })
```
Replace with:
```js
        default_sets: defaultSets ? parseInt(defaultSets) : null,
        default_reps: defaultReps ? parseInt(defaultReps) : null,
        is_timed: isTimed,
        is_bilateral: isBilateral,
      })
```

- [ ] **Step 3: Reset new state in `resetForm`**

Find:
```js
    setDefaultSets('')
    setDefaultReps('')
    setVideoFile(null)
```
Replace with:
```js
    setDefaultSets('')
    setDefaultReps('')
    setIsTimed(false)
    setIsBilateral(false)
    setVideoFile(null)
```

- [ ] **Step 4: Add measurement toggle + bilateral checkbox to the form, before the Sets / Reps fields**

This ensures the therapist selects measurement type first, so the "Default reps / Default seconds" label in the next field immediately reflects their choice.

Find:
```jsx
            {/* Sets / Reps */}
            <div style={{ display: 'flex', gap: '12px' }}>
```

Insert before that block:
```jsx
            {/* Measurement type + bilateral */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                  Default measurement
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ value: false, label: 'Reps' }, { value: true, label: 'Seconds' }].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setIsTimed(opt.value)}
                      style={{
                        flex: 1, padding: '8px', fontSize: '12px', fontWeight: 500,
                        borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s',
                        border: isTimed === opt.value ? 'none' : '1px solid var(--color-border)',
                        background: isTimed === opt.value ? '#29B5CC' : 'var(--color-elevated)',
                        color: isTimed === opt.value ? '#000' : 'var(--color-muted)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isBilateral}
                  onChange={e => setIsBilateral(e.target.checked)}
                  style={{ accentColor: '#29B5CC' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>Bilateral by default (complete on both sides)</span>
              </label>
            </div>

```

- [ ] **Step 5: Update the "Default reps" label to reflect the selected measurement type**

Find:
```jsx
                <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Default reps</label>
```
Replace with:
```jsx
                <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                  {isTimed ? 'Default seconds' : 'Default reps'}
                </label>
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: add is_timed and is_bilateral defaults to custom exercise creation"
```

---

## Task 4: SessionEdit — Pass New Fields Through to prescription_exercises

**File:** `src/pages/therapist/SessionEdit.jsx`

- [ ] **Step 1: Add `measurement_type` and `bilateral` to the select query**

Find:
```js
        .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
        .eq('prescription_id', sessionId),
```
Replace with:
```js
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
        .eq('prescription_id', sessionId),
```

- [ ] **Step 2: Accept and insert the new fields in `handleAddExercise`**

Find:
```js
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
```

Replace with:
```js
  async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral }) {
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
      })
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
      .single()
```

- [ ] **Step 3: Update the exercise list to show "sec" for timed exercises**

Find:
```jsx
                    <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      {pe.sets} sets × {pe.reps} reps{pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                    </div>
```
Replace with:
```jsx
                    <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                      {pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                      {pe.bilateral ? ' · Both sides' : ''}
                    </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/SessionEdit.jsx
git commit -m "feat: pass measurement_type and bilateral through SessionEdit to prescription_exercises"
```

---

## Task 5: TemplateEdit — Same Changes for template_exercises

**File:** `src/pages/therapist/TemplateEdit.jsx`

- [ ] **Step 1: Add `measurement_type` and `bilateral` to the select query**

Find:
```js
        .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
        .eq('template_id', templateId)
```
Replace with:
```js
        .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
        .eq('template_id', templateId)
```

- [ ] **Step 2: Accept and insert the new fields in `handleAddExercise`**

Find:
```js
  async function handleAddExercise({ exerciseId, sets, reps, weight, notes }) {
    const { data, error: insertError } = await supabase
      .from('template_exercises')
      .insert({
        template_id: templateId,
        exercise_id: exerciseId,
        sets,
        reps,
        weight,
        therapist_notes: notes,
      })
      .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
      .single()
```

Replace with:
```js
  async function handleAddExercise({ exerciseId, sets, reps, weight, notes, measurementType, bilateral }) {
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
      })
      .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
      .single()
```

- [ ] **Step 3: Update the exercise list display (same pattern as SessionEdit)**

Find in TemplateEdit's exercise list render the line that reads:
```jsx
                      {pe.sets} sets × {pe.reps} reps{pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
```
Replace with:
```jsx
                      {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                      {pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                      {pe.bilateral ? ' · Both sides' : ''}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/TemplateEdit.jsx
git commit -m "feat: pass measurement_type and bilateral through TemplateEdit to template_exercises"
```

---

## Task 6: ApplyTemplateModal — Carry New Fields When Applying Templates

**File:** `src/components/therapist/ApplyTemplateModal.jsx`

- [ ] **Step 1: Add `measurement_type` and `bilateral` to the template_exercises select**

Find:
```js
        template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, exercises(name))
```
Replace with:
```js
        template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name))
```

- [ ] **Step 2: Carry fields through in `applyAsIs`**

Find:
```js
      const exerciseRows = (selectedTemplate.template_exercises ?? []).map(te => ({
        prescription_id: prescription.id,
        exercise_id: te.exercise_id,
        sets: te.sets,
        reps: te.reps,
        weight: te.weight,
        therapist_notes: te.therapist_notes,
      }))
```
Replace with:
```js
      const exerciseRows = (selectedTemplate.template_exercises ?? []).map(te => ({
        prescription_id: prescription.id,
        exercise_id: te.exercise_id,
        sets: te.sets,
        reps: te.reps,
        weight: te.weight,
        therapist_notes: te.therapist_notes,
        measurement_type: te.measurement_type ?? 'reps',
        bilateral: te.bilateral ?? false,
      }))
```

- [ ] **Step 3: Include `measurementType` and `bilateral` in `startCustomise` initial state**

Find:
```js
    const initial = (selectedTemplate.template_exercises ?? []).map(te => ({
      id: te.id,
      exerciseId: te.exercise_id,
      name: te.exercises?.name ?? 'Exercise',
      sets: String(te.sets ?? ''),
      reps: String(te.reps ?? ''),
      weight: te.weight != null ? String(fromCanonical(te.weight, weightUnit)) : '',
      notes: te.therapist_notes ?? '',
    }))
```
Replace with:
```js
    const initial = (selectedTemplate.template_exercises ?? []).map(te => ({
      id: te.id,
      exerciseId: te.exercise_id,
      name: te.exercises?.name ?? 'Exercise',
      sets: String(te.sets ?? ''),
      reps: String(te.reps ?? ''),
      weight: te.weight != null ? String(fromCanonical(te.weight, weightUnit)) : '',
      notes: te.therapist_notes ?? '',
      measurementType: te.measurement_type ?? 'reps',
      bilateral: te.bilateral ?? false,
    }))
```

- [ ] **Step 4: Carry fields through in `applyCustomised`**

Find:
```js
      const exerciseRows = customExercises.map(ex => ({
        prescription_id: prescription.id,
        exercise_id: ex.exerciseId,
        sets: parseInt(ex.sets) || null,
        reps: parseInt(ex.reps) || null,
        weight: ex.weight ? toCanonical(parseFloat(ex.weight), weightUnit) : null,
        therapist_notes: ex.notes.trim() || null,
      }))
```
Replace with:
```js
      const exerciseRows = customExercises.map(ex => ({
        prescription_id: prescription.id,
        exercise_id: ex.exerciseId,
        sets: parseInt(ex.sets) || null,
        reps: parseInt(ex.reps) || null,
        weight: ex.weight ? toCanonical(parseFloat(ex.weight), weightUnit) : null,
        therapist_notes: ex.notes.trim() || null,
        measurement_type: ex.measurementType ?? 'reps',
        bilateral: ex.bilateral ?? false,
      }))
```

**Known gap (v1 deliberate omission):** The customise step UI in ApplyTemplateModal only renders inputs for Sets, Reps, Weight, and Notes. This plan carries `measurementType` and `bilateral` through the initial state so they survive the customise flow unchanged, but it does **not** add editing controls for them in the customise UI. A therapist who customises before applying can change sets/reps but cannot change the measurement type or bilateral flag — those will apply as-is from the template. This is acceptable for v1 since any prescription can be further edited via SessionEdit after applying. A future iteration can add the toggle and checkbox to the customise step.

- [ ] **Step 5: Commit**

```bash
git add src/components/therapist/ApplyTemplateModal.jsx
git commit -m "feat: carry measurement_type and bilateral when applying templates to prescriptions"
```

---

## Task 7: SessionWizard — Timed Inputs, Bilateral Reminder, Updated Set Summaries

**File:** `src/pages/client/SessionWizard.jsx`

- [ ] **Step 1: Add `measurement_type` and `bilateral` to the prescription_exercises select query**

Find:
```js
          .from('prescription_exercises')
          .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
          .eq('prescription_id', sessionId)
```
Replace with:
```js
          .from('prescription_exercises')
          .select('id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(id, name, category, video_url)')
          .eq('prescription_id', sessionId)
```

- [ ] **Step 2: Update the prescribed target display**

Find:
```jsx
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
              {ex.sets} sets × {ex.reps} reps{ex.weight ? ` @ ${formatWeight(ex.weight, weightUnit)}` : ''}
            </p>
```
Replace with:
```jsx
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
              {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
              {ex.weight ? ` @ ${formatWeight(ex.weight, weightUnit)}` : ''}
            </p>
```

- [ ] **Step 3: Add the bilateral reminder banner, directly after the target box (after the closing `</div>` of the target box)**

Find:
```jsx
          {ex.therapist_notes && (
            <p style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', color: '#29B5CC', margin: 0 }}>
              {ex.therapist_notes}
            </p>
          )}
```
Replace with:
```jsx
          {ex.bilateral && (
            <div style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>↔</span>
              <span style={{ fontSize: '13px', color: '#29B5CC' }}>Complete on both sides</span>
            </div>
          )}

          {ex.therapist_notes && (
            <p style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', color: '#29B5CC', margin: 0 }}>
              {ex.therapist_notes}
            </p>
          )}
```

- [ ] **Step 4: Update the per-set "Reps" input label**

Find:
```jsx
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>Reps</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentSetData.reps}
                    onChange={e => updateSetField(step, currentSet, 'reps', e.target.value)}
                    placeholder={ex.reps ? String(ex.reps) : '—'}
```
Replace with:
```jsx
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                    {ex.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentSetData.reps}
                    onChange={e => updateSetField(step, currentSet, 'reps', e.target.value)}
                    placeholder={ex.reps ? String(ex.reps) : '—'}
```

- [ ] **Step 5: Update the in-progress set summary (already-done sets, shown during logging)**

Find:
```jsx
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}
                    >
                      Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                    </motion.p>
```
Replace with:
```jsx
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}
                    >
                      Set {i + 1}: {s.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                      {s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                    </motion.p>
```

- [ ] **Step 6: Update the all-sets-done recap summary**

Find:
```jsx
                {setsData.map((s, i) => (
                  <p key={i} style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}>
                    Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                  </p>
                ))}
```
Replace with:
```jsx
                {setsData.map((s, i) => (
                  <p key={i} style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}>
                    Set {i + 1}: {s.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                    {s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
                  </p>
                ))}
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: timed exercise display and bilateral reminder in SessionWizard"
```

---

## Task 8: PDFs — PrescriptionPDF and AllSessionsPDF

**Files:** `src/components/therapist/PrescriptionPDF.jsx`, `src/components/therapist/AllSessionsPDF.jsx`

### PrescriptionPDF

- [ ] **Step 1: Update `exerciseMeta` to show "sec" for timed, and add bilateral label**

Find:
```jsx
            <Text style={styles.exerciseMeta}>
              {ex.sets} sets × {ex.reps} reps
              {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
            </Text>
```
Replace with:
```jsx
            <Text style={styles.exerciseMeta}>
              {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
              {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
              {ex.bilateral ? ' — Both sides' : ''}
            </Text>
```

### AllSessionsPDF

- [ ] **Step 2: Same change in AllSessionsPDF**

Find (in `src/components/therapist/AllSessionsPDF.jsx`):
```jsx
                <Text style={styles.exerciseMeta}>
                  {ex.sets} sets × {ex.reps} reps
                  {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
                </Text>
```
Replace with:
```jsx
                <Text style={styles.exerciseMeta}>
                  {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                  {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
                  {ex.bilateral ? ' — Both sides' : ''}
                </Text>
```

### Tests

- [ ] **Step 3: Update `AllSessionsPDF.test.jsx` — add `measurement_type` to existing fixtures and add new test cases**

Open `src/components/therapist/AllSessionsPDF.test.jsx` and replace the entire file content with:

```jsx
import { pdf } from '@react-pdf/renderer'
import { AllSessionsPDF } from './AllSessionsPDF'

const BASE_PROPS = {
  clinicName: 'Test Clinic',
  clientName: 'Jane Doe',
  weightUnit: 'kg',
  prescriptions: [
    {
      name: 'Session 1',
      frequencyLabel: 'Daily',
      exercises: [
        { name: 'Squat', sets: 3, reps: 10, weight: 50, therapist_notes: 'Keep back straight', measurement_type: 'reps', bilateral: false },
      ],
    },
  ],
}

describe('AllSessionsPDF', () => {
  test('renders to a non-empty PDF blob', async () => {
    const blob = await pdf(<AllSessionsPDF {...BASE_PROPS} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('handles empty exercises list without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [{ name: 'Empty Session', frequencyLabel: 'Weekly', exercises: [] }],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
  })

  test('renders multiple prescriptions with a divider between them', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        { name: 'Session A', frequencyLabel: 'Daily', exercises: [{ name: 'Squat', sets: 3, reps: 10, weight: 40, therapist_notes: null, measurement_type: 'reps', bilateral: false }] },
        { name: 'Session B', frequencyLabel: 'Weekly', exercises: [{ name: 'Lunge', sets: 2, reps: 12, weight: null, therapist_notes: null, measurement_type: 'reps', bilateral: false }] },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders timed exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        {
          name: 'Isometric Session',
          frequencyLabel: 'Daily',
          exercises: [
            { name: 'Wall Sit', sets: 3, reps: 30, weight: null, therapist_notes: null, measurement_type: 'seconds', bilateral: false },
          ],
        },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders bilateral exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        {
          name: 'Hip Session',
          frequencyLabel: 'Weekly',
          exercises: [
            { name: 'Hip Hinge', sets: 3, reps: 12, weight: null, therapist_notes: null, measurement_type: 'reps', bilateral: true },
          ],
        },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/components/therapist/AllSessionsPDF.test.jsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/therapist/PrescriptionPDF.jsx src/components/therapist/AllSessionsPDF.jsx src/components/therapist/AllSessionsPDF.test.jsx
git commit -m "feat: show sec/reps and bilateral label in PDF components; update PDF tests"
```

---

## Task 9: Prescribe — History Display, Reactivation Copy, PDF Queries

**File:** `src/pages/therapist/Prescribe.jsx`

There are four places to update: the session history display (`ExerciseLogDetail`), the reactivation copy function, and the three PDF generation functions (`downloadPDF`, `downloadAllPDF`, `emailPDF`).

### Session History Display

- [ ] **Step 1: Add `measurement_type` and `bilateral` to the session logs prescription_exercises select**

Find:
```
          prescription_exercises(sets, reps, weight, exercises(name))
```
Replace with:
```
          prescription_exercises(sets, reps, weight, measurement_type, bilateral, exercises(name))
```

- [ ] **Step 2: Update `ExerciseLogDetail` to display the correct unit**

Find:
```jsx
      {pe && (
        <p className="mt-0.5 text-xs text-dark-muted">
          Prescribed: {pe.sets} sets × {pe.reps} reps{pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
        </p>
      )}

      {hasPerSetData ? (
        <div className="mt-1 space-y-0.5">
          {el.sets_data.map((s, si) => (
            <p key={si} className="text-xs text-dark-muted">
              Set {si + 1}: {s.reps} reps{s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
            </p>
          ))}
        </div>
```
Replace with:
```jsx
      {pe && (
        <p className="mt-0.5 text-xs text-dark-muted">
          Prescribed: {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
          {pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
          {pe.bilateral ? ' — Both sides' : ''}
        </p>
      )}

      {hasPerSetData ? (
        <div className="mt-1 space-y-0.5">
          {el.sets_data.map((s, si) => (
            <p key={si} className="text-xs text-dark-muted">
              Set {si + 1}: {s.reps} {pe?.measurement_type === 'seconds' ? 'sec' : 'reps'}
              {s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
            </p>
          ))}
        </div>
```

### Reactivation Copy

- [ ] **Step 3: Include new fields in the reactivation select and copy**

Find:
```js
    const { data: origExercises, error: exError } = await supabase
      .from('prescription_exercises')
      .select('exercise_id, sets, reps, weight, therapist_notes')
      .eq('prescription_id', original.id)
```
Replace with:
```js
    const { data: origExercises, error: exError } = await supabase
      .from('prescription_exercises')
      .select('exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral')
      .eq('prescription_id', original.id)
```

Find:
```js
      const copies = origExercises.map(e => ({
        prescription_id: newPrescription.id,
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        therapist_notes: e.therapist_notes,
      }))
```
Replace with:
```js
      const copies = origExercises.map(e => ({
        prescription_id: newPrescription.id,
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        therapist_notes: e.therapist_notes,
        measurement_type: e.measurement_type ?? 'reps',
        bilateral: e.bilateral ?? false,
      }))
```

### PDF Query Updates

- [ ] **Step 4: Update `downloadPDF` — query and exercise mapping**

Find:
```js
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('sets, reps, weight, therapist_notes, exercises(name)')
        .eq('prescription_id', prescription.id)
        .order('created_at', { ascending: true })
```
Replace with:
```js
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
        .eq('prescription_id', prescription.id)
        .order('created_at', { ascending: true })
```

Find:
```js
      const exercises = peData.map(pe => ({
        name: pe.exercises?.name ?? 'Exercise',
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.weight,
        therapist_notes: pe.therapist_notes,
      }))
```
Replace with:
```js
      const exercises = peData.map(pe => ({
        name: pe.exercises?.name ?? 'Exercise',
        sets: pe.sets,
        reps: pe.reps,
        weight: pe.weight,
        therapist_notes: pe.therapist_notes,
        measurement_type: pe.measurement_type ?? 'reps',
        bilateral: pe.bilateral ?? false,
      }))
```

- [ ] **Step 5: Update `downloadAllPDF` — query and exercise mapping**

Find:
```js
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, exercises(name)')
        .in('prescription_id', activeIds)
        .order('created_at', { ascending: true })
```
Replace with:
```js
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
        .in('prescription_id', activeIds)
        .order('created_at', { ascending: true })
```

Find (inside `downloadAllPDF`):
```js
        byId[row.prescription_id].push({
          name: row.exercises?.name ?? 'Exercise',
          sets: row.sets,
          reps: row.reps,
          weight: row.weight,
          therapist_notes: row.therapist_notes,
        })
```
Replace with:
```js
        byId[row.prescription_id].push({
          name: row.exercises?.name ?? 'Exercise',
          sets: row.sets,
          reps: row.reps,
          weight: row.weight,
          therapist_notes: row.therapist_notes,
          measurement_type: row.measurement_type ?? 'reps',
          bilateral: row.bilateral ?? false,
        })
```

- [ ] **Step 6: Update `emailPDF` — query and exercise mapping (same pattern as downloadAllPDF)**

> **Ordering note:** Step 5 must execute before this step. The `byId[row.prescription_id].push(...)` pattern is identical in both `downloadAllPDF` and `emailPDF`. After Step 5 replaces the `downloadAllPDF` copy with the expanded block, the original 5-line pattern becomes unique to `emailPDF` — making the find below unambiguous. If you ever run these steps out of order, find the push block inside the function that starts with `setEmailLoading(true)` rather than `setAllPdfLoading(true)`.

Find (inside `emailPDF`):
```js
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, exercises(name)')
        .in('prescription_id', activeIds)
```
Replace with:
```js
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
        .in('prescription_id', activeIds)
```

Find inside `emailPDF` (the `setEmailLoading(true)` line confirms you're in the right function — the push pattern is identical to `downloadAllPDF` so the surrounding function name is the disambiguator):
```js
    setEmailLoading(true)
    setEmailError(false)
    try {
      const activeIds = activeSessions.map(s => s.id)
      const { data: peData, error: peError } = await supabase
        .from('prescription_exercises')
        .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, exercises(name)')
        .in('prescription_id', activeIds)
```

Then find the push block inside that same function:
```js
        byId[row.prescription_id].push({
          name: row.exercises?.name ?? 'Exercise',
          sets: row.sets,
          reps: row.reps,
          weight: row.weight,
          therapist_notes: row.therapist_notes,
        })
```
Replace with:
```js
        byId[row.prescription_id].push({
          name: row.exercises?.name ?? 'Exercise',
          sets: row.sets,
          reps: row.reps,
          weight: row.weight,
          therapist_notes: row.therapist_notes,
          measurement_type: row.measurement_type ?? 'reps',
          bilateral: row.bilateral ?? false,
        })
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx
git commit -m "feat: update Prescribe history display, reactivation copy, and PDF queries for measurement_type and bilateral"
```

---

---

## Task 10: Client History — Update Exercise Log Display

**File:** `src/pages/client/History.jsx`

The client history page displays past session logs and has the same hardcoded "reps" display as `Prescribe.jsx`. Without this fix, a client who did a timed exercise would see "30 reps" in their own history.

> **Verified:** All three find strings in this task have been confirmed against the actual file at `src/pages/client/History.jsx` (lines 53, 179, 187). They are exact matches.

- [ ] **Step 1: Add `measurement_type` to the prescription_exercises select in the session logs query**

Find:
```js
          prescription_exercises(sets, reps, weight, exercises(name))
```
Replace with:
```js
          prescription_exercises(sets, reps, weight, measurement_type, exercises(name))
```

- [ ] **Step 2: Update the "Prescribed" line**

Find:
```jsx
              {pe && (
                <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-subtle)', margin: '2px 0 0' }}>
                  Prescribed: {pe.sets} sets × {pe.reps} reps{pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
                </p>
              )}
```
Replace with:
```jsx
              {pe && (
                <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-subtle)', margin: '2px 0 0' }}>
                  Prescribed: {pe.sets} sets × {pe.reps} {pe.measurement_type === 'seconds' ? 'sec' : 'reps'}
                  {pe.weight ? ` @ ${formatWeight(pe.weight, weightUnit)}` : ''}
                </p>
              )}
```

- [ ] **Step 3: Update the per-set display**

Find:
```jsx
                    <p key={si} style={{ fontSize: '11px', color: 'var(--color-muted)', margin: 0 }}>
                      Set {si + 1}: {s.reps} reps{s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
                    </p>
```
Replace with:
```jsx
                    <p key={si} style={{ fontSize: '11px', color: 'var(--color-muted)', margin: 0 }}>
                      Set {si + 1}: {s.reps} {pe?.measurement_type === 'seconds' ? 'sec' : 'reps'}
                      {s.weight ? ` @ ${formatWeight(parseFloat(s.weight), weightUnit)}` : ''}
                    </p>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/client/History.jsx
git commit -m "feat: update client history to show sec/reps based on measurement_type"
```

---

## Verification

- [ ] **Run all tests**

```bash
npx vitest run
```

Expected: 5 tests pass in AllSessionsPDF.test.jsx (3 existing tests with updated fixtures + 2 new: timed exercise, bilateral exercise). All other existing test files pass unchanged.

- [ ] **Start the dev server and verify end-to-end**

```bash
npm run dev
```

Work through each scenario:

1. **Create a custom exercise**: Go to Exercise Library → New Exercise. Set "Default measurement" to Seconds, tick "Bilateral by default". Save. The exercise should appear in the library.

2. **Prescribe a timed exercise**: Open a client → edit a session → Add exercise → find the one you just created. In the configure panel, the toggle should default to "Seconds" and "Complete on both sides" should be pre-ticked. Change the seconds value to 30. Add to session. The exercise list should show "3 sets × 30 sec · Both sides".

3. **Override the defaults**: Find a rep-based exercise, prescribe it, then switch the measurement toggle to "Seconds" manually. Verify the label in the configure panel changes.

4. **Complete the session as a client**: Log in as a client, go to the session. For the timed exercise, the target should read "3 sets × 30 sec" and the bilateral reminder banner should appear. The per-set input should be labelled "Seconds". Log actual seconds achieved and complete the session.

5. **View history as therapist**: On the Prescribe page, open session history. The logged sets for the timed exercise should show "30 sec" not "30 reps".

6. **Export PDF**: Download the single-session PDF and the all-sessions PDF. Both should show "30 sec" and "Both sides" for the timed bilateral exercise.

7. **Reactivate a session**: Reactivate a session that contains timed/bilateral exercises. The copied exercises should retain their `measurement_type` and `bilateral` values.

8. **Client history**: As a client, go to the History page after completing a timed exercise session. The exercise log should show "30 sec" not "30 reps" for the timed exercise.
