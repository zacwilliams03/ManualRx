# YouTube Link Upload — Exercise Video Source

**Date:** 2026-06-10
**Scope:** `ExerciseUpload.jsx` video section only. No DB schema changes, no changes to `VideoPlayer`, `ExerciseLibrary`, `SessionEdit`, or the client wizard.

---

## 1. Problem

Therapists who already have exercise videos on YouTube cannot attach them to exercises — the upload form only accepts file uploads. The `VideoPlayer` component already renders YouTube embeds; the gap is solely in the upload form.

---

## 2. Solution

Replace the current "Video file" field in `ExerciseUpload.jsx` with a two-tab control:

```
[ Upload file ] [ YouTube link ]
─────────────────────────────────
  <active tab content>
```

### 2.1 Upload file tab (default)
Identical to today:
- `<input type="file" accept="video/*" />`
- 200 MB cap
- MIME type validation: MP4, WebM, MOV

### 2.2 YouTube link tab
- `<input type="text" />` for pasting a URL
- On change, validate the URL against recognised YouTube patterns:
  - `youtube.com/watch?v=`
  - `youtu.be/`
  - `youtube.com/shorts/`
- Show an inline error if the URL is non-empty and does not match
- Show a live embed preview (via `VideoPlayer`) below the input once valid — therapist can confirm the correct video before saving

### 2.3 Mutual exclusivity
- Switching to "Upload file" clears `youtubeUrl` state
- Switching to "YouTube link" clears `videoFile` state
- Only one source is ever active at submission time

### 2.4 Submission behaviour
- **File tab active:** existing upload flow unchanged — uploads to Supabase Storage, stores the public URL in `video_url`
- **YouTube tab active:** skips Supabase Storage entirely; stores the raw YouTube URL directly in `video_url`
- **Neither active:** `video_url` is `null` (exercise saved without video, same as today)

---

## 3. Validation

| Condition | Behaviour |
|---|---|
| YouTube tab, URL is empty | No error shown; exercise saves without video |
| YouTube tab, URL does not match YouTube patterns | Inline error: "Please enter a valid YouTube URL" |
| YouTube tab, URL is valid | Live preview shown; URL saved on submit |
| File tab, wrong MIME type | Existing error: "Invalid file type…" |
| File tab, file > 200 MB | Existing error: "Video must be under 200 MB." |

---

## 4. Files Affected

| File | Action |
|---|---|
| `src/pages/therapist/ExerciseUpload.jsx` | **Modify** — replace video file input with tab switcher |
| `src/components/VideoPlayer.jsx` | **No change** |

---

## 5. No Schema Changes

`video_url` on the `exercises` table already accepts any string. YouTube URLs and Supabase Storage URLs are both valid values. No migration needed.
