# Per-Set Prescription Design

**Date:** 2026-06-09

**Goal:** Allow therapists to optionally prescribe different reps and weight for each set of an exercise (pyramid sets, drop sets, warmup progressions). Clients see the per-set targets during their session with the current set highlighted.

---

## Scope

- Optional toggle per exercise (like tempo) — most exercises stay as single sets/reps/weight
- Applies to both sessions (`prescription_exercises`) and templates (`template_exercises`)
- Flows through: ExercisePicker → SessionEdit → TemplateEdit → ApplyTemplateModal → ApplyProgramTemplateModal → ProgramEdit (week copy) → SessionWizard → PDF exports
- When per-set mode is ON, both reps and weight can vary per set

---

## Data Model

### New tables

```sql
CREATE TABLE prescription_exercise_sets (
  id                       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_exercise_id uuid    NOT NULL REFERENCES prescription_exercises(id) ON DELETE CASCADE,
  set_number               integer NOT NULL,
  reps                     integer NOT NULL,
  weight                   integer  -- canonical mg integer (same scale as prescription_exercises.weight); NULL = bodyweight
);

CREATE TABLE template_exercise_sets (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  template_exercise_id uuid    NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  set_number           integer NOT NULL,
  reps                 integer NOT NULL,
  weight               integer
);
```

### RLS policies (must be added in the same migration)

Both tables inherit the same access pattern as their parent tables — therapist owns the data, client can read their own.

```sql
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

### Detection

Per-set mode is **active when child rows exist** — no flag column needed. All code checks `pe.prescription_exercise_sets?.length > 0` (or `te.template_exercise_sets?.length > 0`) after fetching the nested rows.

### Parent column behaviour when per-set is ON

- `prescription_exercises.sets` — set to the count of child rows on save (so any summary view without a join still shows the right number)
- `prescription_exercises.reps` and `.weight` — left as-is; ignored in display/logic when child rows are present

---

## Utility

**`src/utils/formatPerSetSummary.js`**

```js
// Takes [{reps, weight}, ...] where weight is a canonical integer (same scale
// as prescription_exercises.weight — convert with fromCanonical before display)
// and weightUnit ('kg'|'lb'). Returns compact string: "10×40 · 8×55 · 6×70 kg"
// or "10 · 8 · 6 reps" when all weights are null.
export function formatPerSetSummary(sets, weightUnit) { ... }
```

All components import this — no inline formatting logic.

---

## UI Components

### ExercisePicker — configure step

Actual UI order in the configure step: Measurement toggle → Sets/Reps/Weight grid → Bilateral checkbox → **[per-set toggle goes here]** → Tempo toggle → Notes.

- Add a **"Per-set weights & reps (optional)"** toggle between the bilateral checkbox and the tempo section
- When OFF: existing Sets / Reps / Weight 3-column grid shown as today
- When ON:
  - Sets/Reps/Weight grid is **hidden**
  - A compact inline row table appears: `Set | Reps | Weight (unit) | ✕`
  - **Pre-population is one-shot on toggle-on**: N rows created from the current `configSets` value, each row defaulting to `configReps` and `configWeight`. If `configSets` changes after toggling on, the rows are NOT auto-updated (user manages rows manually).
  - **"+ Add set"** button appends a row with blank reps and weight
  - ✕ button removes a row; minimum 1 row enforced
  - Preview line below rows: `"3 sets — 10×40 · 8×55 · 6×70 kg"` (same teal italic pill as tempo preview; uses `formatPerSetSummary`)
- Validation on confirm: each row's reps ≥ 1; weight is optional (null = bodyweight)
- `onAdd` payload gains: `perSetSets: [{reps, weight}, ...] | null`
- When per-set is ON, `sets` in the payload = `perSetSets.length`

### SessionEdit

**Fetch:** `fetchData` nested select adds `prescription_exercise_sets(id, set_number, reps, weight)` ordered by `set_number asc`. Both `fetchData` AND `handleAddExercise`'s `.select(...)` return must include this nested relation.

**Display mode (not editing):**
- If `pe.prescription_exercise_sets?.length > 0`: replace stats line with teal mini table:
  ```
  Per-set · 3 sets     [label row]
  1  10 reps  40 kg
  2   8 reps  55 kg
  3   6 reps  70 kg
  ```
- Otherwise: existing `3 sets × 10 reps · 60 kg` line unchanged

**Edit mode:**
- `startEdit` checks `pe.prescription_exercise_sets?.length > 0` and sets `editValues.perSetEnabled = true`, `editValues.perSetRows = pe.prescription_exercise_sets.map(s => ({reps: String(s.reps), weight: s.weight != null ? String(fromCanonical(s.weight, weightUnit)) : ''}))`
- Same toggle + inline rows UI as ExercisePicker
- `saveEdit` when per-set ON:
  1. Delete all child rows: `DELETE FROM prescription_exercise_sets WHERE prescription_exercise_id = peId`
  2. Re-insert N rows in `set_number` order
  3. Update parent `sets = N` (explicitly included in the `.update({...})` call)
- `saveEdit` when per-set OFF:
  1. Delete all child rows (clearing any previously stored per-set data)
  2. Save parent `sets/reps/weight` as today (no change to existing logic)

### TemplateEdit

Identical changes to SessionEdit but targeting `template_exercise_sets`. `fetchData` and `handleAddExercise` return selects must both include `template_exercise_sets(id, set_number, reps, weight)`.

### ApplyTemplateModal

**Fetch:** `template_exercises` nested select adds `template_exercise_sets(id, set_number, reps, weight)`

**Customise flow — explicit rule:** If a user opens the customise modal for an exercise that has per-set rows, **per-set rows are silently dropped** when the user edits the flat Sets/Reps/Weight fields and confirms. The flat values win. The customise UI is not extended with per-set editing — that would require a separate modal within a modal. Carry `perSetRows: te.template_exercise_sets ?? []` in the editable state, but only use it in `applyCustomised` if the user has not touched Sets/Reps/Weight (i.e., they left them at the template defaults). If the user changed any flat field, treat per-set as OFF.

  Simpler alternative (recommended): always drop per-set rows when the user customises. State this clearly in the customise UI: *(Per-set configuration will be cleared; edit the session directly after applying if needed.)*

**`applyAsIs`:** After inserting each `prescription_exercise` (must use `.select('id').single()` to get the ID), if `te.template_exercise_sets?.length > 0` insert corresponding rows into `prescription_exercise_sets`.

**`applyCustomised`:** After inserting each exercise (with `.select('id').single()`), per-set rows are NOT copied (per the rule above — customised exercises use flat values only).

### ApplyProgramTemplateModal

Currently inserts all `prescription_exercises` in a single bulk `.insert(exerciseRows)` without capturing IDs. To support per-set row copying this must change to a per-exercise loop with `.select('id').single()` on each insert (matching the pattern already used in `handleRepeatWeek` in ProgramEdit).

**Changes:**
1. Update `template_exercises` select to add `template_exercise_sets(id, set_number, reps, weight)` (also add `tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause` — these are currently missing from this fetch, a pre-existing gap)
2. Change exercise insert from bulk to per-exercise loop:
   ```js
   for (const te of templateExercises) {
     const { data: pe } = await supabase
       .from('prescription_exercises')
       .insert({ ...exerciseFields, prescription_id: prescription.id })
       .select('id')
       .single()
     if (te.template_exercise_sets?.length > 0) {
       await supabase.from('prescription_exercise_sets').insert(
         te.template_exercise_sets.map((s, i) => ({
           prescription_exercise_id: pe.id,
           set_number: s.set_number,
           reps: s.reps,
           weight: s.weight ?? null,
         }))
       )
     }
   }
   ```
3. Include `tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause` in the exercise row insert (fix pre-existing gap at the same time)

### ProgramEdit — `handleRepeatWeek`

The `mode === 'program'` branch currently selects `exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral` and bulk-inserts copies. This drops per-set rows.

**Changes:**
1. Change select to also include `prescription_exercise_sets(set_number, reps, weight)`
2. Change exercise insert to per-exercise loop with `.select('id').single()`
3. After each exercise insert, if `ex.prescription_exercise_sets?.length > 0`, insert child rows into `prescription_exercise_sets`

### SessionWizard (client)

**Fetch:** nested select adds `prescription_exercise_sets(set_number, reps, weight)` ordered by `set_number asc`

**`setsData` initialisation — no change needed:** `setsData` is the client's logging array (blank actuals, one entry per set). It is already initialised from `pe.sets` which will equal `prescription_exercise_sets.length` when per-set mode is on. The two arrays stay parallel: `setsData[i]` = client's logged reps/weight for set `i+1`; `prescription_exercise_sets[i]` = therapist's prescribed target for set `i+1`.

**Target block:**
- If `ex.prescription_exercise_sets?.length > 0`: replace the single-line target block with the set list view:
  - Each row: set number · prescribed reps · prescribed weight
  - Completed sets (index < `ex.currentSet`): dim, `✓ done`
  - Current set (index === `ex.currentSet`): highlighted teal, `← now`
  - Upcoming sets (index > `ex.currentSet`): dim, no indicator
  - Use `ex.prescription_exercise_sets[ex.currentSet]` for the current set's prescribed target
- If no per-set rows: existing `"3 sets × 10 reps @ 60 kg"` block unchanged

### PDF Components

`PrescriptionPDF`, `AllSessionsPDF`, `ProgramPDF` — each exercise object gains `prescription_exercise_sets` (array of `{set_number, reps, weight}` or empty array).

When `prescription_exercise_sets?.length > 0`: replace the single `exerciseMeta` `<Text>` with a plain string concat (no nested `<Text>` with colour variation — `@react-pdf/renderer` does not support mixed inline styles in a single Text node):
```
"Set 1: 10 × 40 kg  ·  Set 2: 8 × 55 kg  ·  Set 3: 6 × 70 kg"
```
Use `formatPerSetSummary` to build this string.

Otherwise: existing single-line text unchanged.

### Prescribe.jsx data fetches

All four fetch functions (`downloadPDF`, `downloadProgramPDF`, `downloadAllPDF`, `emailPDF`) and the reactivate-session copy:
- Add `prescription_exercise_sets(set_number, reps, weight)` to the select
- Pass `prescription_exercise_sets` through to each exercise object as-is (Supabase already returns it under that key)

**Reactivate copy** — same fix as `handleRepeatWeek`: switch from bulk insert to per-exercise loop with `.select('id').single()`, then insert child rows.

---

## Data Flow Summary

```
ExercisePicker.onAdd({ ..., perSetSets: [{reps, weight}] })
  → SessionEdit.handleAddExercise
      → INSERT prescription_exercises (sets = N) → get id
      → INSERT prescription_exercise_sets × N rows

SessionEdit.saveEdit (per-set ON)
  → DELETE prescription_exercise_sets WHERE prescription_exercise_id = peId
  → INSERT prescription_exercise_sets × N rows
  → UPDATE prescription_exercises SET sets = N

ApplyTemplateModal.applyAsIs
  → INSERT prescription_exercise (with .select('id'))
  → INSERT prescription_exercise_sets (copied from template_exercise_sets)

ApplyTemplateModal.applyCustomised
  → INSERT prescription_exercise (flat values only — per-set rows dropped)

ApplyProgramTemplateModal.handleApply
  → for each te: INSERT prescription_exercise (with .select('id'))
  → INSERT prescription_exercise_sets if template_exercise_sets exist

ProgramEdit.handleRepeatWeek (mode === 'program')
  → for each src exercise: INSERT prescription_exercise (with .select('id'))
  → INSERT prescription_exercise_sets if source has child rows

Prescribe.jsx downloads
  → fetch prescription_exercise_sets nested in each exercise
  → pass as prescription_exercise_sets to PDF components
```

---

## File Map

| Action | File |
|--------|------|
| DB     | Migration: `prescription_exercise_sets`, `template_exercise_sets`, RLS policies |
| Create | `src/utils/formatPerSetSummary.js` |
| Modify | `src/components/therapist/ExercisePicker.jsx` |
| Modify | `src/pages/therapist/SessionEdit.jsx` |
| Modify | `src/pages/therapist/TemplateEdit.jsx` |
| Modify | `src/components/therapist/ApplyTemplateModal.jsx` |
| Modify | `src/components/therapist/ApplyProgramTemplateModal.jsx` |
| Modify | `src/pages/therapist/ProgramEdit.jsx` (`handleRepeatWeek`) |
| Modify | `src/pages/client/SessionWizard.jsx` |
| Modify | `src/components/therapist/PrescriptionPDF.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.jsx` |
| Modify | `src/components/therapist/ProgramPDF.jsx` |
| Modify | `src/pages/therapist/Prescribe.jsx` |

---

## Out of Scope

- Per-set notes (therapist notes remain per-exercise)
- Reordering sets via drag-and-drop
- Changing measurement type (seconds/reps) per set — the parent measurement type applies to all sets
- Per-set editing in the ApplyTemplateModal customise UI (per-set rows are dropped on customise; therapist edits the session directly after applying)
