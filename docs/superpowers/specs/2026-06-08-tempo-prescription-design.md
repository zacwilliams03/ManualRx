# Tempo Prescription — Design Spec

**Date:** 2026-06-08  
**Status:** Approved

## Overview

Therapists can optionally prescribe a movement tempo for any exercise using a 4-phase numeric format (e.g. `3-1-2-1`): eccentric (down) → bottom pause → concentric (up) → top pause. Clients see the compact code with a tappable `?` icon that expands a plain-English breakdown. Tempo carries through from templates to sessions.

---

## Decisions

| Question | Decision |
|---|---|
| Number of phases | 4 — eccentric, bottom pause, concentric, top pause |
| Input method | 4 numeric inputs + live plain-English preview (therapist); compact code + expandable breakdown (client) |
| Required? | Optional — toggled off by default |
| Client interaction | Informational only — no logging |
| Storage | 4 integer columns on `prescription_exercises` and `template_exercises` |

---

## Data Model

### Migration

Add 4 nullable integer columns to both exercise tables:

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

A tempo is considered "set" only when all four columns are non-null. Partial state is never saved — if the toggle is on but fields are incomplete, the save is blocked. Valid range: eccentric and concentric minimum 1 (0 has no clinical meaning for a movement phase); pause phases minimum 0 (no pause is valid). Maximum 9 for all phases.

### No changes to `exercise_logs`

Tempo is prescriptive only. Clients do not log actual tempo.

---

## Shared Utility — `formatTempo`

`src/utils/formatTempo.js` is a **new file** to create. It is imported by ExercisePicker, SessionEdit, TemplateEdit, and SessionWizard — never inlined.

```js
// src/utils/formatTempo.js
export function formatTempo(eccentric, bottomPause, concentric, topPause) {
  if ([eccentric, bottomPause, concentric, topPause].some(v => v == null)) return null
  return {
    compact: `${eccentric}-${bottomPause}-${concentric}-${topPause}`,
    breakdown: [
      { value: eccentric,    label: 'sec on the way down' },
      { value: bottomPause,  label: 'sec hold at the bottom' },
      { value: concentric,   label: 'sec on the way up' },
      { value: topPause,     label: 'sec hold at the top' },
    ],
  }
}
```

Returns `null` when tempo is not set (all four values must be present).

---

## Components

### ExercisePicker.jsx

**Configure step additions:**
- A toggle labelled "Tempo" with an "optional" badge, off by default, positioned between the weight input and the notes field.
- When toggled on: four number inputs (DOWN, HOLD, UP, TOP) rendered in a row with dash separators.
- Below the inputs: a live plain-English preview from `formatTempo`, shown in a muted blue box. Updates as values change.
- When toggled off: any entered tempo values are discarded (not passed in the callback).

**Validation lives inside `handleConfirmAdd()`, before `onAdd()` is called.** If the toggle is on and any field is empty or out of range, set an inline error and return early — `onAdd()` is never invoked for invalid state.

**`onAdd()` callback signature** — extends the existing 7-field signature (`exerciseId, sets, reps, weight, notes, measurementType, bilateral`) with four new nullable fields:

```js
onAdd({
  exerciseId,
  sets,
  reps,
  weight,
  notes,
  measurementType,
  bilateral,
  tempoEccentric,    // integer | null
  tempoBottomPause,  // integer | null
  tempoConcentric,   // integer | null
  tempoTopPause,     // integer | null
})
```

All four tempo fields are `null` when the toggle is off. Both callers (SessionEdit and TemplateEdit) receive and handle these fields.

### SessionEdit.jsx

**Display mode:**
- If tempo is set, show a `⏱ 3-1-2-1` badge (monospace, blue-tinted) inline with the sets/reps/weight summary line.
- If not set, nothing is shown (no empty state).

**Edit mode:**
- Same four inputs as ExercisePicker, with the same toggle pattern.
- Toggle initialises to "on" if the exercise already has all four tempo values, "off" otherwise.
- Clearing tempo (toggling off and saving) sets all four columns to `null`.

**Queries:**
- `fetchData()` — the initial load select on `prescription_exercises` must include `tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause`. If omitted, the edit toggle will always initialise to "off" even for exercises with tempo set.
- The update mutation must also include all four columns.

### TemplateEdit.jsx

- Same display and edit behaviour as SessionEdit, but operating on `template_exercises`.
- All selects and insert/update calls include the four tempo columns.

### Template → Session assignment — `ApplyTemplateModal.jsx`

Two copy paths exist in this file:

1. **`applyAsIs`** (line ~116): maps `template_exercises` → inserts into `prescription_exercises`. The `exerciseRows` mapping must include `tempo_eccentric`, `tempo_bottom_pause`, `tempo_concentric`, `tempo_top_pause`.
2. **`applyCustomised`** (line ~151): same insert path after user edits. Same four fields required.

The `template_exercises` select at the top of this file (line ~40) currently fetches `sets, reps, weight, therapist_notes, measurement_type, bilateral` — the four tempo columns must be added here so they are available for both copy paths.

### SessionWizard.jsx (client)

**Exercise view:**
- If tempo is set: show the compact code (`3-1-2-1`) with a small circular `?` icon to the right.
- Tapping `?` toggles a breakdown panel beneath the tempo row. The panel is a 2-column grid: each number (in monospace blue) next to its plain-English label.
- Tapping `?` again collapses the panel.
- If tempo is not set: row is not rendered at all.
- Tempo row sits below the sets/reps/weight line and above the therapist notes box.

**Toggle state:** SessionWizard steps through exercises one at a time. Use a single `showTempo` boolean that resets to `false` on each exercise step change. No per-exercise map needed.

**Query:** The prescription_exercises select must include the four tempo columns.

---

## Validation

- Eccentric and concentric: integer, min 1, max 9.
- Pause phases (bottom and top): integer, min 0, max 9.
- Use `type="number"` inputs with `min` and `max` attributes accordingly.
- If the tempo toggle is on, all four fields must be filled and in range before saving. Validation runs inside the component (ExercisePicker's `handleConfirmAdd`, SessionEdit's save handler) and shows an inline error — `onAdd()` / the update mutation is never called with invalid state.
- `formatTempo` returns `null` for any partial state — all consumers guard on null before rendering.

### PDF Components

Three PDF components render exercises identically using `@react-pdf/renderer` — all need the same tempo addition:

- `src/components/therapist/PrescriptionPDF.jsx` — single session export
- `src/components/therapist/AllSessionsPDF.jsx` — all sessions export
- `src/components/therapist/ProgramPDF.jsx` — program export

**Current exercise meta line pattern** (same in all three):
```jsx
{ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
{ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
{ex.bilateral ? ' — Both sides' : ''}
```

**Addition:** append ` — Tempo: {compact}` using `formatTempo`, consistent with the bilateral pattern. No interactive `?` in a PDF — show the compact code only. If tempo is null, nothing is appended.

```jsx
{(() => { const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause); return t ? ` — Tempo: ${t.compact}` : '' })()}
```

The data shapes passed into these components (from wherever they are called) must include the four tempo columns so they are available on each `ex` object.

---

## Out of Scope

- Client logging actual tempo performed
- Per-rep tempo timer or countdown
- Non-numeric tempo notation (e.g. "X" for explosive)
- Filtering or searching exercises by tempo
