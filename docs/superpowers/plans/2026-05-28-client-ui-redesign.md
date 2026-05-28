# Client UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Upgrade the client-facing UI to match the therapist's glassmorphism design language — glass cards, shimmer accents, Framer Motion animations, and PageHero section headers — without touching backend logic, auth, or navigation structure.

**Architecture:** Move `PageHero.jsx` from `src/components/therapist/` to `src/components/shared/` so both sides share it. Client pages import `CARD`/`SHIMMER`/`SECTION_LABEL` constants from the existing `src/components/therapist/styles.js`. All styling is converted from Tailwind classes to the same inline style objects the therapist side uses.

**Tech Stack:** React 18, Vite, Tailwind CSS (for layout only after this), Framer Motion (already installed), Supabase (no changes)

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/therapist/PageHero.jsx` | Move to `src/components/shared/PageHero.jsx` |
| `src/pages/therapist/*.jsx` (10 files) | Update PageHero import path |
| `src/components/client/BottomNav.jsx` | Glass border-top + backdrop blur |
| `src/pages/client/Dashboard.jsx` | PageHero + glass cards + stagger animation |
| `src/pages/client/History.jsx` | PageHero + glass cards + inline tab bar |
| `src/pages/client/Settings.jsx` | PageHero + glass cards + button styles |
| `src/pages/client/SessionWizard.jsx` | Glass cards + set counter pulse animation |

---

## Task 1: Move PageHero to shared and update therapist imports

**Files:**
- Create: `src/components/shared/PageHero.jsx`
- Delete: `src/components/therapist/PageHero.jsx`
- Modify: 10 therapist page files (import path only)

- [x] **Step 1: Create the shared directory and copy PageHero**

Create `src/components/shared/PageHero.jsx` with this exact content (unchanged from original — the `'../ParticleBackground'` import stays identical since `shared/` and `therapist/` are both one level below `components/`):

```jsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ParticleBackground from '../ParticleBackground'

export default function PageHero({ title, subtitle, back, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '32px 32px 28px',
        borderBottom: '1px solid rgba(41,181,204,0.08)',
      }}
    >
      <ParticleBackground position="absolute" particleCount={60} spawnFromTop />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 75% 60%, rgba(41,181,204,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {back && (
          <Link
            to={back.to}
            style={{ display: 'inline-block', fontSize: '12px', color: '#555', marginBottom: '10px' }}
            className="hover:text-dark-muted transition-colors duration-150"
          >
            ← {back.label}
          </Link>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: '#e8edf5',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
                fontFamily: '"DM Sans", system-ui, sans-serif',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{subtitle}</p>
            )}
          </div>

          {actions && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginTop: '4px' }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
```

- [x] **Step 2: Run grep to find all PageHero usages**

```bash
grep -r "from.*PageHero" src/
```

Expected output — 10 therapist files, all pointing to `../components/therapist/PageHero` or `./PageHero` depending on their location:
```
src/pages/therapist/Clients.jsx
src/pages/therapist/Dashboard.jsx
src/pages/therapist/ExerciseDetail.jsx
src/pages/therapist/ExerciseLibrary.jsx
src/pages/therapist/ExerciseUpload.jsx
src/pages/therapist/Prescribe.jsx
src/pages/therapist/SessionEdit.jsx
src/pages/therapist/Settings.jsx
src/pages/therapist/TemplateEdit.jsx
src/pages/therapist/Templates.jsx
```

If any extra files appear, update those too before continuing.

- [x] **Step 3: Update all 10 therapist page imports**

In each of the 10 files listed above, change the PageHero import from:
```js
import PageHero from '../../components/therapist/PageHero'
```
to:
```js
import PageHero from '../../components/shared/PageHero'
```

Run the grep again after to confirm zero matches for `therapist/PageHero`:
```bash
grep -r "therapist/PageHero" src/
```
Expected: no output.

- [x] **Step 4: Delete the old file**

```bash
rm src/components/therapist/PageHero.jsx
```

- [x] **Step 5: Start dev server and verify therapist pages**

```bash
npm run dev
```

Open a therapist page (e.g. `/therapist/clients`). The PageHero header should still render with particles and the teal shimmer border. Open the browser console — no import errors.

- [x] **Step 6: Commit**

```bash
git add src/components/shared/PageHero.jsx src/components/therapist/ src/pages/therapist/
git commit -m "refactor: move PageHero to shared components"
```

---

## Task 2: BottomNav glass treatment

**Files:**
- Modify: `src/components/client/BottomNav.jsx`

The `<nav>` element currently uses Tailwind classes `bg-dark-surface border-t border-dark-border` for its background and border. Replace these with inline styles to get the glass blur effect. The active tab color uses `text-dark-accent` which maps to `#29B5CC` in `tailwind.config.js` — leave that as-is.

- [x] **Step 1: Update the nav element**

In `src/components/client/BottomNav.jsx`, replace:
```jsx
<nav
  aria-label="Main navigation"
  className="fixed bottom-0 inset-x-0 z-40 bg-dark-surface border-t border-dark-border"
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
```

with:
```jsx
<nav
  aria-label="Main navigation"
  className="fixed bottom-0 inset-x-0 z-40"
  style={{
    background: 'rgba(14,17,23,0.95)',
    borderTop: '1px solid rgba(41,181,204,0.08)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  }}
>
```

The active tab color uses `text-dark-accent` (a Tailwind class). `tailwind.config.js` maps `dark.accent` → `#29B5CC`, so this is correct and intentional — leave it as a Tailwind class. No change needed there.

- [x] **Step 2: Verify in browser**

Navigate to `/client` in the dev server. Scroll down a page with sessions. The bottom nav should show a subtle glass blur effect with a teal-tinted top border. The active tab stays teal (#29B5CC).

- [x] **Step 3: Commit**

```bash
git add src/components/client/BottomNav.jsx
git commit -m "feat: glass blur treatment on client BottomNav"
```

---

## Task 3: Dashboard redesign

**Files:**
- Modify: `src/pages/client/Dashboard.jsx`

Changes: add PageHero, convert session cards to glass cards with SHIMMER, add stagger animation, fix Start button and Completed badge.

- [x] **Step 1: Rewrite Dashboard.jsx**

Replace the entire file with:

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useClinicName } from '../../hooks/useClinicName'
import BottomNav from '../../components/client/BottomNav'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'

// frequencyLabel is defined locally — do not import from utils (that file may not exist)
function frequencyLabel(days) {
  if (!days) return 'As needed'
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  return `Every ${days} days`
}

function isRecentlyCompleted(session) {
  const logs = (session.session_logs ?? []).filter(l => l.completed_at)
  if (logs.length === 0) return false
  const lastMs = Math.max(...logs.map(l => new Date(l.completed_at).getTime()))
  if (!session.frequency_days) return true
  const daysSince = (Date.now() - lastMs) / (1000 * 60 * 60 * 24)
  return daysSince < session.frequency_days
}

function isActive(prescription) {
  const { start_date, duration_weeks } = prescription
  if (!start_date || !duration_weeks) return true
  const expiry = new Date(start_date)
  expiry.setDate(expiry.getDate() + duration_weeks * 7 + 7)
  return expiry >= new Date()
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const clinicName = useClinicName()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchSessions()
  }, [profile?.id])

  async function fetchSessions() {
    const { data: clientRecord, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (clientError || !clientRecord) {
      setError('Could not load your profile. Please contact your therapist.')
      setLoading(false)
      return
    }

    const { data, error: sessionsError } = await supabase
      .from('prescriptions')
      .select('id, name, frequency_days, start_date, duration_weeks, therapist_id, prescription_exercises(count), session_logs(completed_at)')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: true })

    if (sessionsError) setError('Failed to load sessions.')
    else setSessions(data ?? [])
    setLoading(false)
  }

  const activeSessions = sessions.filter(isActive)

  return (
    <div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: '80px' }}>
      <PageHero
        title="My Sessions"
        subtitle={`${profile?.name ?? ''}${clinicName ? ` · ${clinicName}` : ''}`}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ padding: '16px' }}
      >
        {loading && <p style={{ fontSize: '13px', color: '#888' }}>Loading…</p>}
        {error && <p style={{ fontSize: '13px', color: '#f87171' }}>{error}</p>}
        {!loading && !error && activeSessions.length === 0 && (
          <p style={{ fontSize: '13px', color: '#888' }}>Your therapist hasn't added any sessions yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '512px' }}>
          {activeSessions.map((s, i) => {
            const completions = s.session_logs ?? []
            const lastDone =
              completions.length > 0
                ? new Date(
                    Math.max(...completions.map(l => new Date(l.completed_at).getTime()))
                  ).toLocaleDateString()
                : null

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}
                style={{ ...CARD, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}
              >
                <div style={SHIMMER} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', margin: 0 }}>{s.name}</p>
                    {isRecentlyCompleted(s) && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(41,181,204,0.10)',
                        border: '1px solid rgba(41,181,204,0.2)',
                        borderRadius: '9999px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#29B5CC',
                      }}>
                        Completed
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: '4px', fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                    {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                  </p>
                  {lastDone && (
                    <p style={{ marginTop: '2px', fontSize: '11px', color: '#555', margin: '2px 0 0' }}>Last completed: {lastDone}</p>
                  )}
                </div>
                <Link
                  to={`/client/sessions/${s.id}`}
                  style={{
                    flexShrink: 0,
                    background: '#29B5CC',
                    color: '#000',
                    borderRadius: '7px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  Start
                </Link>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      <BottomNav />
    </div>
  )
}
```

- [x] **Step 2: Verify in browser**

Navigate to `/client`. Confirm:
- PageHero renders with "My Sessions" title, particle background, teal shimmer border
- Session cards have glass blur effect and shimmer top gradient
- Session cards stagger-animate in from below
- "Start" button has black text on teal background
- "Completed" badge has teal border

- [x] **Step 3: Commit**

```bash
git add src/pages/client/Dashboard.jsx
git commit -m "feat: client Dashboard — glass cards, PageHero, stagger animation"
```

---

## Task 4: History redesign

**Files:**
- Modify: `src/pages/client/History.jsx`

Changes: add PageHero (replaces current `<h1>` header), convert session log cards to glass cards, restyle tab bar to inline styles, add stagger animation.

- [x] **Step 1: Update imports**

In `src/pages/client/History.jsx`, add these imports below the existing ones:
```jsx
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'
```

- [x] **Step 2: Replace the header and tab bar**

Replace the current header + tab bar block:
```jsx
return (
  <div className="min-h-[100dvh] bg-dark-bg p-6 pb-20">
    <div className="mb-6 max-w-lg">
      <h1 className="text-2xl font-semibold text-dark-text">History</h1>
    </div>

    {/* Tab switcher */}
    <div className="max-w-lg flex gap-6 border-b border-dark-border mb-6">
      {[['history', 'History'], ['progress', 'Progress']].map(([tab, label]) => (
        <button
          key={tab}
          onClick={() => handleTabChange(tab)}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === tab
              ? 'border-b-2 border-dark-accent text-dark-accent'
              : 'text-dark-subtle hover:text-dark-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
```

with:
```jsx
return (
  <div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: '80px' }}>
    <PageHero title="History" subtitle="Your completed sessions" />

    {/* Tab switcher */}
    <div style={{ maxWidth: '512px', display: 'flex', gap: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '0 16px 20px', paddingTop: '4px' }}>
      {[['history', 'History'], ['progress', 'Progress']].map(([tab, label]) => (
        <button
          key={tab}
          onClick={() => handleTabChange(tab)}
          style={{
            paddingBottom: '10px',
            fontSize: '13px',
            fontWeight: 500,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            ...(activeTab === tab
              ? { borderBottom: '2px solid #29B5CC', color: '#29B5CC', marginBottom: '-1px' }
              : { color: '#555' }),
          }}
        >
          {label}
        </button>
      ))}
    </div>
```

- [x] **Step 3: Replace the history log cards**

Replace the history list render block. Find:
```jsx
<div className="space-y-3 max-w-lg">
  {logs.map(log => {
    const isOpen = expandedLogId === log.id

    return (
      <div key={log.id} className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated transition-colors"
          onClick={() => setExpandedLogId(isOpen ? null : log.id)}
        >
```

Replace with:
```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '512px', padding: '0 16px' }}>
  {logs.map((log, i) => {
    const isOpen = expandedLogId === log.id

    return (
      <motion.div
        key={log.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}
        style={{ ...CARD, padding: 0, overflow: 'hidden' }}
      >
        <div style={SHIMMER} />
        <button
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => setExpandedLogId(isOpen ? null : log.id)}
        >
```

Then close the outer `<div>` of each log item by replacing:
```jsx
      </div>
    )
  })}
</div>
```

with:
```jsx
      </motion.div>
    )
  })}
</div>
```

Also update the text styles inside the button to use inline styles instead of Tailwind:
```jsx
// Replace the two <p> and <span> elements inside the button:
<div>
  <p style={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0', margin: 0 }}>
    {log.prescriptions?.name ?? 'Session'} · {formatDate(log.completed_at)}
  </p>
  {log.session_rpe != null && (
    <p style={{ marginTop: '2px', fontSize: '11px', color: '#888', margin: '2px 0 0' }}>RPE: {log.session_rpe}/10</p>
  )}
</div>
<span style={{ marginLeft: '16px', fontSize: '11px', color: '#555', flexShrink: 0 }}>
  {isOpen ? '▲' : '▼'}
</span>
```

- [x] **Step 4: Update the expanded content borders**

Inside the expanded `{isOpen && ...}` block, make these three replacements:

**4a.** The outer expanded wrapper — replace:
```jsx
<div className="border-t border-dark-border">
```
with:
```jsx
<div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
```

**4b.** The `session_notes` paragraph (if present) — replace:
```jsx
<p className="px-4 py-2 text-xs text-dark-muted border-b border-dark-border">
  {log.session_notes}
</p>
```
with:
```jsx
<p style={{ padding: '8px 16px', fontSize: '11px', color: '#888', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
  {log.session_notes}
</p>
```

**4c.** The exercise rows container (the `divide-y` div). `divide-y` applies borders between children automatically; we replace it with a container and add `borderBottom` on each row instead — replace:
```jsx
<div className="divide-y divide-dark-border">
```
with:
```jsx
<div>
```

And for each inner exercise row, replace:
```jsx
<div className="px-3 py-2.5">
```
with:
```jsx
<div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
```

Also update the "no exercise data" fallback:
```jsx
<p className="px-4 py-2.5 text-xs text-dark-subtle">No exercise data recorded.</p>
```
with:
```jsx
<p style={{ padding: '10px 16px', fontSize: '11px', color: '#555' }}>No exercise data recorded.</p>
```

Finally, the session RPE row at the bottom of expanded content — replace:
```jsx
<p className="px-4 py-2 text-xs text-dark-muted border-t border-dark-border">
  Session RPE: {log.session_rpe}/10
</p>
```
with:
```jsx
<p style={{ padding: '8px 16px', fontSize: '11px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
  Session RPE: {log.session_rpe}/10
</p>
```

- [x] **Step 5: Verify in browser**

Navigate to `/client/history`. Confirm:
- PageHero renders with "History" title
- Tab bar shows teal underline on active tab via inline styles
- Session log cards are glass cards with shimmer top accent
- Cards stagger-animate in
- Expanding a card still shows exercise breakdown

- [x] **Step 6: Commit**

```bash
git add src/pages/client/History.jsx
git commit -m "feat: client History — glass cards, PageHero, stagger animation"
```

---

## Task 5: Settings redesign

**Files:**
- Modify: `src/pages/client/Settings.jsx`

Changes: add PageHero, wrap each section in a glass card with SECTION_LABEL, restyle all buttons to inline styles.

- [x] **Step 1: Update imports**

In `src/pages/client/Settings.jsx`, add below the existing imports:
```jsx
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [x] **Step 2: Replace the return statement**

Replace the entire `return (...)` block with:

```jsx
return (
  <div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: '80px' }}>
    <PageHero title="Settings" subtitle="Preferences & account" />

    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ padding: '16px', maxWidth: '512px', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      {fetching ? (
        <p style={{ fontSize: '13px', color: '#888' }}>Loading…</p>
      ) : fetchError ? (
        <p style={{ fontSize: '13px', color: '#f87171' }}>{fetchError}</p>
      ) : (
        <>
          {/* Preferences card */}
          <div style={{ ...CARD, position: 'relative' }}>
            <div style={SHIMMER} />
            <div style={SECTION_LABEL}>Preferences</div>

            <form onSubmit={handleSave} style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px' }}>Weight unit</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {['kg', 'lb'].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setWeightUnit(unit)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '7px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      ...(weightUnit === unit
                        ? { background: '#29B5CC', color: '#000', border: 'none' }
                        : { background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.08)' }),
                    }}
                  >
                    {unit}
                  </button>
                ))}
              </div>

              {clinicName && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Your clinic</label>
                  <p style={{ fontSize: '13px', color: '#f0f0f0', margin: 0 }}>{clinicName}</p>
                </div>
              )}

              {saveError && <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px' }}>{saveError}</p>}
              {saveSuccess && <p style={{ fontSize: '12px', color: '#4ade80', marginBottom: '8px' }}>Settings saved.</p>}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%',
                  background: '#29B5CC',
                  color: '#000',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '9px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>

          {/* Account card */}
          <div style={{ ...CARD, position: 'relative' }}>
            <div style={SHIMMER} />
            <div style={SECTION_LABEL}>Account</div>

            <div style={{ marginTop: '14px' }}>
              {passwordSuccess && (
                <p style={{ fontSize: '12px', color: '#4ade80', marginBottom: '10px' }}>Password updated successfully.</p>
              )}

              {!showPasswordForm ? (
                <button
                  type="button"
                  onClick={() => { setPasswordSuccess(false); setShowPasswordForm(true) }}
                  style={{
                    background: 'transparent',
                    color: '#29B5CC',
                    border: '1px solid rgba(41,181,204,0.3)',
                    borderRadius: '7px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '12px',
                    display: 'block',
                    width: '100%',
                  }}
                >
                  Change password
                </button>
              ) : (
                <form onSubmit={handlePasswordSave} style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    ['currentPassword', 'Current password', currentPassword, setCurrentPassword],
                    ['newPassword', 'New password', newPassword, setNewPassword],
                    ['confirmPassword', 'Confirm new password', confirmPassword, setConfirmPassword],
                  ].map(([id, label, val, setter]) => (
                    <div key={id}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>{label}</label>
                      <input
                        type="password"
                        value={val}
                        onChange={(e) => setter(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '7px',
                          padding: '9px 12px',
                          color: '#f0f0f0',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}
                  {passwordError && <p style={{ fontSize: '12px', color: '#f87171' }}>{passwordError}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      style={{
                        background: '#29B5CC',
                        color: '#000',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: passwordLoading ? 'not-allowed' : 'pointer',
                        opacity: passwordLoading ? 0.5 : 1,
                      }}
                    >
                      {passwordLoading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordForm}
                      style={{ background: 'none', border: 'none', fontSize: '13px', color: '#888', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <p style={{ fontSize: '12px', marginBottom: '16px' }}>
                <Link to="/forgot-password" style={{ color: '#29B5CC' }}>Forgot your password?</Link>
              </p>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                {logoutStep === 'idle' ? (
                  <button
                    type="button"
                    onClick={() => setLogoutStep('confirming')}
                    style={{
                      background: 'transparent',
                      color: '#f87171',
                      border: '1px solid rgba(248,113,113,0.25)',
                      borderRadius: '7px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Log out
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Log out of ManualRx?</p>
                    <button
                      type="button"
                      onClick={signOut}
                      style={{
                        background: 'transparent',
                        color: '#f87171',
                        border: '1px solid rgba(248,113,113,0.25)',
                        borderRadius: '7px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Yes, log out
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoutStep('idle')}
                      style={{ background: 'none', border: 'none', fontSize: '13px', color: '#555', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>

    <BottomNav />
  </div>
)
```

- [x] **Step 3: Verify in browser**

Navigate to `/client/settings`. Confirm:
- PageHero renders with "Settings" title
- Two glass cards: "PREFERENCES" and "ACCOUNT" with uppercase section labels
- Weight unit buttons use teal fill for active, muted outline for inactive
- "Save changes" button is teal with black text
- "Change password" is teal outline
- "Log out" is red outline
- Password form expands correctly within the Account card
- Logout confirmation still works

- [x] **Step 4: Commit**

```bash
git add src/pages/client/Settings.jsx
git commit -m "feat: client Settings — glass cards, PageHero, button styles"
```

---

## Task 6: SessionWizard redesign

**Files:**
- Modify: `src/pages/client/SessionWizard.jsx`

Changes: glass card on each wizard step (with `{ ...CARD, padding: 0 }` to avoid conflicting with existing internal padding), set counter pulse animation via `<motion.span key={currentSet}>`, completed set row slide-in animation, button style fixes, pb fix on intro/done steps.

- [x] **Step 1: Update imports**

In `src/pages/client/SessionWizard.jsx`, add below the existing imports:
```jsx
import { motion } from 'framer-motion'
import { CARD, SHIMMER } from '../../components/therapist/styles'
```

Note: `framer-motion` is already installed. `SessionWizard.jsx` has no existing Framer Motion imports — add this as a fresh import.

- [x] **Step 2: Update the Done step**

Replace the `done` step return:
```jsx
if (step === 'done') {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-dark-bg px-4">
      <div className="max-w-sm w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-900/20">
          <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-dark-text">Great work!</h2>
        <p className="mt-2 text-sm text-dark-muted">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} completed and logged.
        </p>
        <Link
          to="/client"
          className="mt-6 inline-block rounded bg-brand-primary px-6 py-2.5 text-sm text-white hover:bg-brand-primary-dark"
        >
          Back to sessions
        </Link>
      </div>
    </div>
  )
}
```

with:
```jsx
if (step === 'done') {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e1117', padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <div style={{ ...CARD, maxWidth: '384px', width: '100%', textAlign: 'center', position: 'relative' }}>
        <div style={SHIMMER} />
        <div style={{ margin: '0 auto 16px', display: 'flex', height: '48px', width: '48px', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: 'rgba(74,222,128,0.1)' }}>
          <svg style={{ height: '24px', width: '24px', color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f0f0f0', margin: '0 0 8px' }}>Great work!</h2>
        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} completed and logged.
        </p>
        <Link
          to="/client"
          style={{
            display: 'inline-block',
            background: '#29B5CC',
            color: '#000',
            borderRadius: '7px',
            padding: '9px 24px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Back to sessions
        </Link>
      </div>
    </div>
  )
}
```

- [x] **Step 3: Update the Intro step**

Replace the `intro` step return:
```jsx
if (step === 'intro') {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-dark-bg px-4">
      <div className="max-w-sm w-full bg-dark-surface rounded-xl border border-dark-border p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-dark-subtle mb-2">Session</p>
        <h1 className="text-2xl font-semibold text-dark-text">{session.name}</h1>
        <p className="mt-2 text-sm text-dark-muted">
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setStep(0)}
          className="mt-8 w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark"
        >
          Start session
        </button>
        <Link to="/client" className="mt-3 block text-sm text-dark-subtle hover:text-dark-muted">
          Back to sessions
        </Link>
      </div>
    </div>
  )
}
```

with:
```jsx
if (step === 'intro') {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0e1117', padding: '16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      <div style={{ ...CARD, maxWidth: '384px', width: '100%', textAlign: 'center', position: 'relative' }}>
        <div style={SHIMMER} />
        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: '8px' }}>Session</p>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f0f0', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{session.name}</h1>
        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 32px' }}>
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setStep(0)}
          style={{
            width: '100%',
            background: '#29B5CC',
            color: '#000',
            border: 'none',
            borderRadius: '7px',
            padding: '11px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          Start session
        </button>
        <Link to="/client" style={{ display: 'block', fontSize: '13px', color: '#555', textDecoration: 'none' }}>
          Back to sessions
        </Link>
      </div>
    </div>
  )
}
```

- [x] **Step 4: Add set counter animation to per-exercise step**

In the per-exercise step, find the set counter label:
```jsx
<p className="text-sm font-semibold text-dark-text">
  Set {currentSet + 1} of {setsData.length}
</p>
```

Replace with:
```jsx
<div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
  <motion.span
    key={currentSet}
    initial={{ scale: 1, color: '#f0f0f0' }}
    animate={{ scale: [1, 1.35, 1], color: ['#f0f0f0', '#29B5CC', '#f0f0f0'] }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    style={{ fontSize: '15px', fontWeight: 700, display: 'inline-block' }}
  >
    Set {currentSet + 1}
  </motion.span>
  <span style={{ fontSize: '13px', color: '#555' }}>of {setsData.length}</span>
</div>
```

- [x] **Step 5: Add slide-in animation to completed set rows**

Find the compact summary block (shows completed sets while still doing more sets):
```jsx
{currentSet > 0 && (
  <div className="rounded border border-dark-border bg-dark-surface px-3 py-2 space-y-1">
    {setsData.slice(0, currentSet).map((s, i) => (
      <p key={i} className="text-xs text-dark-muted">
        Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
      </p>
    ))}
  </div>
)}
```

Replace with:
```jsx
{currentSet > 0 && (
  <div style={{ background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(41,181,204,0.12)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
    {setsData.slice(0, currentSet).map((s, i) => (
      <motion.p
        key={i}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}
      >
        Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
      </motion.p>
    ))}
  </div>
)}
```

Also update the full recap block (shown when `allSetsDone`, before pain rating):
```jsx
<div className="rounded border border-dark-border bg-dark-surface px-3 py-2 space-y-1">
  {setsData.map((s, i) => (
    <p key={i} className="text-xs text-dark-muted">
      Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
    </p>
  ))}
</div>
```

Replace with:
```jsx
<div style={{ background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(41,181,204,0.12)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
  {setsData.map((s, i) => (
    <p key={i} style={{ fontSize: '11px', color: '#29B5CC', margin: 0 }}>
      Set {i + 1}: {s.reps} reps{s.weight ? ` @ ${s.weight} ${weightUnit}` : ''}
    </p>
  ))}
</div>
```

- [x] **Step 6: Update per-exercise step buttons and badge**

Update the category badge. The existing code wraps it in `{ex.exercises?.category && (...)}` — **preserve that outer conditional**. Only the inner `<span>` changes:
```jsx
<span className="mt-1 inline-block rounded-full bg-dark-elevated px-2.5 py-0.5 text-xs text-dark-muted">
  {ex.exercises.category}
</span>
```
→
```jsx
<span style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(41,181,204,0.08)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', color: '#29B5CC' }}>
  {ex.exercises.category}
</span>
```

Update the "Complete Set" button:
```jsx
className="w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-40"
```
→
```jsx
style={{ width: '100%', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
```
Add `disabled` handling:
```jsx
style={{ width: '100%', background: !currentSetData.reps ? 'rgba(41,181,204,0.4)' : '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: !currentSetData.reps ? 'not-allowed' : 'pointer' }}
```

Update the "Next / Review session" button:
```jsx
className="w-full rounded bg-brand-primary py-3 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
```
→
```jsx
style={{ width: '100%', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', padding: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: (ex.painRating >= 7 && !painAcknowledged) ? 0.4 : 1 }}
```

- [x] **Step 7: Update the Summary step**

The summary return is at the bottom of the file (no `if` guard — it's the fallback `return`). Replace the full summary return with:

```jsx
// ── Summary ───────────────────────────────────────────────────────────────
return (
  <div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: '80px' }}>
    {/* Intentional design change: replaces the per-exercise sticky header (progress dots + clinic logo)
        with a minimal back-only bar. The progress dots don't apply on the summary step. */}
    <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(14,17,23,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>
      <button
        onClick={() => setStep(exercises.length - 1)}
        style={{ background: 'none', border: 'none', fontSize: '13px', color: '#888', cursor: 'pointer' }}
      >
        ← Back
      </button>
    </div>

    <div style={{ maxWidth: '512px', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', margin: 0, letterSpacing: '-0.02em' }}>Session summary</h2>

      {/* Exercise recap — glass card */}
      <div style={{ ...CARD, padding: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={SHIMMER} />
        {exercises.map((ex, i) => (
          <div
            key={ex.id}
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              borderBottom: i < exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ex.exercises?.name ?? 'Exercise'}
              </p>
              <p style={{ marginTop: '2px', fontSize: '11px', color: '#888', margin: '2px 0 0' }}>
                {ex.setsData.length} set{ex.setsData.length !== 1 ? 's' : ''} completed
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {ex.painRating !== null && (
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Pain: {ex.painRating}/10</p>
              )}
              {ex.videoFile && (
                <p style={{ marginTop: '2px', fontSize: '11px', color: '#4ade80', margin: '2px 0 0' }}>Video attached</p>
              )}
              <button
                onClick={() => setStep(i)}
                style={{ marginTop: '2px', fontSize: '11px', color: '#29B5CC', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      <ScaleSelector
        label="How hard was the session? (0 = easy, 10 = maximum)"
        value={sessionEffort}
        onChange={setSessionEffort}
      />

      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '6px' }}>
          Session notes <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          rows={3}
          value={sessionNotes}
          onChange={e => setSessionNotes(e.target.value)}
          placeholder="How did the session feel overall?"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '7px',
            padding: '9px 12px',
            color: '#f0f0f0',
            fontSize: '13px',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      </div>

      {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}

      <button
        onClick={handleComplete}
        disabled={submitting}
        style={{
          width: '100%',
          background: '#29B5CC',
          color: '#000',
          border: 'none',
          borderRadius: '7px',
          padding: '11px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.5 : 1,
        }}
      >
        {submitting ? 'Saving…' : 'Complete session'}
      </button>
    </div>
  </div>
)
```

- [x] **Step 8: Verify full wizard flow in browser**

Navigate to a session as a client. Confirm:
1. **Intro step:** Glass card centered on screen with shimmer. Clears bottom nav (not obscured). "Start session" has black text on teal.
2. **Per-exercise step:** Set counter pulses teal + scales up on each "Complete Set" tap. Completed set rows slide in with teal text.
3. **Done state:** Glass card with shimmer. "Back to sessions" has black text on teal. Not obscured by bottom nav.
4. **Summary step:** Exercise table inside a glass card.

- [x] **Step 9: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: client SessionWizard — glass cards, set counter pulse animation"
```

---

## Final Verification

- [x] Run `npm run dev` and walk through each client page: Dashboard → History → Settings → a full session in SessionWizard
- [x] Open a therapist page (`/therapist/clients`) and confirm PageHero still renders correctly after the file move
- [x] Check mobile layout: bottom nav should not overlap content on any page
- [x] Browser console: no import errors, no React warnings about key props or animation targets
