# Per-Set Prescription Design

**Date:** 2026-06-09

**Goal:** Allow therapists to optionally prescribe different reps and weight for each set of an exercise (pyramid sets, drop sets, warmup progressions). Clients see the per-set targets during their session with the current set highlighted.

---

## Scope

- Optional toggle per exercise (like tempo) — most exercises stay as single sets/reps/weight
- Applies to both sessions (`prescription_exercises`) and templates (`template_exercises`)
- Flows through: ExercisePicker → SessionEdit → TemplateEdit → ApplyTemplateModal → SessionWizard → PDF exports
- When per-set mode is ON, both reps and weight can vary per set

---

## Data Model

### New tables

```sql
CREATE TABLE prescription_exercise_sets (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_exercise_id uuid NOT NULL REFERENCES prescription_exercises(id) ON DELETE CASCADE,
  set_number             integer NOT NULL,
  reps                   integer NOT NULL,
  weight                 integer          -- canonical (same unit as prescription_exercises.weight), nullable = bodyweight
);

CREATE TABLE template_exercise_sets (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_exercise_id   uuid NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  set_number             integer NOT NULL,
  reps                   integer NOT NULL,
  weight                 integer
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
// Returns a compact string like "10×40 · 8×55 · 6×70 kg" or "10 · 8 · 6 reps" (no weight)
export function formatPerSetSummary(sets, weightUnit) { ... }
```

Takes `[{reps, weight}, ...]` (weight in canonical integer) and `weightUnit`. Returns a compact single-line string for use in display badges and PDF. All components import this — no inline formatting.

---

## UI Components

### ExercisePicker — configure step

- Add a **"Per-set weights & reps (optional)"** toggle below the bilateral checkbox, above tempo
- When OFF: existing Sets / Reps / Weight 3-column grid is shown as today
- When ON:
  - Sets/Reps/Weight grid is hidden
  - A compact inline row table appears: `Set | Reps | Weight (unit) | ✕`
  - Pre-populated with N rows using the current `configSets` count, `configReps`, and `configWeight` as defaults
  - **"+ Add set"** button appends a blank row
  - ✕ button removes a row (minimum 1 row enforced)
  - Summary preview line: `"3 sets — 10×40 · 8×55 · 6×70 kg"` (same teal italic style as tempo preview)
- Validation: each row's reps ≥ 1; weight is optional (nullable = bodyweight)
- `onAdd` payload gains: `perSetSets: [{reps, weight}, ...] | null`
- When per-set is ON, `sets` in the payload = `perSetSets.length`

### SessionEdit

**Fetch:** nested select adds `prescription_exercise_sets(id, set_number, reps, weight)` ordered by `set_number`

**Display mode (not editing):**
- If `pe.prescription_exercise_sets?.length > 0`: show a teal mini table instead of the stats line
  ```
  Per-set · 3 sets
  1  10 reps  40 kg
  2   8 reps  55 kg
  3   6 reps  70 kg
  ```
- Otherwise: existing `3 sets × 10 reps · 60 kg` line unchanged

**Edit mode:**
- `startEdit` detects per-set rows and populates `editValues.perSetEnabled = true`, `editValues.perSetRows = [{reps, weight}, ...]`
- Same toggle + inline rows UI as ExercisePicker (reusing same row layout)
- `saveEdit`: when per-set ON — delete all existing child rows for this `peId`, re-insert new rows, set parent `sets = count`; when per-set OFF — delete all child rows, save parent reps/weight as today

### TemplateEdit

Identical changes to SessionEdit but targeting `template_exercise_sets`.

### ApplyTemplateModal

**Fetch:** `template_exercises` nested select adds `template_exercise_sets(id, set_number, reps, weight)`

- `startCustomise`: carry `perSetRows: te.template_exercise_sets ?? []` into the editable state per exercise
- `applyAsIs`: after inserting each `prescription_exercise`, if `te.template_exercise_sets?.length > 0` insert corresponding rows into `prescription_exercise_sets`
- `applyCustomised`: same — after inserting exercise, copy `ex.perSetRows` into `prescription_exercise_sets`

### SessionWizard (client)

**Fetch:** nested select adds `prescription_exercise_sets(set_number, reps, weight)` ordered by `set_number`

**Target block:**
- If no per-set rows: existing `"3 sets × 10 reps @ 60 kg"` block unchanged
- If per-set rows exist: replace target block with the set list view:
  - Each row: set number · reps · weight
  - Completed sets: dim with `✓ done`
  - Current set: highlighted teal row with `← now`
  - Upcoming sets: dim
  - Driven by the existing `currentSet` state variable

### PDF Components

`PrescriptionPDF`, `AllSessionsPDF`, `ProgramPDF` — all receive exercises with a `prescription_exercise_sets` field (array of `{reps, weight}`).

When `prescription_exercise_sets?.length > 0`: replace the single `exerciseMeta` text with:
```
Set 1: 10 × 40 kg  ·  Set 2: 8 × 55 kg  ·  Set 3: 6 × 70 kg
```
Otherwise: existing single-line text unchanged.

### Prescribe.jsx data fetches

All four fetch functions (`downloadPDF`, `downloadProgramPDF`, `downloadAllPDF`, `emailPDF`) and the reactivate-session copy:
- Add `prescription_exercise_sets(set_number, reps, weight)` to the select
- Pass `prescription_exercise_sets` through to each exercise object as-is (Supabase already returns it under that key)

Also update the reactivate copy to insert child rows from the source exercise into the new prescription.

---

## Data Flow Summary

```
ExercisePicker.onAdd({ ..., perSetSets: [{reps, weight}] })
  → SessionEdit.handleAddExercise
      → INSERT prescription_exercises (sets = N)
      → INSERT prescription_exercise_sets × N rows

SessionEdit.saveEdit
  → DELETE prescription_exercise_sets WHERE prescription_exercise_id = peId
  → INSERT prescription_exercise_sets × N rows (if per-set ON)

ApplyTemplateModal.applyAsIs / applyCustomised
  → INSERT prescription_exercises
  → INSERT prescription_exercise_sets (copied from template_exercise_sets)

Prescribe.jsx downloads
  → fetch prescription_exercise_sets
  → pass as sets_detail to PDF components
```

---

## File Map

| Action | File |
|--------|------|
| DB     | `prescription_exercise_sets` and `template_exercise_sets` migration |
| Create | `src/utils/formatPerSetSummary.js` |
| Modify | `src/components/therapist/ExercisePicker.jsx` |
| Modify | `src/pages/therapist/SessionEdit.jsx` |
| Modify | `src/pages/therapist/TemplateEdit.jsx` |
| Modify | `src/components/therapist/ApplyTemplateModal.jsx` |
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
