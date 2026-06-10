# YouTube Link Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow therapists to attach a YouTube URL as an exercise video instead of uploading a file, using a two-tab switcher in the exercise upload form.

**Architecture:** All changes are confined to `ExerciseUpload.jsx`. A `videoTab` state (`'file' | 'youtube'`) gates which input is shown. An `isValidYouTubeUrl` helper extracts the video ID using the same logic as `VideoPlayer` and returns true only when a non-empty ID is found. On submit, if the YouTube tab is active and the URL is valid, it is stored directly in `video_url` with no Supabase Storage upload.

**Tech Stack:** React (useState), Supabase JS client, `src/components/VideoPlayer.jsx` (already handles all three YouTube formats)

---

### Task 1: Add state and validation helper

**Files:**
- Modify: `src/pages/therapist/ExerciseUpload.jsx`

- [ ] **Step 1: Add the `VideoPlayer` import and two new state variables**

At the top of `ExerciseUpload.jsx`, add the import after the existing imports:

```js
import VideoPlayer from '../../components/VideoPlayer'
```

Inside the component, after the existing `const [videoFile, setVideoFile] = useState(null)` line, add:

```js
const [videoTab, setVideoTab] = useState('file')
const [youtubeUrl, setYoutubeUrl] = useState('')
```

- [ ] **Step 2: Add the `isValidYouTubeUrl` helper**

Add this function directly before the `handleSubmit` function (outside the component is fine too, but before the component closing brace as a module-level function works — place it just before `export default function ExerciseUpload()`):

```js
function extractYouTubeId(url) {
  try {
    if (url.includes('watch?v=')) {
      return new URL(url).searchParams.get('v') || null
    }
    if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1]?.split('?')[0] || null
    }
    if (url.includes('youtube.com/shorts/')) {
      return url.split('youtube.com/shorts/')[1]?.split('?')[0] || null
    }
    return null
  } catch {
    return null
  }
}

function isValidYouTubeUrl(url) {
  return Boolean(extractYouTubeId(url))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: add videoTab/youtubeUrl state and YouTube URL validator"
```

---

### Task 2: Update `handleSubmit` and `resetForm`

**Files:**
- Modify: `src/pages/therapist/ExerciseUpload.jsx`

- [ ] **Step 1: Update the video block in `handleSubmit`**

Find the current video block in `handleSubmit`:

```js
let publicUrl = null

if (videoFile) {
```

Replace it so the file-upload branch only runs when on the file tab, and a YouTube URL is used directly otherwise:

```js
let publicUrl = null

if (videoTab === 'youtube') {
  if (youtubeUrl && !isValidYouTubeUrl(youtubeUrl)) {
    setError('Please enter a valid YouTube URL.')
    setUploading(false)
    return
  }
  if (youtubeUrl && isValidYouTubeUrl(youtubeUrl)) {
    publicUrl = youtubeUrl
  }
} else if (videoFile) {
```

The rest of the file-upload block (MIME check, size check, Supabase upload, getPublicUrl) is unchanged — just make sure its closing `}` still closes the `else if (videoFile)` branch.

- [ ] **Step 2: Update `resetForm`**

Find the `resetForm` function. After `setVideoFile(null)` add:

```js
setVideoTab('file')
setYoutubeUrl('')
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: handle YouTube URL in handleSubmit; clear new state in resetForm"
```

---

### Task 3: Replace the video section with the tab switcher UI

**Files:**
- Modify: `src/pages/therapist/ExerciseUpload.jsx`

- [ ] **Step 1: Replace the video section JSX**

Find this block in the form JSX (around line 299):

```jsx
{/* Video */}
<div>
  <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Video file</label>
  <input
    type="file"
    accept="video/*"
    onChange={e => setVideoFile(e.target.files[0] ?? null)}
    style={{ fontSize: '13px', color: 'var(--color-muted)', width: '100%' }}
  />
  <p style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '4px' }}>MP4, MOV, or WebM recommended</p>
</div>
```

Replace it entirely with:

```jsx
{/* Video */}
<div>
  <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>
    Video <span style={{ color: 'var(--color-subtle)' }}>(optional)</span>
  </label>

  {/* Tab switcher */}
  <div style={{ display: 'flex', marginBottom: '10px', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
    {[{ value: 'file', label: 'Upload file' }, { value: 'youtube', label: 'YouTube link' }].map(tab => (
      <button
        key={tab.value}
        type="button"
        onClick={() => {
          setVideoTab(tab.value)
          if (tab.value === 'file') setYoutubeUrl('')
          if (tab.value === 'youtube') setVideoFile(null)
        }}
        style={{
          flex: 1, padding: '7px 12px', fontSize: '12px', fontWeight: 500,
          cursor: 'pointer', border: 'none',
          background: videoTab === tab.value ? '#29B5CC' : 'var(--color-elevated)',
          color: videoTab === tab.value ? '#000' : 'var(--color-muted)',
        }}
      >
        {tab.label}
      </button>
    ))}
  </div>

  {videoTab === 'file' ? (
    <>
      <input
        type="file"
        accept="video/*"
        onChange={e => setVideoFile(e.target.files[0] ?? null)}
        style={{ fontSize: '13px', color: 'var(--color-muted)', width: '100%' }}
      />
      <p style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '4px' }}>MP4, MOV, or WebM recommended</p>
    </>
  ) : (
    <>
      <input
        type="text"
        placeholder="https://youtube.com/watch?v=..."
        value={youtubeUrl}
        onChange={e => setYoutubeUrl(e.target.value)}
        style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
      />
      {youtubeUrl && !isValidYouTubeUrl(youtubeUrl) && (
        <p style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '4px' }}>Please enter a valid YouTube URL</p>
      )}
      {isValidYouTubeUrl(youtubeUrl) && (
        <div style={{ marginTop: '10px', borderRadius: '7px', overflow: 'hidden' }}>
          <VideoPlayer url={youtubeUrl} />
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 2: Update the save button label and progress bar**

Find the save button in `PageHero` actions:

```jsx
{uploading ? `Saving… ${uploadProgress}%` : 'Save Exercise'}
```

Replace with:

```jsx
{uploading ? (videoTab === 'file' ? `Saving… ${uploadProgress}%` : 'Saving…') : 'Save Exercise'}
```

Find the progress bar JSX (near the bottom of the form):

```jsx
{uploading && (
  <div style={{ height: '4px', ...
```

Wrap it so it only shows for file uploads:

```jsx
{uploading && videoTab === 'file' && (
  <div style={{ height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
    <div style={{ height: '100%', background: '#29B5CC', width: `${uploadProgress}%`, transition: 'width 0.2s ease', borderRadius: '2px' }} />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: YouTube link tab switcher with live preview in exercise upload"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify Upload file tab (default state)**
  - Navigate to `/therapist/exercises/new`
  - Confirm "Upload file" tab is selected by default
  - Confirm file input and helper text render correctly
  - Fill in Name + at least one Category, attach a small video file, save — confirm exercise is saved and shows "Video" badge in library

- [ ] **Step 3: Verify YouTube link tab — invalid URL**
  - Switch to "YouTube link"
  - Confirm file input is gone
  - Type `https://example.com` — confirm red error "Please enter a valid YouTube URL" appears
  - Confirm no preview renders

- [ ] **Step 4: Verify YouTube link tab — valid URL with preview**
  - Paste a valid YouTube URL (e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
  - Confirm error clears and an embedded YouTube preview appears below the input
  - Save the exercise — confirm it saves and the "Video" badge appears in the library
  - Open the exercise detail page — confirm the YouTube video plays

- [ ] **Step 5: Verify Shorts URL**
  - Paste a YouTube Shorts URL (e.g. `https://www.youtube.com/shorts/XXXXXXXXXXX`)
  - Confirm it is accepted as valid and preview renders

- [ ] **Step 6: Verify tab switching clears state**
  - Paste a valid YouTube URL, switch to "Upload file" — confirm the YouTube input is gone and no URL is retained
  - Switch back to "YouTube link" — confirm input is empty

- [ ] **Step 7: Verify resetForm**
  - Save an exercise with a YouTube URL
  - Click "Add another" — confirm the form resets to "Upload file" tab with empty YouTube input

- [ ] **Step 8: Verify YouTube URL validation at submit time**
  - Switch to "YouTube link", type `https://youtube.com/watch?v=` (no ID), save
  - Confirm error "Please enter a valid YouTube URL." is shown and save is blocked
