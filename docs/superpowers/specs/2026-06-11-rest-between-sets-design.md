# Rest Between Sets — Design Spec

**Date:** 2026-06-11
**Status:** Approved

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
- If value is 0 or empty when submitted, pass `restSeconds: null` in the `onAdd` payload
- Otherwise pass `restSeconds: parseInt(value)`
- State: `configRestSeconds` (string, default `''`)

The `onAdd` payload gains a `restSeconds` field. All callers of `ExercisePicker` (`SessionEdit`, `TemplateEdit`) pass `restSeconds` through to their Supabase insert/update — add it alongside the existing fields.

### 2.2 SupersetPickerModal (`src/components/therapist/SupersetPickerModal.jsx`)

Add a "Rest between rounds" row below the existing "Sets (applied to all)" stepper:

- Label: **"Rest between rounds"**
- Input: number input, min 0, step 5, suffix label **"sec"**, styled identically to the sets row
- If 0 or empty → store `null` on the group row; otherwise store the integer
- State: `restSeconds` (string, default `''`), initialised from `editGroup?.rest_seconds ?? ''` in edit mode
- Include `rest_seconds` in the group insert (`handleCreate`) and group update (`handleEdit`)

### 2.3 Inline edit panel in SessionEdit (`src/pages/therapist/SessionEdit.jsx`)

In the existing per-exercise edit panel (sets/reps/weight/notes/tempo fields):

- Add a **"Rest between sets"** number input after the Tempo section
- Hidden for grouped exercises (`pe.group_id != null`) — rest for supersets is on the group, not the member
- Included in the `saveEdit` Supabase `.update({...})` call as `rest_seconds`
- Included in both the `fetchData` initial select string and the `saveEdit` re-fetch select string

### 2.4 Inline edit panel in TemplateEdit

Same as SessionEdit but for `template_exercises`. Ensure `rest_seconds` is in the select string and the update call.

---

## 3. Client Wizard (`src/pages/client/SessionWizard.jsx`)

### 3.1 Standalone exercises

When `pe.rest_seconds` is a positive integer, render a small static badge on the exercise card, below therapist notes (or in the same location if no notes):

```
Rest: 1m 30s between sets
```

Format helper:

```js
function formatRest(seconds) {
  if (!seconds) return null
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}
```

Display: `"Rest: {formatRest(pe.rest_seconds)} between sets"` — plain text in a small teal-tinted or muted style, no border, no timer.

### 3.2 Superset rest screen

When `item.group.rest_seconds` is a positive integer, replace the existing generic `"Rest"` heading with:

```
Rest: 1m 30s
```

The subheading (`"Round N of M starts next"`) stays unchanged. If `rest_seconds` is null, the heading remains `"Rest"` as today.

---

## 4. PDF (`src/components/therapist/ExerciseTablePDF.jsx`)

Inside the Exercise cell (`cellExercise`), after the exercise name, add a rest line when `ex.rest_seconds` is set:

- Text: `"Rest: {formatRest(ex.rest_seconds)} between sets"` (using the same format logic, moved to a shared util or duplicated inline)
- Style: small grey text (`color: GREY, fontSize: 7.5`) — no border box, no background
- Rendered before the existing `notesBox` (therapist notes), so the order in the cell is: name → rest line → notes box

No column width changes. Apply the same rest line in `PerSetRows` — add it inside the `perSetNameRow` section, after the exercise name text, before per-set rows begin.

---

## 5. Data flow summary

```
Therapist creates/edits exercise
  → ExercisePicker passes restSeconds in onAdd payload
  → SessionEdit / TemplateEdit inserts rest_seconds to DB

Therapist creates/edits superset
  → SupersetPickerModal stores rest_seconds on group row

Client opens session
  → SessionWizard fetches prescription_exercises (includes rest_seconds)
  → SessionWizard fetches prescription_exercise_groups (includes rest_seconds)
  → Standalone exercise card shows rest badge if rest_seconds set
  → Superset rest screen shows "Rest: Xs" heading if group.rest_seconds set

PDF generated
  → ExerciseTablePDF renders rest line under exercise name if rest_seconds set
```

---

## 6. Edge cases

- `rest_seconds = 0`: treated as null (no rest shown). Validation: clamp to null on save.
- Grouped exercise members: `rest_seconds` field hidden in their edit panel — rest is a group-level concept for supersets.
- Template → session apply: when a template is applied to create a prescription, `rest_seconds` must be copied from `template_exercises` to `prescription_exercises` and from `template_exercise_groups` to `prescription_exercise_groups`. Verify the apply-template logic includes these columns.
- `formatRest` is a pure utility — place in `src/utils/formatRest.js` and import in both `SessionWizard.jsx` and `ExerciseTablePDF.jsx`.
