# Multi-Category Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow exercises to belong to multiple categories by adding a `categories TEXT[]` column and updating ExerciseUpload, ExerciseLibrary, ExercisePicker, and ExerciseDetail to read/write from it.

**Architecture:** The existing `exercises.category` (single TEXT) column is kept untouched for backward compatibility. A new `categories TEXT[]` column is added alongside it. All inserts write both: `categories` gets the full array, `category` gets `categories[0]`. All filter queries switch from `.eq('category', cat)` to `.contains('categories', [cat])`. Display sites render `categories` joined by ` · `, falling back to `[category]` if `categories` is null/empty (for rows not yet backfilled).

**Tech Stack:** React, Supabase JS client (PostgREST), Tailwind CSS

---

## Files Modified

| File | Change |
|---|---|
| Supabase SQL Editor | Add `categories TEXT[]` column, backfill, notify pgrst |
| `src/pages/therapist/ExerciseUpload.jsx` | Replace `<select>` with checkbox group; write `categories` array + `category: categories[0]` on insert |
| `src/pages/therapist/ExerciseLibrary.jsx` | Add `categories` to select; change `.eq('category', cat)` → `.contains('categories', [cat])` |
| `src/components/therapist/ExercisePicker.jsx` | Add `categories` to both selects; change category filter; update configure view subtitle |
| `src/pages/therapist/ExerciseDetail.jsx` | Add `categories` to select; update displayed category badge |

---

## Task 1: Database Migration

**Files:** Supabase SQL Editor (no local file)

- [ ] **Step 1: Open Supabase SQL Editor for the ManualRx project**

- [ ] **Step 2: Run the migration**

```sql
-- Add the new array column
ALTER TABLE exercises ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}';

-- Backfill from existing single-value column
UPDATE exercises SET categories = ARRAY[category] WHERE category IS NOT NULL;

-- Notify PostgREST to pick up the schema change
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Verify the migration**

Run in SQL Editor:
```sql
SELECT id, name, category, categories FROM exercises LIMIT 5;
```
Expected: every row with a non-null `category` has `categories` = `{<category value>}`. Rows with null `category` have `categories` = `{}`.

---

## Task 2: ExerciseUpload.jsx — Checkbox group for categories

**File:** `src/pages/therapist/ExerciseUpload.jsx`

- [ ] **Step 1: Replace the `category` state with a `categories` array state**

Replace:
```js
const [category, setCategory] = useState('')
```
With:
```js
const [categories, setCategories] = useState([])
```

Add the toggle helper immediately after:
```js
function toggleCategory(cat) {
  setCategories(prev =>
    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
  )
}
```

- [ ] **Step 2: Update the validation check in `handleSubmit`**

Replace:
```js
if (!category) { setError('Category is required.'); return }
```
With:
```js
if (categories.length === 0) { setError('Select at least one category.'); return }
```

- [ ] **Step 3: Update the Supabase insert in `handleSubmit`**

Replace:
```js
      category,
```
With:
```js
      category: categories[0],
      categories,
```

- [ ] **Step 4: Update `resetForm` to clear the array state**

Replace:
```js
    setCategory('')
```
With:
```js
    setCategories([])
```

- [ ] **Step 5: Replace the `<select>` with a checkbox group in the JSX**

Replace the entire Category `<div>` block:
```jsx
            <div>
              <label className="block text-sm font-medium text-dark-text">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
```
With:
```jsx
            <div>
              <label className="block text-sm font-medium text-dark-text">
                Categories <span className="font-normal text-dark-subtle">(select all that apply)</span>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-y-2 gap-x-4">
                {CATEGORIES.map(c => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categories.includes(c)}
                      onChange={() => toggleCategory(c)}
                      className="rounded border-dark-border text-brand-primary focus:ring-brand-primary focus:ring-offset-0 bg-dark-elevated"
                    />
                    <span className="text-sm text-dark-text">{c}</span>
                  </label>
                ))}
              </div>
            </div>
```

- [ ] **Step 6: Verify manually**

Run `npm run dev`, navigate to `/therapist/exercises/new`.
- All 8 checkboxes render (Cervical, Thoracic, Lumbar, Shoulder, Hip, Knee, Ankle / Foot, General)
- Submitting with nothing checked shows "Select at least one category."
- Submitting with two checked inserts both into `categories` and the first into `category`
  - Confirm in Supabase Table Editor

- [ ] **Step 7: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: replace category select with multi-select checkboxes in ExerciseUpload"
```

---

## Task 3: ExerciseLibrary.jsx — Filter against `categories` array column

**File:** `src/pages/therapist/ExerciseLibrary.jsx`

- [ ] **Step 1: Add `categories` to the select query**

Replace:
```js
      .select('id, name, category, video_url, is_custom', { count: 'exact' })
```
With:
```js
      .select('id, name, category, categories, video_url, is_custom', { count: 'exact' })
```

- [ ] **Step 2: Change the category pill filter from `.eq` to `.contains`**

Replace:
```js
    if (category === 'Custom') {
      query = query.eq('is_custom', true)
    } else if (category !== 'All') {
      query = query.eq('category', category)
    }
```
With:
```js
    if (category === 'Custom') {
      query = query.eq('is_custom', true)
    } else if (category !== 'All') {
      query = query.contains('categories', [category])
    }
```

- [ ] **Step 3: Verify manually**

- Click "Shoulder" pill — only exercises with `Shoulder` in their `categories` array appear
- Click "All" — all exercises appear
- Click "Custom" — only custom exercises appear (unchanged)
- An exercise that was backfilled with `categories = {Shoulder}` appears under Shoulder tab

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/ExerciseLibrary.jsx
git commit -m "feat: update ExerciseLibrary category filter to use categories array column"
```

---

## Task 4: ExercisePicker.jsx — Array-aware queries and configure subtitle

**File:** `src/components/therapist/ExercisePicker.jsx`

- [ ] **Step 1: Add `categories` to the `runSearch` select**

Replace:
```js
      .select('id, name, category, default_sets, default_reps, video_url')
      .textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
```
With:
```js
      .select('id, name, category, categories, default_sets, default_reps, video_url')
      .textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
```

- [ ] **Step 2: Add `categories` to the `selectCategory` select and change `.eq` to `.contains`**

Replace:
```js
    let query = supabase.from('exercises').select('id, name, category, default_sets, default_reps, video_url')
    if (cat === 'Custom') query = query.eq('is_custom', true)
    else query = query.eq('category', cat)
```
With:
```js
    let query = supabase.from('exercises').select('id, name, category, categories, default_sets, default_reps, video_url')
    if (cat === 'Custom') query = query.eq('is_custom', true)
    else query = query.contains('categories', [cat])
```

- [ ] **Step 3: Update the configure view subtitle to show all categories**

Replace:
```jsx
            <p className="text-xs text-dark-subtle mt-0.5">{pickerExercise.category}</p>
```
With:
```jsx
            <p className="text-xs text-dark-subtle mt-0.5">
              {(pickerExercise.categories?.length ? pickerExercise.categories : [pickerExercise.category]).filter(Boolean).join(' · ')}
            </p>
```

- [ ] **Step 4: Verify manually**

- In a session's exercise picker, browse "Shoulder" category — exercises with Shoulder in their `categories` array appear
- Browse "Custom" — unchanged
- Search for an exercise by name — results appear
- Click an exercise to configure — subtitle shows all categories joined by ` · ` (e.g. "Shoulder · General")

- [ ] **Step 5: Commit**

```bash
git add src/components/therapist/ExercisePicker.jsx
git commit -m "feat: update ExercisePicker to filter by categories array and show multi-category subtitle"
```

---

## Task 5: ExerciseDetail.jsx — Display all categories

**File:** `src/pages/therapist/ExerciseDetail.jsx`

- [ ] **Step 1: Add `categories` to the select query**

Replace:
```js
        .select('id, name, description, category, video_url, thumbnail_url, is_custom, created_by, default_sets, default_reps')
```
With:
```js
        .select('id, name, description, category, categories, video_url, thumbnail_url, is_custom, created_by, default_sets, default_reps')
```

- [ ] **Step 2: Replace the single-category badge with a multi-category display**

Replace:
```jsx
                <span className="rounded-full bg-dark-elevated px-3 py-0.5 text-xs text-dark-muted">
                  {exercise.category}
                </span>
```
With:
```jsx
                {(exercise.categories?.length ? exercise.categories : [exercise.category]).filter(Boolean).map(cat => (
                  <span key={cat} className="rounded-full bg-dark-elevated px-3 py-0.5 text-xs text-dark-muted">
                    {cat}
                  </span>
                ))}
```

- [ ] **Step 3: Verify manually**

- Navigate to `/therapist/exercises/<id>` for a backfilled exercise — one category badge renders
- Navigate to a newly uploaded exercise with two categories — two badges render side by side

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/ExerciseDetail.jsx
git commit -m "feat: update ExerciseDetail to display all categories as individual badges"
```

---

## Task 6: Final end-to-end verification

- [ ] Restart dev server (`npm run dev`) — no console errors on load
- [ ] ExerciseUpload: upload a new custom exercise selecting "Shoulder" + "General" → verify it appears under both the Shoulder pill and the General pill in ExerciseLibrary
- [ ] ExerciseLibrary: backfilled exercises appear under their original category tabs
- [ ] ExercisePicker (open from Prescribe or TemplateEdit): browse Shoulder → exercise appears; configure view shows "Shoulder · General"
- [ ] ExerciseDetail for the new exercise: two category badges visible
- [ ] ExerciseDetail for a backfilled exercise: one badge visible (from `categories` array after backfill)
- [ ] ExerciseLibrary Custom tab: still shows only custom exercises (unchanged)
- [ ] No errors in Supabase logs for the new queries
