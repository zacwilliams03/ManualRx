# Supersets — Therapist Prescription & Client Session

**Date:** 2026-06-10
**Scope:** Therapist prescription builder + client session wizard. No changes to exercise library, PDF export, or program templates.
**Not in scope:** Template copying of supersets (deferred — templates will flatten superset groups to standalone exercises when applied until a follow-up spec addresses it).

---

## 1. Data Model

### 1.1 New table: `prescription_exercise_groups`

```sql
CREATE TABLE prescription_exercise_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT '',   -- e.g. "Superset A"
  set_count       int  NOT NULL,              -- shared by all member exercises
  order_index     int  NOT NULL,              -- position in session among all items
  created_at      timestamptz DEFAULT now()
);
```

### 1.2 Alter `prescription_exercises`

Two new nullable columns:

```sql
ALTER TABLE prescription_exercises
  ADD COLUMN group_id          uuid REFERENCES prescription_exercise_groups(id) ON DELETE CASCADE,
  ADD COLUMN position_in_group int,
  ADD COLUMN order_index       int;
```

**Ordering rules:**
- Standalone exercises (`group_id IS NULL`) use their own `order_index` for session position.
- Grouped exercises (`group_id IS NOT NULL`) use their group's `order_index` for session position, and `position_in_group` for ordering within the block.
- On migration, backfill `order_index` for all existing `prescription_exercises` rows with their current insertion order (rownum ascending by `id`).

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
CREATE POLICY "groups_client_read" ON prescription_exercise_groups
  FOR SELECT TO authenticated
  USING (
    prescription_id IN (
      SELECT p.id FROM prescriptions p
      JOIN clients c ON c.therapist_id = p.therapist_id
      WHERE c.user_id = auth.uid() AND p.client_id = c.id
    )
  );
```

---

## 2. Therapist UX — `src/pages/therapist/SessionEdit.jsx`

### 2.1 Data fetch

Add `prescription_exercise_groups` to the parallel fetch:

```js
supabase
  .from('prescription_exercise_groups')
  .select('id, label, set_count, order_index')
  .eq('prescription_id', sessionId)
  .order('order_index', { ascending: true })
```

Update the `prescription_exercises` fetch to also select `group_id, position_in_group, order_index`.

Build a unified `items` array from the fetched data — a sorted mix of standalone exercises and superset groups:

```js
// Each item is either:
// { type: 'exercise', ...prescriptionExercise }
// { type: 'superset', group: { id, label, set_count, order_index }, exercises: [...] }
```

Sort `items` by `order_index` (standalone) or `group.order_index` (grouped).

### 2.2 "Add superset" button

Render alongside the existing "Add exercise" button at the bottom of the exercise list:

```jsx
<button onClick={() => setShowSupersetModal(true)}>
  ⚡ Add superset
</button>
```

### 2.3 `SupersetPickerModal` component

New component at `src/components/therapist/SupersetPickerModal.jsx`.

**Props:** `prescriptionId`, `onAdd(group, exercises)`, `onClose`

**Behaviour:**
- Reuses the same exercise search/filter logic as the existing `ExercisePicker`
- Maintains a `selected` array of exercise objects (ordered by selection order)
- Enforces minimum 2 exercises before the confirm button is active
- Shared set count stepper (integer ≥ 1, default 3) applied to all selected exercises
- On confirm:
  1. Insert one row into `prescription_exercise_groups` — label auto-assigned as "Superset A/B/C…" based on count of existing groups; `order_index` = current max `order_index` + 1
  2. Insert one row per selected exercise into `prescription_exercises` with `group_id`, `position_in_group` (0-indexed), `sets` = `set_count`, and `order_index = NULL` (grouped exercises don't use their own order_index for session position)
  3. Call `onAdd` with the new group and exercises

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
- Each member exercise is individually expandable for reps/weight/notes (same panel as standalone exercises)
- **Edit:** re-opens a simplified variant of `SupersetPickerModal` pre-populated with current members; therapist can add/remove exercises. Set count is editable. On save, deletes removed exercises and inserts new ones; updates `set_count` on the group row.
- **Ungroup:** deletes the `prescription_exercise_groups` row (cascade deletes all member `prescription_exercises`), then re-inserts members as standalone exercises with sequential `order_index` values
- **+ Add exercise to superset:** inline exercise search that appends to the group

### 2.5 Order index management

When the therapist adds an exercise or superset, assign `order_index = currentMaxOrderIndex + 1`.

No drag-and-drop reordering is in scope for this spec — exercises/supersets render in insertion order, consistent with current behaviour.

---

## 3. Client Session Wizard — `src/pages/client/SessionWizard.jsx`

### 3.1 Data fetch

Extend the existing `prescription_exercises` select to include `group_id, position_in_group, order_index`. Add a parallel fetch for `prescription_exercise_groups`.

### 3.2 Session items model

After fetching, build a `sessionItems` array (replaces the flat `exercises` array for step navigation):

```js
// sessionItems: Array<StandaloneItem | SupersetItem>
// StandaloneItem: { type: 'exercise', orderIndex, ex: {...exerciseWithSetsData} }
// SupersetItem:   { type: 'superset', orderIndex, group: {...}, currentRound: 0,
//                   exercises: [{ ex, setsData }], roundsDone: [] }
```

Sort by `orderIndex`. The existing per-exercise state (`setsData`, `painRating`, `clientNotes`, `videoFile`) migrates unchanged — it just lives inside the item.

### 3.3 Step state

`step` changes from an exercise index to an item index into `sessionItems`:
- `'intro'` → unchanged
- `{ itemIndex: number }` → current session item
- `{ itemIndex: number, restAfterRound: number }` → rest screen between superset rounds
- `'summary'` → unchanged

### 3.4 Superset round screen

When `sessionItems[step.itemIndex].type === 'superset'`, render the round screen:

**Header:**
```
⚡ Superset A    Round 2 of 3
```

**Body:** one card per exercise in the superset (stacked, full-width), each showing:
- Exercise name
- Target: `{reps} reps · {weight}` (or seconds if timed)
- Reps/weight inputs (same stepper as current per-set inputs)
- "▶ Video" button — toggles an inline VideoPlayer directly below that exercise card (collapsed by default so all exercise targets are visible without scrolling; only one video open at a time)
- Therapist notes (if set), collapsed behind a toggle

**Footer:**
```
[Complete round 2 → rest]
```

On "Complete round":
- Capture `setsData` for this round for all exercises
- If `currentRound + 1 < set_count`: advance to rest screen (`{ itemIndex, restAfterRound: currentRound }`)
- If `currentRound + 1 === set_count`: advance to next session item

**Rest screen** (`step.restAfterRound` is set):
- Shows "Superset A — Round N complete"
- Lists each exercise with the logged reps/weight from that round (as a confirmation summary)
- "Start Round N+1 →" button advances `currentRound` and returns to the round screen

### 3.5 Progress bar

The session progress bar counts `sessionItems` (not individual exercises), so a superset group counts as one item. Label shows "Item N of M" for mixed sessions, or the existing "Exercise N of M" when all items are standalone.

### 3.6 Completion / logging

On session complete, iterate `sessionItems` and emit one `exercise_log` per exercise (same schema as today). Superset membership is not recorded in the log — the flat per-exercise log is sufficient. No schema changes to `exercise_logs`.

---

## 4. Files Affected

| File | Action |
|---|---|
| `supabase/migrations/<timestamp>_supersets.sql` | **Create** — new table, alter, RLS, backfill |
| `src/components/therapist/SupersetPickerModal.jsx` | **Create** — superset creation/edit modal |
| `src/pages/therapist/SessionEdit.jsx` | **Modify** — fetch groups, build items, render superset blocks, wire modal |
| `src/pages/client/SessionWizard.jsx` | **Modify** — sessionItems model, superset round screen, rest screen, progress |

`ApplyTemplateModal.jsx` and `ApplyProgramTemplateModal.jsx` are **not** modified — they will copy exercises without group metadata (supersets flatten to standalone exercises when a template is applied). This is the deferred behaviour noted in scope.

---

## 5. Label Auto-assignment

Superset groups are auto-labelled "Superset A", "Superset B", "Superset C" etc. by counting existing groups on the prescription at creation time. The label is stored in the DB and is editable by the therapist inline (click-to-edit on the group header label).

---

## 6. Edge Cases

| Scenario | Behaviour |
|---|---|
| Superset with 1 exercise | Prevented — "Add to session" button disabled until ≥ 2 selected |
| Set count = 1 | Valid — single round, no rest screen shown |
| Client opens session before therapist adds any supersets | No change — `sessionItems` will contain only `type: 'exercise'` items, wizard is identical to today |
| Existing sessions (no `order_index` set) | Backfill migration sets `order_index` from insertion order; no functional change to existing sessions |
