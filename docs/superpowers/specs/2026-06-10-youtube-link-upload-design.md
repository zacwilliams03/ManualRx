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
Identical to today — do not change the existing validation logic or the `allowedMimeTypes` array. No re-description of MIME types.

### 2.2 YouTube link tab
- `<input type="text" />` for pasting a URL
- The preview component is `src/components/VideoPlayer.jsx` (the shared one). Do not use the inline video renderer in `ExerciseDetail.jsx`.
- Accepted URL patterns (same set handled by `VideoPlayer`):
  - `youtube.com/watch?v=`
  - `youtu.be/`
  - `youtube.com/shorts/`
- **Validation rule:** the URL is considered valid only when a non-empty video ID can actually be extracted from it, using the same extraction logic as `VideoPlayer`:
  - `watch?v=`: `new URL(url).searchParams.get('v')` must be non-empty
  - `youtu.be/`: segment after `youtu.be/` (before `?`) must be non-empty
  - `youtube.com/shorts/`: segment after `youtube.com/shorts/` (before `?`) must be non-empty
  - If the pattern matches but the extracted ID is empty/null, treat as invalid
- Show an inline error if the URL is non-empty and does not match or yields an empty ID. Error text: `"Please enter a valid YouTube URL"`. The error clears as soon as the URL becomes valid — error display on each keystroke is intentional and harmless.
- Show a live embed preview (via `src/components/VideoPlayer.jsx`) below the input once valid — therapist can confirm the correct video before saving.

### 2.3 Mutual exclusivity
- Switching to "Upload file" clears `youtubeUrl` state
- Switching to "YouTube link" clears `videoFile` state
- Only one source is ever active at submission time

### 2.4 Submission behaviour
- **File tab active:** existing upload flow unchanged — uploads to Supabase Storage, stores the public URL in `video_url`
- **YouTube tab active:** skips Supabase Storage entirely; stores the raw YouTube URL directly in `video_url`
- **Neither active:** `video_url` is `null` (exercise saved without video, same as today)

### 2.5 Form reset
`resetForm()` must also clear the new state: `youtubeUrl` → `''` and `videoTab` → `'file'`. This is called after a successful save ("Add another" button) and must not leave stale YouTube state.

---

## 3. Validation

| Condition | Behaviour |
|---|---|
| YouTube tab, URL is empty | No error shown; exercise saves without video |
| YouTube tab, URL matches pattern but extracted ID is empty | Inline error: "Please enter a valid YouTube URL" |
| YouTube tab, URL does not match any YouTube pattern | Inline error: "Please enter a valid YouTube URL" |
| YouTube tab, URL is valid (non-empty ID extracted) | Live preview shown; URL saved on submit |
| File tab, wrong MIME type | Existing error: "Invalid file type…" |
| File tab, file > 200 MB | Existing error: "Video must be under 200 MB." |

---

## 4. Files Affected

| File | Action |
|---|---|
| `src/pages/therapist/ExerciseUpload.jsx` | **Modify** — replace video file input with tab switcher; update `resetForm()` |
| `src/components/VideoPlayer.jsx` | **No change** |

> Note: `ExerciseDetail.jsx` has its own inline video renderer that does not handle `shorts/` URLs — this is a pre-existing gap and is out of scope for this spec.

---

## 5. No Schema Changes

`video_url` on the `exercises` table already accepts any string. YouTube URLs and Supabase Storage URLs are both valid values. No migration needed.
