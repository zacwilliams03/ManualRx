# Exercise Library Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new anatomy categories, make video upload optional, and add per-row delete for owned custom exercises in ExerciseLibrary.

**Architecture:** Three surgical edits across four files — no new abstractions, no new components. All changes are backwards-compatible with existing data (exercises without `created_by` simply never show the delete button).

**Tech Stack:** Vite + React, Supabase JS client, Tailwind CSS with custom dark-mode tokens.

---

## File Map

| File | Change |
|------|--------|
| `src/pages/therapist/ExerciseUpload.jsx` | CATEGORIES constant; remove video required validation; wrap upload in `if (videoFile)` |
| `src/components/therapist/ExercisePicker.jsx` | CATEGORIES constant only |
| `src/pages/therapist/ExerciseLibrary.jsx` | CATEGORIES constant; add `created_by` to select; add delete handler + delete button per row |

---

### Task 1: Add "Elbow" and "Hand / Wrist" to CATEGORIES in all three files

**Files:**
- Modify: `src/pages/therapist/ExerciseUpload.jsx:7`
- Modify: `src/components/therapist/ExercisePicker.jsx:5-8`
- Modify: `src/pages/therapist/ExerciseLibrary.jsx:8`

- [ ] **Step 1: Update ExerciseUpload.jsx CATEGORIES**

Replace line 7:
```js
const CATEGORIES = ['Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Hip', 'Knee', 'Ankle / Foot', 'General']
```
With:
```js
const CATEGORIES = ['Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General']
```

- [ ] **Step 2: Update ExercisePicker.jsx CATEGORIES**

Replace lines 5-8:
```js
const CATEGORIES = [
  'Custom', 'Cervical', 'Thoracic', 'Lumbar',
  'Shoulder', 'Hip', 'Knee', 'Ankle / Foot', 'General',
]
```
With:
```js
const CATEGORIES = [
  'Custom', 'Cervical', 'Thoracic', 'Lumbar',
  'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General',
]
```

- [ ] **Step 3: Update ExerciseLibrary.jsx CATEGORIES**

Replace line 8:
```js
const CATEGORIES = ['All', 'Custom', 'Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Hip', 'Knee', 'Ankle / Foot', 'General']
```
With:
```js
const CATEGORIES = ['All', 'Custom', 'Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General']
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx src/components/therapist/ExercisePicker.jsx src/pages/therapist/ExerciseLibrary.jsx
git commit -m "feat: add Elbow and Hand / Wrist categories"
```

---

### Task 2: Make video upload optional in ExerciseUpload

**Files:**
- Modify: `src/pages/therapist/ExerciseUpload.jsx:36-70`

The current `handleSubmit` has three problems to fix:
1. Line 36 returns early if no video — remove it.
2. Lines 40-60 (the storage upload + `publicUrl` derivation) always run — wrap in `if (videoFile)`.
3. Line 69 hardcodes `video_url: publicUrl` — `publicUrl` is only defined when `videoFile` is set, so change to `video_url: videoFile ? publicUrl : null`.

- [ ] **Step 1: Remove the `!videoFile` guard and make upload conditional**

Replace the entire `handleSubmit` from `if (!videoFile)` through to the insert so it reads:

```js
async function handleSubmit(e) {
  e.preventDefault()
  setError(null)

  if (!name.trim()) { setError('Name is required.'); return }
  if (categories.length === 0) { setError('Select at least one category.'); return }

  setUploading(true)

  let publicUrl = null

  if (videoFile) {
    const ext = videoFile.name.split('.').pop()
    const filename = `${Date.now()}.${ext}`
    const path = `therapist-videos/${profile.id}/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('exercise-videos')
      .upload(path, videoFile, {
        onUploadProgress: (event) => {
          setUploadProgress(Math.round((event.loaded / event.total) * 100))
        },
      })

    if (uploadError) {
      setError('Video upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl: url } } = supabase.storage
      .from('exercise-videos')
      .getPublicUrl(path)

    publicUrl = url
  }

  const { data, error: insertError } = await supabase
    .from('exercises')
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      category: categories[0],
      categories,
      video_url: publicUrl,
      is_custom: true,
      created_by: profile.id,
      default_sets: defaultSets ? parseInt(defaultSets) : null,
      default_reps: defaultReps ? parseInt(defaultReps) : null,
    })
    .select('id')
    .single()

  if (insertError) {
    setError('Failed to save exercise: ' + insertError.message)
    setUploading(false)
    return
  }

  setUploading(false)
  setUploadedId(data.id)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: make video upload optional in ExerciseUpload"
```

---

### Task 3: Add per-row delete button in ExerciseLibrary

**Files:**
- Modify: `src/pages/therapist/ExerciseLibrary.jsx:42` (select query)
- Modify: `src/pages/therapist/ExerciseLibrary.jsx:114-134` (exercise list rows)

**Requirements:**
- Show delete button only when `ex.is_custom && ex.created_by === profile?.id`
- Style: `border-red-800/40 text-red-400 hover:bg-red-900/20` (consistent with ExerciseDetail delete)
- On click: confirm dialog → supabase delete → remove from local state
- The Link and delete button sit side-by-side; the Link takes remaining space

- [ ] **Step 1: Add `created_by` to the select query**

On line 42, replace:
```js
      .select('id, name, category, categories, video_url, is_custom', { count: 'exact' })
```
With:
```js
      .select('id, name, category, categories, video_url, is_custom, created_by', { count: 'exact' })
```

- [ ] **Step 2: Add the `handleDelete` function** (insert after `fetchExercises`, before `const totalPages`)

```js
  async function handleDelete(id) {
    if (!window.confirm('Delete this exercise? This cannot be undone.')) return
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error) {
      alert('Failed to delete: ' + error.message)
      return
    }
    setExercises(prev => prev.filter(e => e.id !== id))
  }
```

- [ ] **Step 3: Restructure the exercise list rows**

The current row is a plain `<Link>` that fills the row. Replace the `{exercises.map(ex => (` block so each row is a `<div>` containing the Link + optional delete button:

Replace:
```jsx
                {exercises.map(ex => (
                  <Link
                    key={ex.id}
                    to={`/therapist/exercises/${ex.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark-text">{ex.name}</p>
                      <p className="text-xs text-dark-muted">{ex.category}{ex.is_custom ? ' · Custom' : ''}</p>
                    </div>
                    {ex.video_url && (
                      <span className="shrink-0 rounded-full bg-dark-accent-bg px-2.5 py-0.5 text-xs font-medium text-dark-accent">
                        Video attached
                      </span>
                    )}
                  </Link>
                ))}
```

With:
```jsx
                {exercises.map(ex => (
                  <div key={ex.id} className="flex items-center">
                    <Link
                      to={`/therapist/exercises/${ex.id}`}
                      className="flex flex-1 items-center justify-between gap-3 px-4 py-3 hover:bg-dark-elevated transition-colors min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark-text">{ex.name}</p>
                        <p className="text-xs text-dark-muted">{ex.category}{ex.is_custom ? ' · Custom' : ''}</p>
                      </div>
                      {ex.video_url && (
                        <span className="shrink-0 rounded-full bg-dark-accent-bg px-2.5 py-0.5 text-xs font-medium text-dark-accent">
                          Video attached
                        </span>
                      )}
                    </Link>
                    {ex.is_custom && ex.created_by === profile?.id && (
                      <button
                        onClick={() => handleDelete(ex.id)}
                        className="shrink-0 mr-3 rounded border border-red-800/40 px-2 py-1 text-xs text-red-400 hover:bg-red-900/20 cursor-pointer transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/ExerciseLibrary.jsx
git commit -m "feat: add delete button for owned custom exercises in ExerciseLibrary"
```

---

### Task 4: Browser verification & push

- [ ] **Step 1: Start the dev server** (`npm run dev`) and open `/therapist/exercises`
- [ ] **Step 2: Verify category filter pills** — confirm "Elbow" and "Hand / Wrist" appear between "Shoulder" and "Hip"
- [ ] **Step 3: Verify delete button** — custom exercises you own show a red "Delete" button; standard exercises do not
- [ ] **Step 4: Test delete flow** — click Delete on a custom exercise, confirm dialog, verify it disappears from the list
- [ ] **Step 5: Open `/therapist/exercises/new`** — confirm ExercisePicker category list shows Elbow and Hand / Wrist in correct position
- [ ] **Step 6: Test video-optional upload** — fill form with name + category but no video, submit, confirm exercise is saved successfully
- [ ] **Step 7: Test video upload still works** — fill form with name + category + a video file, submit, confirm exercise saves with video
- [ ] **Step 8: Push all commits**

```bash
git push
```
