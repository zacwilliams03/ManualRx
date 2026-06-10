# Supersets — Therapist Prescription & Client Session

**Date:** 2026-06-10
**Scope:** Therapist prescription builder + client session wizard. No changes to exercise library, PDF export, or program templates.
**Not in scope:** Template copying of supersets (deferred — templates will flatten superset groups to standalone exercises when applied). Per-round differentiated targets within a superset (e.g. Round 1: 12 reps, Round 2: 10 reps) are deferred to a follow-up spec; v1 supersets are **flat-only** (same target every round).

---

## 1. Data Model

### 1.1 New table: `prescription_exercise_groups`

```sql
CREATE TABLE prescription_exercise_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT '',   -- e.g. "Superset A"
  set_count       int  NOT NULL,              -- shared round count for all member exercises
  order_index     int  NOT NULL,              -- position in session, shared namespace with standalone exercises
  created_at      timestamptz DEFAULT now()
);
```

### 1.2 Alter `prescription_exercises`

Three new nullable columns:

```sql
ALTER TABLE prescription_exercises
  ADD COLUMN group_id          uuid REFERENCES prescription_exercise_groups(id) ON DELETE CASCADE,
  ADD COLUMN position_in_group int,
  ADD COLUMN order_index       int;
```

**Backfill for existing rows:**

```sql
-- Backfill order_index using created_at for deterministic insertion order.
-- IMPORTANT: Verify that prescription_exercises has a created_at column before
-- running this migration. All Supabase-dashboard-created tables include it by
-- default, but confirm via \d prescription_exercises or the Supabase table editor.
-- If the column does not exist, add it first:
--   ALTER TABLE prescription_exercises ADD COLUMN created_at timestamptz DEFAULT now();
-- then re-run the backfill.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY prescription_id ORDER BY created_at ASC, id ASC) AS rn
  FROM prescription_exercises
)
UPDATE prescription_exercises pe
SET order_index = r.rn
FROM ranked r
WHERE pe.id = r.id;
```

**Ordering rules:**
- Standalone exercises (`group_id IS NULL`) use `order_index` for session position.
- Grouped exercises (`group_id IS NOT NULL`) use their group's `order_index` for session position, and `position_in_group` (0-indexed) for ordering within the block. Their own `order_index` is `NULL`.
- `order_index` values are unique within a prescription across both `prescription_exercise_groups` and standalone `prescription_exercises` — the application assigns them from a shared incrementing counter (`max(existing order_index values across both tables) + 1`). If two items share the same `order_index` (only possible through a bug), secondary sort on `created_at ASC` acts as a tiebreaker.

### 1.3 RLS for `prescription_exercise_groups`

```sql
ALTER TABLE prescription_exercise_groups ENABLE ROW LEVEL SECURITY;

-- Therapist: full access to their own prescriptions' groups
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

-- Client: read-only access to groups for their own prescriptions
-- Shape matches the working prescription_exercises_client_read policy exactly.
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

---

## 2. Therapist UX — `src/pages/therapist/SessionEdit.jsx`

### 2.1 Data fetch

In `SessionEdit`, `sessionId` is the `prescriptions.id` value — consistent with the rest of the file.

Add `prescription_exercise_groups` to the parallel fetch in `fetchData`:

```js
supabase
  .from('prescription_exercise_groups')
  .select('id, label, set_count, order_index, created_at')
  .eq('prescription_id', sessionId)
  .order('order_index', { ascending: true })
```

Update the `prescription_exercises` fetch to also select `group_id, position_in_group, order_index`.

Build a unified `items` array from the fetched data:

```js
// Each item is one of:
// { type: 'exercise', orderIndex: number, ex: prescriptionExerciseRow }
// { type: 'superset', orderIndex: number, group: groupRow, exercises: prescriptionExerciseRow[] }
```

Construct `items` by:
1. Collecting all groups (each becomes a `type: 'superset'` item with its member exercises filtered from the exercises result and sorted by `position_in_group`)
2. Collecting standalone exercises (`group_id === null`), each as a `type: 'exercise'` item
3. Sorting all items by `orderIndex`, tiebreaking on `created_at ASC`

### 2.2 "Add superset" button

Render alongside the existing "Add exercise" button at the bottom of the exercise list:

```jsx
<button onClick={() => setShowSupersetModal(true)}>
  ⚡ Add superset
</button>
```

### 2.3 `SupersetPickerModal` component

New component at `src/components/therapist/SupersetPickerModal.jsx`.

**Props:** `prescriptionId`, `existingGroupCount`, `currentMaxOrderIndex`, `onAdd(group, exercises)`, `onClose`

**Behaviour:**
- Implements its own single-view exercise search: a text input that filters the therapist's exercise library by name, displaying results as a scrollable list. Does not reuse or extend `ExercisePicker` (which is a three-view stateful component for configuring a single exercise — different UX contract).
- Maintains a `selected` array of exercise objects in selection order
- Minimum 2 exercises required before the confirm button is active
- Shared set count stepper (integer ≥ 1, default 3); this is the round count for all member exercises
- On confirm:
  1. Insert one row into `prescription_exercise_groups`:
     - `label`: "Superset A" / "B" / "C" … computed from `existingGroupCount`
     - `set_count`: chosen value
     - `order_index`: `currentMaxOrderIndex + 1`
  2. Insert one `prescription_exercises` row per selected exercise:
     - `group_id`: newly created group id
     - `position_in_group`: 0-indexed selection order
     - `sets`: `set_count` (so `setsData: Array(pe.sets || 1)` initialiser in the wizard works correctly)
     - `reps`, `weight`: use exercise defaults (`exercises.default_reps`, `0`) as starting values — therapist edits them in the builder afterwards
     - `order_index`: `NULL` (grouped exercises don't participate in session-level ordering)
     - No `prescription_exercise_sets` rows are created — flat-only for v1
  3. Call `onAdd(group, exercises)` to append the superset block to the local `items` state

### 2.4 Superset block rendering in the builder

When an item is `type: 'superset'`, render a teal-bordered block:

```
┌─ ⚡ Superset A · 3 sets ─────────── [Edit] [Ungroup] ─┐
│  ⠿  Romanian Deadlift        × 10 · 40 kg        [···] │
│  ⠿  Nordic Hamstring Curl    × 8                 [···] │
│  + Add exercise to superset                            │
└────────────────────────────────────────────────────────┘
```

- Teal left-border strip on each member exercise
- Each member exercise is individually expandable for reps/weight/notes via the existing edit panel (flat values only — no per-set toggle for superset members in v1)
- **+ Add exercise to superset:** inline search (same single-view pattern as the modal) appends a new `prescription_exercises` row with `group_id` and `position_in_group = current member count`

**Edit:**
- Re-opens a simplified `SupersetPickerModal` pre-populated with current members
- Set count is editable
- Adding exercises: insert new `prescription_exercises` rows as above
- Removing exercises: **blocked if any `exercise_logs` rows exist referencing that `prescription_exercise.id`**. If blocked, show a toast: "This exercise has been logged — remove it from the superset by ungrouping and deleting it separately." If no logs exist, delete the row.
- On save: `UPDATE prescription_exercise_groups SET set_count = newValue, label = newLabel WHERE id = groupId`; also `UPDATE prescription_exercises SET sets = newValue WHERE group_id = groupId`

**Ungroup:**
- **If any member exercise has `exercise_logs`:** blocked — show toast "This superset has logged sessions. Ungroup is not available."
- **If no logs exist:** `UPDATE prescription_exercises SET group_id = NULL, position_in_group = NULL, order_index = <group.order_index + i> WHERE group_id = groupId` (assigns sequential `order_index` starting from the group's own `order_index`, preserving all `prescription_exercise.id` values so no logs are orphaned). Then `DELETE FROM prescription_exercise_groups WHERE id = groupId`.

### 2.5 Order index management

When adding a standalone exercise or a new superset group, compute `newOrderIndex` as:

```js
const maxStandalone = Math.max(0, ...items.filter(i => i.type === 'exercise').map(i => i.orderIndex))
const maxGroup = Math.max(0, ...items.filter(i => i.type === 'superset').map(i => i.orderIndex))
const newOrderIndex = Math.max(maxStandalone, maxGroup) + 1
```

No drag-and-drop reordering is in scope — exercises/supersets render in insertion order.

---

## 3. Client Session Wizard — `src/pages/client/SessionWizard.jsx`

### 3.1 Data fetch

Extend the existing `prescription_exercises` select to include `group_id, position_in_group, order_index`. Add a parallel fetch for `prescription_exercise_groups` (same select shape as §2.1).

### 3.2 Session items model

After fetching, build a `sessionItems` array using the same construction logic as §2.1. Each item carries the same per-exercise client-side state as today:

```js
// StandaloneItem:
// { type: 'exercise', orderIndex, ex: { ...peRow, setsData, painRating, clientNotes, videoFile } }
//
// SupersetItem:
// { type: 'superset', orderIndex, group: groupRow, currentRound: 0,
//   exercises: [{ ex: peRow, setsData: Array(group.set_count).fill({ reps: '', weight: '' }),
//                 painRating: null, clientNotes: '', videoFile: null }] }
```

`setsData` for each superset member has `group.set_count` slots — one per round — consistent with `pe.sets === group.set_count` (§2.3). The `setsData` initialiser already does `Array(pe.sets || 1)` so no wizard initialisation code changes are needed.

The existing flat `exercises` state array is replaced by `sessionItems`. References to `exercises[step]` become `sessionItems[step.itemIndex]`.

### 3.3 Step state

`step` changes from a plain index to a discriminated value:
- `'intro'` — unchanged
- `{ itemIndex: number }` — current session item (standalone exercise or superset round)
- `{ itemIndex: number, restAfterRound: number }` — rest screen between superset rounds
- `'summary'` — unchanged (renamed from `'done'` — verify current value in the file; it may be `'done'` not `'summary'`, preserve whatever the file uses)

### 3.4 Superset round screen

When `step.itemIndex` resolves to a `type: 'superset'` item, render the round screen:

**Header:**
```
⚡ Superset A    Round 2 of 3
```

**Body:** one card per exercise in the superset (stacked, full-width), each showing:
- Exercise name, target (`{reps} reps · {weight}` or seconds if `measurement_type === 'seconds'`)
- Reps/weight inputs for this round (same stepper as current per-set inputs), pre-filled with target values
- "▶ Video" button — toggles an inline VideoPlayer directly below that exercise card (collapsed by default; only one video open at a time — opening a second collapses the first)
- Therapist notes (if set), collapsed behind a toggle

**Footer:**
```
[Complete round N → rest]   (if more rounds remain)
[Complete round N → finish]  (if this is the last round)
```

On "Complete round":
- The reps/weight inputs for this round write into `exercise.setsData[currentRound]` for each member exercise
- If `currentRound + 1 < group.set_count`: set step to `{ itemIndex, restAfterRound: currentRound }` and increment `currentRound` on the item
- If `currentRound + 1 === group.set_count`: advance to next `sessionItems` item

**Rest screen** (`step.restAfterRound !== undefined`):
- Header: "Superset A — Round N complete"
- Body: lists each exercise with logged reps/weight from that round (confirmation summary)
- Footer: "Start Round N+1 →" — clears `restAfterRound` and returns to the round screen at the new `currentRound`
- No rest screen shown when `set_count === 1` (single round goes straight to next item)

### 3.5 Progress bar

Progress counts `sessionItems.length` (not individual exercises). Label: "Exercise N of M" when all items are standalone (preserves existing label); "Step N of M" when the session contains at least one superset.

### 3.6 Completion / logging

On session complete, iterate `sessionItems` and emit one `exercise_log` per exercise across all items:

```js
// Standalone item → one exercise_log, same as today
// Superset item → one exercise_log per member exercise

// For a superset member, sets_data is the setsData array accumulated across all rounds:
// setsData[0] = round 1 actuals, setsData[1] = round 2 actuals, etc.
// This is structurally identical to the existing per-set log format (array of {reps, weight}).
```

No changes to `exercise_logs` schema. Superset membership is not recorded in logs.

---

## 4. Files Affected

| File | Action |
|---|---|
| `supabase/migrations/<timestamp>_supersets.sql` | **Create** — new table, alter, RLS, backfill (verify `created_at` column first) |
| `src/components/therapist/SupersetPickerModal.jsx` | **Create** — superset creation modal with single-view exercise search |
| `src/pages/therapist/SessionEdit.jsx` | **Modify** — fetch groups, build items, render superset blocks, wire modal |
| `src/pages/client/SessionWizard.jsx` | **Modify** — sessionItems model, superset round screen, rest screen, progress |

`ApplyTemplateModal.jsx` and `ApplyProgramTemplateModal.jsx` are **not** modified — supersets flatten to standalone exercises when a template is applied (deferred).

---

## 5. Label Auto-assignment

Superset groups are auto-labelled "Superset A", "Superset B", "Superset C" etc. by counting existing groups on the prescription at creation time (`existingGroupCount` prop on `SupersetPickerModal`). The label is stored in the DB and editable inline (click-to-edit on the group header in the builder).

---

## 6. Edge Cases

| Scenario | Behaviour |
|---|---|
| Superset with 1 exercise | Prevented — "Add to session" button disabled until ≥ 2 selected |
| Set count = 1 | Valid — single round completes with no rest screen |
| Client opens session with no supersets | `sessionItems` contains only `type: 'exercise'` items; wizard is identical to today |
| Existing sessions after migration | `order_index` backfilled from `created_at` order; no functional change to existing sessions |
| Ungroup with logged exercises | Blocked with toast — therapist must delete exercises individually |
| Remove member from superset with logs | Blocked with toast for that specific exercise; other members unaffected |
| Two items with same `order_index` | Secondary sort by `created_at ASC` ensures deterministic order; should not occur in practice |
