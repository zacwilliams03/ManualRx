# Rest Between Sets — Design Spec

**Date:** 2026-06-11  
**Status:** Approved (post-review revision 2)

---

## Overview

Allow therapists to optionally prescribe a rest duration (in seconds) between sets for standalone exercises, and between rounds for supersets. The value is stored as a nullable integer. On the client side it appears as a static text message — no countdown timer. It is also rendered in the PDF exercise table.

---

## 1. Database

One migration file. Four `ALTER TABLE` statements, no backfill.

| Table | Column | Type |
|---|---|---|
| `prescription_exercises` | `rest_seconds` | `INT NULL` |
| `prescription_exercise_groups` | `rest_seconds` | `INT NULL` |
| `template_exercises` | `rest_seconds` | `INT NULL` |
| `template_exercise_groups` | `rest_seconds` | `INT NULL` |

- NULL means no rest prescribed.
- All existing rows default to NULL; no backfill required.
- No RLS changes needed — columns inherit existing policies.

---

## 2. Therapist UI

### 2.1 ExercisePicker (`src/components/therapist/ExercisePicker.jsx`)

In the configure view, after the Tempo section, add an optional "Rest between sets" row:

- Label: **"Rest between sets"**
- Input: number input, min 0, step 5, suffix label **"sec"**
- **Save-time clamp is authoritative:** if value is 0 or empty when submitted, pass `restSeconds: null` in the `onAdd` payload. Never persist 0 to the DB.
- Otherwise pass `restSeconds: parseInt(value)`
- State: `configRestSeconds` (string, default `''`)

The `onAdd` payload gains a `restSeconds` field. All callers of `ExercisePicker` (`SessionEdit`, `TemplateEdit`) pass `restSeconds` through to their Supabase insert.

### 2.2 SupersetPickerModal (`src/components/therapist/SupersetPickerModal.jsx`)

Add a "Rest between rounds" row below the existing "Sets (applied to all)" stepper:

- Label: **"Rest between rounds"**
- Input: number input, min 0, step 5, suffix label **"sec"**
- **Same save-time clamp:** 0 or empty → `null` on the group row
- State: `restSeconds` (string, default `''`), initialised from `editGroup?.rest_seconds ?? ''` in edit mode
- Include `rest_seconds` in the group insert (`handleCreate`) and group update (`handleEdit`)

### 2.3 Inline edit panel in SessionEdit (`src/pages/therapist/SessionEdit.jsx`)

In the existing per-exercise edit panel (sets/reps/weight/notes/tempo fields):

- Add a **"Rest between sets"** number input after the Tempo section
- Hidden for grouped exercises (`pe.group_id != null`)
- Included in the `saveEdit` Supabase `.update({...})` call as `rest_seconds`
- Included in both the `fetchData` initial select string and the `saveEdit` re-fetch select string
- **Also included** in the `handleAddExercise` insert's `.select(...)` return string (third location following the same pattern as tempo and per-set columns)

### 2.4 Inline edit panel in TemplateEdit (`src/pages/therapist/TemplateEdit.jsx`)

Same as SessionEdit — "Rest between sets" field added to the per-exercise edit panel, `rest_seconds` in the Supabase update call, both select strings, and the handleAddExercise insert select.

---

## 3. Client Wizard (`src/pages/client/SessionWizard.jsx`)

### 3.1 Fetch strings

Two fetch calls need `rest_seconds` added to their select strings:

1. **Exercises fetch** (~line 77): `'id, sets, reps, weight, therapist_notes, measurement_type, bilateral, group_id, position_in_group, order_index, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, rest_seconds, prescription_exercise_sets(...), exercises(...)'`

2. **Groups fetch** (~line 89): currently `'id, label, set_count, order_index, created_at'` — **add `rest_seconds`**. Without this, `item.group.rest_seconds` is undefined and the superset heading silently falls back to plain "Rest".

### 3.2 `formatRest` utility

Place in `src/utils/formatRest.js` and import in both SessionWizard and ExerciseTablePDF:

```js
export function formatRest(seconds) {
  if (!seconds) return null
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
```

The `!seconds` guard handles null, undefined, and 0. Since 0 is never persisted (save-time clamp), this guard is defensive only.

### 3.3 Standalone exercises

When `pe.rest_seconds` is a positive integer, render a rest badge immediately after the `{ex.therapist_notes && <p ...>}` block (~line 815–819 in the standalone exercise step) and before the `{/* Per-set inputs */}` comment (~line 821):

```jsx
{ex.rest_seconds > 0 && (
  <p style={{ background: 'rgba(41,181,204,0.04)', border: '1px solid rgba(41,181,204,0.10)', borderRadius: '7px', padding: '8px 12px', fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>
    Rest: {formatRest(ex.rest_seconds)} between sets
  </p>
)}
```

Static text only — no timer.

### 3.4 Superset rest screen

When `item.group.rest_seconds` is a positive integer, replace the hardcoded `"Rest"` heading with:

```jsx
<div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
  {item.group.rest_seconds > 0 ? `Rest: ${formatRest(item.group.rest_seconds)}` : 'Rest'}
</div>
```

The subheading (`"Round N+1 of M starts next"`) stays unchanged.

---

## 4. PDF

### 4.1 `ExerciseTablePDF` (`src/components/therapist/ExerciseTablePDF.jsx`)

Add `rest_seconds` rendering inside the Exercise cell (`cellExercise`), after the exercise name and before the `notesBox`:

- Text: `"Rest: {formatRest(ex.rest_seconds)} between sets"` (import `formatRest` from `../../utils/formatRest`)
- Style: `{ color: GREY, fontSize: 7.5, marginTop: 2 }` — plain text, no border box, no background
- Apply the same rest line in `PerSetRows` inside the `perSetNameRow` section, after the exercise name text

**Group-level rest is NOT rendered in any PDF** — no superset section exists in `ExerciseTablePDF`, `PrescriptionPDF`, `AllSessionsPDF`, or `ProgramPDF`. This is explicitly out of scope.

### 4.2 Upstream callers — 6 select+mapping locations

`ExerciseTablePDF` receives a **flattened** array where `ex.rest_seconds` must be present. All 6 upstream locations need `rest_seconds` added to both the Supabase select string and the object mapping:

| File | Location | PDF component |
|---|---|---|
| `src/pages/therapist/Prescribe.jsx` | ~L431 select + L436 mapping | `PrescriptionPDF` (single-session) |
| `src/pages/therapist/Prescribe.jsx` | ~L481 select + L487 mapping | `ProgramPDF` |
| `src/pages/therapist/Prescribe.jsx` | ~L562 select + L567 mapping | `AllSessionsPDF` (download) |
| `src/pages/therapist/Prescribe.jsx` | ~L625 select + L630 mapping | `AllSessionsPDF` (email) |
| `src/pages/client/Dashboard.jsx` | ~L149 select + L154 mapping | `PrescriptionPDF` (client download) |
| `src/pages/client/Dashboard.jsx` | ~L204 select + `mapEx` at L216 | `AllSessionsPDF` (client all download) |

In each mapping object, add: `rest_seconds: pe.rest_seconds ?? null` (or `row.rest_seconds ?? null` depending on local variable name).

---

## 5. Copy paths — all locations that duplicate exercise/group data

Every location that copies exercises or groups must carry `rest_seconds`. There are **4 confirmed copy paths**:

### 5.1 `ApplyTemplateModal` — `fetchTemplates` select

File: `src/components/therapist/ApplyTemplateModal.jsx` (~line 40-41)

Add `rest_seconds` to both nested selects:
- `template_exercise_groups(id, label, set_count, order_index, rest_seconds)`
- `template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, ..., rest_seconds, template_exercise_sets(...))`

### 5.2 `ApplyTemplateModal` — `applyAsIs`

Two inserts (~line 131 and ~line 143):
- Group insert: add `rest_seconds: tg.rest_seconds ?? null`
- Exercise insert: add `rest_seconds: te.rest_seconds ?? null`

### 5.3 `ApplyTemplateModal` — `applyCustomised`

Two-step carry is required:

**Step 1 — `startCustomise` (~line 58-79):** initial mapping into `customExercises` state must include:
```js
restSeconds: te.rest_seconds ?? null,
```

**Step 2 — `applyCustomised` group insert (~line 196) and exercise insert (~line 210):**
- Group insert: `rest_seconds: tg.rest_seconds ?? null` (groups are not in camelCase state — read directly from `selectedTemplate.template_exercise_groups`)
- Exercise insert: `rest_seconds: ex.restSeconds ?? null`

### 5.4 `ApplyProgramTemplateModal` — `handleApply`

File: `src/components/therapist/ApplyProgramTemplateModal.jsx`

This modal copies exercises from `template_exercises` but has **no group copying** (supersets not supported — pre-existing gap unrelated to this feature).

- Template exercises select (~line 81): add `rest_seconds`
- Exercise insert (~line 85-101): add `rest_seconds: te.rest_seconds ?? null`

Group `rest_seconds` is silently dropped here because groups are not copied — document this as accepted behaviour.

### 5.5 `Prescribe.jsx` — session reactivation

File: `src/pages/therapist/Prescribe.jsx` (~line 373)

The reactivation flow copies exercises from an existing prescription into a new one. Select string and insert must include `rest_seconds`:
- Select (~L373): add `rest_seconds`
- Insert (~L381-394): add `rest_seconds: e.rest_seconds ?? null`

Note: this flow also has no group copying — same pre-existing gap as `ApplyProgramTemplateModal`.

---

## 6. Data flow summary

```
Therapist creates/edits exercise
  → ExercisePicker passes restSeconds in onAdd payload (0 → null at save time)
  → SessionEdit / TemplateEdit inserts rest_seconds to DB

Therapist creates/edits superset
  → SupersetPickerModal stores rest_seconds on group row (0 → null at save time)

Template applied to session
  → ApplyTemplateModal.applyAsIs: copies rest_seconds on groups + exercises
  → ApplyTemplateModal.applyCustomised: startCustomise carries restSeconds camelCase, insert reads ex.restSeconds
  → ApplyProgramTemplateModal: copies rest_seconds on exercises only (no group copying)

Session reactivated
  → Prescribe.jsx reactivation: copies rest_seconds on exercises (no group copying)

Client opens session
  → SessionWizard fetches prescription_exercises (includes rest_seconds)
  → SessionWizard fetches prescription_exercise_groups (includes rest_seconds)
  → Standalone exercise card shows rest badge if rest_seconds > 0
  → Superset rest screen shows "Rest: Xs" heading if group.rest_seconds > 0

PDF generated
  → Prescribe.jsx / Dashboard.jsx select includes rest_seconds + mapping includes rest_seconds
  → ExerciseTablePDF renders rest line under exercise name if rest_seconds set
  → Group/superset rest NOT rendered in any PDF (no superset PDF rendering path exists)
```

---

## 7. Edge cases

- **0 is never persisted.** The save-time clamp in ExercisePicker and SupersetPickerModal converts 0 → null before the DB write. `formatRest(0)` returns null as a defensive guard only.
- **Grouped exercise members:** rest_seconds field is hidden in their edit panel — rest is a group-level concept for supersets.
- **ApplyProgramTemplateModal and reactivation:** no group copying — group rest_seconds is silently dropped. This is a pre-existing limitation not introduced by this feature.
- **formatRest shared utility:** place in `src/utils/formatRest.js`; imported by `SessionWizard.jsx` and `ExerciseTablePDF.jsx`.
