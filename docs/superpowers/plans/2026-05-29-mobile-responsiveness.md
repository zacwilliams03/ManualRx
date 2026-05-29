# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every ManualRx page usable at 375px and 390px without changing anything for desktop users (≥768px).

**Architecture:** A single `useIsMobile()` hook (threshold 768px) gates every mobile change. The therapist sidebar becomes a hamburger drawer on mobile via a rewritten `SidebarLayout`. All other fixes are targeted style changes using the hook. Desktop code paths are structurally unchanged — the hook simply makes the mobile branch unreachable at ≥768px.

**Tech Stack:** React, Tailwind CSS, Framer Motion, inline styles (existing pattern)

**Spec:** `docs/superpowers/specs/2026-05-29-mobile-responsiveness.md`

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Create | `src/hooks/useIsMobile.js` | New hook |
| Modify | `src/components/therapist/SidebarLayout.jsx` | Mobile drawer + top bar |
| Modify | `src/components/therapist/AppSidebar.jsx` | `onClose` prop to close drawer on nav |
| Modify | `src/components/shared/PageHero.jsx` | Mobile padding, font size, stacked actions |
| Modify | `src/pages/therapist/Dashboard.jsx` | Grid collapse, particle count, padding |
| Modify | `src/pages/therapist/Clients.jsx` | Content padding |
| Modify | `src/pages/therapist/Templates.jsx` | Content padding |
| Modify | `src/pages/therapist/ExerciseLibrary.jsx` | Content padding |
| Modify | `src/pages/therapist/ExerciseUpload.jsx` | Content padding |
| Modify | `src/pages/therapist/ExerciseDetail.jsx` | Content padding |
| Modify | `src/pages/therapist/Prescribe.jsx` | Content padding + tab bar scroll |
| Modify | `src/pages/therapist/SessionEdit.jsx` | Content padding |
| Modify | `src/pages/therapist/TemplateEdit.jsx` | Content padding |
| Modify | `src/pages/therapist/Settings.jsx` | Content padding |
| Modify | `src/components/therapist/ExercisePicker.jsx` | maxHeight + scroll on mobile |
| Modify | `src/pages/client/Dashboard.jsx` | Safe-area paddingBottom |
| Modify | `src/pages/client/History.jsx` | Safe-area paddingBottom |
| Modify | `src/pages/client/Settings.jsx` | Safe-area paddingBottom |
| Modify | `src/pages/client/SessionWizard.jsx` | Safe-area fix + sticky header padding |
| Modify | `src/components/progress/PainChart.jsx` | Verify ResponsiveContainer (already set) |
| Modify | `src/components/progress/VolumeChart.jsx` | Verify ResponsiveContainer |
| Modify | `src/pages/client/ProgressTab.jsx` | Verify no fixed-width parent |
| Modify | `src/pages/HomePage.jsx` | Mobile padding + font sizes |
| Scan | `src/pages/auth/Login.jsx` | Fix any overflow found |
| Scan | `src/pages/auth/Signup.jsx` | Fix any overflow found |
| Scan | `src/pages/auth/ForgotPassword.jsx` | Fix any overflow found |
| Scan | `src/pages/auth/ResetPassword.jsx` | Fix any overflow found |
| Scan | `src/pages/Join.jsx` | Fix any overflow found |
| Scan | `src/pages/Privacy.jsx` | Fix any overflow found |
| Scan | `src/pages/therapist/Terms.jsx` | Fix any overflow found |
| Scan | `src/pages/Contact.jsx` | Fix any overflow found |

---

## Task 1: `useIsMobile` hook

**Files:**
- Create: `src/hooks/useIsMobile.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useIsMobile.js
import { useState, useEffect } from 'react'

export default function useIsMobile(threshold = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < threshold
  )

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < threshold)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [threshold])

  return isMobile
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useIsMobile.js
git commit -m "feat: add useIsMobile hook (threshold 768px)"
```

---

## Task 2: `AppSidebar` — accept `onClose` prop

Thread `onClose` through `NavItem` so clicking any nav link in the mobile drawer closes it. Desktop passes nothing so behaviour is unchanged.

**Files:**
- Modify: `src/components/therapist/AppSidebar.jsx`

- [ ] **Step 1: Read the file**

Read `src/components/therapist/AppSidebar.jsx` in full. Identify:
- The `NavItem` function signature (line ~51)
- The `Link` element inside `NavItem`
- Where each `NavItem` is rendered inside `AppSidebar` (lines ~365–396)

- [ ] **Step 2: Add `onClose` to `NavItem`**

Find the `NavItem` function signature:

```jsx
function NavItem({ to, icon: Icon, label, activePrefixes, exact }) {
```

Replace with:

```jsx
function NavItem({ to, icon: Icon, label, activePrefixes, exact, onClose }) {
```

Then find the `<Link` element inside `NavItem` and add the `onClick` prop:

```jsx
<Link
  to={to}
  onClick={onClose}
  className={[...].join(' ')}
  style={{...}}
  onMouseEnter={...}
  onMouseLeave={...}
>
```

(`onClose` is `undefined` on desktop — React ignores undefined onClick handlers.)

- [ ] **Step 3: Add `onClose` to `AppSidebar` and pass it to every `NavItem`**

Find:
```jsx
export default function AppSidebar() {
```

Replace with:
```jsx
export default function AppSidebar({ onClose }) {
```

Then find every `<NavItem` inside the return block and add `onClose={onClose}`:

```jsx
<NavItem
  to="/therapist"
  icon={LayoutDashboard}
  label="Dashboard"
  exact
  onClose={onClose}
/>
<NavItem
  to="/therapist/clients"
  icon={Users}
  label="Clients"
  activePrefixes={['/therapist/clients', '/therapist/prescribe']}
  onClose={onClose}
/>
<NavItem
  to="/therapist/templates"
  icon={FileText}
  label="Templates"
  onClose={onClose}
/>
<NavItem
  to="/therapist/exercises"
  icon={Dumbbell}
  label="Exercise Library"
  onClose={onClose}
/>
```

And the Settings NavItem in the bottom zone:

```jsx
<NavItem
  to="/settings"
  icon={Settings}
  label="Settings"
  onClose={onClose}
/>
```

- [ ] **Step 4: Start dev server and verify desktop is unchanged**

```bash
npm run dev
```

Open `http://localhost:5173/therapist` at desktop width. Sidebar should render identically — no visual change expected.

- [ ] **Step 5: Commit**

```bash
git add src/components/therapist/AppSidebar.jsx
git commit -m "feat: add onClose prop to AppSidebar for mobile drawer"
```

---

## Task 3: `SidebarLayout` — mobile drawer

Replace the two-line `SidebarLayout` with a version that renders a hamburger top bar + drawer overlay on mobile and the existing sidebar on desktop.

**Files:**
- Modify: `src/components/therapist/SidebarLayout.jsx`

- [ ] **Step 1: Replace `SidebarLayout.jsx` entirely**

The current file is 12 lines. Replace it completely:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import useIsMobile from '../../hooks/useIsMobile'

function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', lineHeight: 1 }}>
        <span style={{ color: '#e8edf5' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}

function MobileTopBar({ drawerOpen, onToggle }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 47,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: '#0e1117',
      borderBottom: '1px solid rgba(41,181,204,0.10)',
    }}>
      <Link to="/therapist" style={{ textDecoration: 'none' }}>
        <Logo />
      </Link>
      <button
        onClick={onToggle}
        aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#aaaaaa', fontSize: '20px', lineHeight: 1 }}
      >
        {drawerOpen ? '✕' : '☰'}
      </button>
    </div>
  )
}

export default function SidebarLayout({ children }) {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── Desktop — unchanged ────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex min-h-screen bg-dark-bg">
        <AppSidebar />
        <main className="flex-1 min-h-screen" style={{ marginLeft: '240px' }}>
          {children}
        </main>
      </div>
    )
  }

  // ── Mobile ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0e1117' }}>
      <MobileTopBar drawerOpen={drawerOpen} onToggle={() => setDrawerOpen(v => !v)} />

      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 48 }}
          />
          {/* Drawer panel */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '240px',
            zIndex: 49,
            overflowY: 'auto',
          }}>
            <AppSidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Verify mobile drawer in browser**

In DevTools set device to iPhone SE (375×667). Open `http://localhost:5173/therapist`:
- Top bar shows ManualRx logo and ☰ hamburger
- Tapping ☰ opens the drawer with the full nav
- Tapping a nav link closes the drawer and navigates
- Tapping the dark backdrop closes the drawer
- ✕ icon replaces ☰ when drawer is open

Switch to desktop width (1280px) — sidebar renders identically to before, no top bar visible.

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/SidebarLayout.jsx
git commit -m "feat: mobile hamburger drawer for therapist sidebar"
```

---

## Task 4: `PageHero` — mobile responsive

**Files:**
- Modify: `src/components/shared/PageHero.jsx`

- [ ] **Step 1: Replace `PageHero.jsx` entirely**

Current file is 68 lines. Replace completely:

```jsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ParticleBackground from '../ParticleBackground'
import useIsMobile from '../../hooks/useIsMobile'

export default function PageHero({ title, subtitle, back, actions }) {
  const isMobile = useIsMobile()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: isMobile ? '20px 16px 16px' : '32px 32px 28px',
        borderBottom: '1px solid rgba(41,181,204,0.08)',
      }}
    >
      <ParticleBackground position="absolute" particleCount={isMobile ? 20 : 60} spawnFromTop />

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

        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: isMobile ? '12px' : '16px',
        }}>
          <div>
            <h1
              style={{
                fontSize: isMobile ? '22px' : '26px',
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
            <div style={{
              display: 'flex',
              gap: isMobile ? '6px' : '8px',
              alignItems: 'center',
              flexShrink: 0,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              marginTop: isMobile ? 0 : '4px',
            }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify on mobile and desktop**

At 375px: hero shows title (22px), subtitle, and actions stacked below title in a wrapping row.
At 1280px: hero is pixel-identical to before — title 26px, actions right-aligned on the same row.

Check Prescribe page (has 3 action buttons — Export PDF, Apply Template, New Session) at 375px: all three should be in a `flex-wrap` row below the client name.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/PageHero.jsx
git commit -m "feat: PageHero mobile — reduced padding, stacked actions, fewer particles"
```

---

## Task 5: Therapist Dashboard — grid collapse + particle count + padding

**Files:**
- Modify: `src/pages/therapist/Dashboard.jsx`

- [ ] **Step 1: Read Dashboard.jsx**

Read the file. Confirm:
- Line 562: `padding: '40px 40px 60px'` — the main content wrapper
- Line 561: `<ParticleBackground spawnFromTop />` — no explicit particleCount (defaults to 140)
- Line 576: `gridTemplateColumns: '1fr 1fr'` — the two-column card grid

- [ ] **Step 2: Add `useIsMobile` import**

At the top of the file, after the existing imports, add:

```js
import useIsMobile from '../../hooks/useIsMobile'
```

- [ ] **Step 3: Call the hook inside the component**

Inside the `Dashboard` component function body, before the `return`, add:

```js
const isMobile = useIsMobile()
```

- [ ] **Step 4: Reduce particle count on mobile**

Find line 561:
```jsx
<ParticleBackground spawnFromTop />
```

Replace with:
```jsx
<ParticleBackground spawnFromTop particleCount={isMobile ? 30 : 140} />
```

- [ ] **Step 5: Reduce content padding on mobile**

Find line 562:
```jsx
<div style={{ position: 'relative', zIndex: 1, padding: '40px 40px 60px', minHeight: '100vh' }}>
```

Replace with:
```jsx
<div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '20px 16px 40px' : '40px 40px 60px', minHeight: '100vh' }}>
```

- [ ] **Step 6: Collapse the two-column grid on mobile**

Find line 576:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
```

Replace with:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
```

- [ ] **Step 7: Verify**

At 375px: AdherenceCard and NeedsAttentionCard stack vertically, ActivityFeedCard below. Padding is `20px 16px 40px`.
At 1280px: two-column grid unchanged, `40px 40px 60px` padding.

- [ ] **Step 8: Commit**

```bash
git add src/pages/therapist/Dashboard.jsx
git commit -m "feat: therapist dashboard mobile — grid collapse, reduced particles and padding"
```

---

## Task 6: Per-page content padding — 9 therapist pages

All nine pages use the same pattern: a content `<div>` with `padding: '24px 32px'`. On mobile this becomes `padding: '16px'`. The `maxWidth` values are fine as-is.

**Files:**
- Modify: `src/pages/therapist/Clients.jsx`
- Modify: `src/pages/therapist/Templates.jsx`
- Modify: `src/pages/therapist/ExerciseLibrary.jsx`
- Modify: `src/pages/therapist/ExerciseUpload.jsx`
- Modify: `src/pages/therapist/ExerciseDetail.jsx`
- Modify: `src/pages/therapist/Prescribe.jsx`
- Modify: `src/pages/therapist/SessionEdit.jsx`
- Modify: `src/pages/therapist/TemplateEdit.jsx`
- Modify: `src/pages/therapist/Settings.jsx`

- [ ] **Step 1: Read each file**

For each file, search for the content wrapper — it will look like:

```jsx
<div style={{ padding: '24px 32px', maxWidth: '...' }}>
```

Note the exact `maxWidth` value per page (they differ: 860px, 680px, 600px, 520px).

- [ ] **Step 2: Add `useIsMobile` import + call to each file**

In each file, add at the top with other imports:
```js
import useIsMobile from '../../hooks/useIsMobile'
```

And at the top of the component function body (before the return):
```js
const isMobile = useIsMobile()
```

- [ ] **Step 3: Update the content wrapper padding in each file**

Replace the padding value in the content wrapper. Examples:

**Clients.jsx** (`maxWidth: '860px'`):
```jsx
// Before:
<div style={{ padding: '24px 32px', maxWidth: '860px' }}>
// After:
<div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '860px' }}>
```

**ExerciseUpload.jsx** (`maxWidth: '600px'`):
```jsx
// Before:
<div style={{ padding: '24px 32px', maxWidth: '600px' }}>
// After:
<div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '600px' }}>
```

Apply the same pattern to all nine files with their respective `maxWidth` values. Read each file to find the exact existing padding value — some pages may use a slightly different value (e.g. `Prescribe.jsx` uses `padding: '24px 32px'` inside the tab content `<div>` wrapper).

- [ ] **Step 4: Verify**

At 375px: content in each page has 16px of breathing room on all sides. No horizontal scroll.
At 1280px: `24px 32px` padding unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/Clients.jsx src/pages/therapist/Templates.jsx src/pages/therapist/ExerciseLibrary.jsx src/pages/therapist/ExerciseUpload.jsx src/pages/therapist/ExerciseDetail.jsx src/pages/therapist/Prescribe.jsx src/pages/therapist/SessionEdit.jsx src/pages/therapist/TemplateEdit.jsx src/pages/therapist/Settings.jsx
git commit -m "feat: reduce therapist page content padding on mobile"
```

---

## Task 7: Prescribe tab bar scroll + ExercisePicker mobile height

**Files:**
- Modify: `src/pages/therapist/Prescribe.jsx`
- Modify: `src/components/therapist/ExercisePicker.jsx`

- [ ] **Step 1: Read Prescribe.jsx — find the tab bar**

The tab bar is a `<div>` containing three tab `<button>` elements, positioned flush below the hero. It looks like:

```jsx
<div style={{ display: 'flex', padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
```

- [ ] **Step 2: Add horizontal scroll to tab bar on mobile**

`useIsMobile` is already imported in this file from Task 6. Update the tab bar wrapper:

```jsx
// Before:
<div style={{ display: 'flex', padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

// After:
<div style={{
  display: 'flex',
  padding: isMobile ? '0 0' : '0 32px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  overflowX: isMobile ? 'auto' : 'visible',
  WebkitOverflowScrolling: 'touch',
}}>
```

- [ ] **Step 3: Read ExercisePicker.jsx — find the root container**

The component returns a single `<div>` at line 109:

```jsx
return (
  <div style={{
    background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(100,160,255,0.08)', borderRadius: '14px',
    overflow: 'hidden', position: 'relative',
  }}>
```

- [ ] **Step 4: Add `useIsMobile` to ExercisePicker and cap height on mobile**

Add import at top:
```js
import useIsMobile from '../../hooks/useIsMobile'
```

Call inside the component (before the return):
```js
const isMobile = useIsMobile()
```

Update the root container:
```jsx
<div style={{
  background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(100,160,255,0.08)', borderRadius: '14px',
  overflow: 'hidden', position: 'relative',
  maxHeight: isMobile ? '85vh' : 'none',
  overflowY: isMobile ? 'auto' : 'visible',
}}>
```

- [ ] **Step 5: Verify**

At 375px on Prescribe: tab bar scrolls horizontally if three tabs don't fit. On SessionEdit or TemplateEdit: ExercisePicker is scrollable and doesn't push content off screen.
At 1280px: tab bar unchanged, ExercisePicker unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx src/components/therapist/ExercisePicker.jsx
git commit -m "feat: prescribe tab bar scroll on mobile, ExercisePicker max-height"
```

---

## Task 8: Client pages — safe-area `paddingBottom` fix

Three client pages use `paddingBottom: '80px'` as clearance for the 56px BottomNav. On iPhones with a home indicator (iPhone X+), the BottomNav gains an additional 34px safe-area inset, so content clips under the nav on real devices. `SessionWizard` already applies the correct `calc()` on its intro/done screens but misses it on the summary screen.

**Files:**
- Modify: `src/pages/client/Dashboard.jsx` (line 77)
- Modify: `src/pages/client/History.jsx` (line 94)
- Modify: `src/pages/client/Settings.jsx` (line 139)
- Modify: `src/pages/client/SessionWizard.jsx` (line 573)

- [ ] **Step 1: Fix `client/Dashboard.jsx`**

Find:
```jsx
<div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: '80px' }}>
```

Replace:
```jsx
<div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
```

- [ ] **Step 2: Fix `client/History.jsx`**

Find:
```jsx
<div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: '80px' }}>
```

Replace:
```jsx
<div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
```

- [ ] **Step 3: Fix `client/Settings.jsx`**

Find:
```jsx
<div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: '80px' }}>
```

Replace:
```jsx
<div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
```

- [ ] **Step 4: Fix `client/SessionWizard.jsx` summary screen**

Find line 573 (the summary `return` screen root div):
```jsx
<div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: '80px' }}>
```

Replace:
```jsx
<div style={{ minHeight: '100dvh', background: '#0e1117', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
```

- [ ] **Step 5: Verify in DevTools**

In Chrome DevTools, go to Settings → Experiments → enable "Emulate CSS env() variables". Set iPhone 14 viewport. The content on each client page should clear the BottomNav with visible bottom padding.

- [ ] **Step 6: Commit**

```bash
git add src/pages/client/Dashboard.jsx src/pages/client/History.jsx src/pages/client/Settings.jsx src/pages/client/SessionWizard.jsx
git commit -m "fix: client pages safe-area paddingBottom for BottomNav clearance on iPhone"
```

---

## Task 9: `SessionWizard` — sticky header padding + scale selector

**Files:**
- Modify: `src/pages/client/SessionWizard.jsx`

- [ ] **Step 1: Read the sticky per-exercise header**

Read `src/pages/client/SessionWizard.jsx` lines 310–370. The sticky header renders progress dots on the left and the clinic logo/name on the right. Find the sticky wrapper — it looks like:

```jsx
<div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(14,17,23,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '...' }}>
```

Note the exact padding value.

- [ ] **Step 2: Reduce sticky header padding on mobile**

Add `useIsMobile` import and call if not already present in the component. Then update the sticky header wrapper padding:

```jsx
// If current padding is e.g. '10px 20px':
padding: isMobile ? '10px 14px' : '10px 20px',
```

Adjust the specific values to match whatever you find in the file — the goal is to reduce horizontal padding on mobile so the dots and logo have more room.

- [ ] **Step 3: Find the scale selector buttons**

Search for the pain/RPE scale selector — a row of numbered buttons (0–10). It likely looks like:

```jsx
<div style={{ display: 'flex', gap: '...', ... }}>
  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
    <button key={n} ...>{n}</button>
  ))}
</div>
```

- [ ] **Step 4: Add `flexWrap: 'wrap'` to scale selector on mobile**

```jsx
// Before:
<div style={{ display: 'flex', gap: '6px' }}>

// After:
<div style={{ display: 'flex', gap: '6px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
```

Match the exact existing style object — only add `flexWrap`.

- [ ] **Step 5: Verify**

At 375px: progress dots in sticky header are not clipped. Scale selector wraps to two rows if needed. Summary screen clears the bottom nav (from Task 8).

At 1280px: no changes visible.

- [ ] **Step 6: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "fix: SessionWizard sticky header padding and scale selector wrap on mobile"
```

---

## Task 10: `ProgressTab` charts — verify `ResponsiveContainer`

**Files:**
- Read: `src/components/progress/PainChart.jsx`
- Read: `src/components/progress/VolumeChart.jsx`
- Read: `src/pages/client/ProgressTab.jsx`

- [ ] **Step 1: Verify `PainChart.jsx`**

Read the file. Confirm it already uses:
```jsx
<ResponsiveContainer width="100%" height={180}>
```

No change needed if present.

- [ ] **Step 2: Verify `VolumeChart.jsx`**

Read the file. If it does NOT use `ResponsiveContainer`, wrap the chart:

```jsx
import { ..., ResponsiveContainer } from 'recharts'

// Wrap existing chart:
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data} ...>
    ...
  </BarChart>
</ResponsiveContainer>
```

If it already uses `ResponsiveContainer`, no change needed.

- [ ] **Step 3: Verify `ProgressTab.jsx` parent containers**

Read `src/pages/client/ProgressTab.jsx`. Check that no parent wrapper of the charts has a fixed pixel width (e.g. `width: '600px'`). If found, replace with `width: '100%'` or `maxWidth: '600px'`.

- [ ] **Step 4: Commit if any changes were made**

```bash
git add src/components/progress/VolumeChart.jsx src/pages/client/ProgressTab.jsx
git commit -m "fix: ensure charts use ResponsiveContainer for mobile"
```

If no changes were needed, skip the commit.

---

## Task 11: `HomePage` mobile fixes

**Files:**
- Modify: `src/pages/HomePage.jsx`

- [ ] **Step 1: Read `HomePage.jsx` in full**

Read the file. Identify:
- The hero section: likely a `<section>` or `<div>` with a large heading and CTA button
- Any feature/content sections with fixed widths or `padding: '0 X px'` values
- Any `fontSize` values that will be too large on 375px (e.g. anything over 40px)

- [ ] **Step 2: Add `useIsMobile` import and call**

```js
import useIsMobile from '../hooks/useIsMobile'
// ...inside component:
const isMobile = useIsMobile()
```

- [ ] **Step 3: Reduce hero padding and font sizes on mobile**

For the hero heading, if it's something like `fontSize: '56px'`, reduce on mobile:
```jsx
fontSize: isMobile ? '36px' : '56px',
```

For the hero section padding (e.g. `padding: '80px 40px'`):
```jsx
padding: isMobile ? '48px 20px' : '80px 40px',
```

For feature sections with fixed `maxWidth` containers — keep `maxWidth`, just reduce horizontal padding:
```jsx
padding: isMobile ? '40px 20px' : '60px 40px',
```

Apply these adjustments to every section that has large padding or font values. The exact values depend on what you find in the file.

- [ ] **Step 4: Verify**

At 375px: no horizontal scroll, text is readable (heading ≤36px), CTA button fits within viewport.
At 1280px: unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.jsx
git commit -m "feat: HomePage mobile padding and font size reductions"
```

---

## Task 12: Auth + legal pages — quick scan and fix

**Files:**
- `src/pages/auth/Login.jsx`
- `src/pages/auth/Signup.jsx`
- `src/pages/auth/ForgotPassword.jsx`
- `src/pages/auth/ResetPassword.jsx`
- `src/pages/Join.jsx`
- `src/pages/Privacy.jsx`
- `src/pages/therapist/Terms.jsx`
- `src/pages/Contact.jsx`

- [ ] **Step 1: Read each file and check for these patterns**

For each file look for:
1. A root `<div>` or `<main>` with `padding: 'X px'` that might be too large on mobile (e.g. `padding: '60px 40px'`)
2. Any fixed-width containers without `maxWidth` (e.g. `width: '600px'` without `maxWidth`)
3. Large `fontSize` values in headings (anything over 32px)
4. Any `overflow: hidden` that could clip content

Auth pages typically use a centered card pattern (`max-w-md mx-auto`) — these are usually already responsive. Legal/contact pages may have large padding.

- [ ] **Step 2: Fix any issues found**

For each issue found, apply the same pattern:
```jsx
// Padding too large on mobile:
padding: isMobile ? '20px 16px' : '60px 40px',

// Font too large:
fontSize: isMobile ? '24px' : '36px',
```

Add `useIsMobile` import and call only in files that need a fix. If a file has no issues, leave it untouched.

The auth pages import path for the hook would be `'../../hooks/useIsMobile'`. Legal pages in `src/pages/` use `'../hooks/useIsMobile'`. `Join.jsx` is in `src/pages/` so also `'../hooks/useIsMobile'`. `Terms.jsx` is in `src/pages/therapist/` so `'../../hooks/useIsMobile'`.

- [ ] **Step 3: Commit all fixes together**

```bash
git add src/pages/auth/ src/pages/Join.jsx src/pages/Privacy.jsx src/pages/therapist/Terms.jsx src/pages/Contact.jsx
git commit -m "fix: auth and legal pages mobile padding and overflow fixes"
```

If no changes were needed in any file, skip the commit.

---

## Task 13: Final verification pass

No code changes — this task is verification only.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Therapist flow at 375px (iPhone SE)**

Set DevTools to iPhone SE (375×667). Visit each route in order:

| Route | Check |
|-------|-------|
| `/therapist` | Top bar visible, drawer opens/closes, 1-col card grid, particles reduced |
| `/therapist/clients` | Drawer nav works, hero actions stacked below title, content padded at 16px |
| `/therapist/prescribe/:id` | Hero actions stacked, tabs scroll horizontally |
| `/therapist/prescribe/:id/sessions/:sid` | Hero with back breadcrumb, content padded |
| `/therapist/templates` | Hero, content padded |
| `/therapist/templates/:id` | ExercisePicker scrollable |
| `/therapist/exercises` | Hero, content padded |
| `/therapist/exercises/new` | Form in glass card, content padded |
| `/therapist/exercises/:id` | Hero with exercise name |
| `/settings` | Content padded, form sections visible |
| `/onboarding` | Centered glass card, padding comfortable on mobile |

- [ ] **Step 3: Client flow at 375px**

| Route | Check |
|-------|-------|
| `/client` | BottomNav visible, content clears it with safe-area padding |
| `/client/history` | BottomNav visible, content clears it |
| `/client/settings` | BottomNav visible, content clears it |
| `/client/:id/session` (SessionWizard) | Sticky header fits, scale buttons wrap, summary clears BottomNav |

- [ ] **Step 4: Auth + shared pages at 375px**

| Route | Check |
|-------|-------|
| `/` (HomePage) | No horizontal scroll, heading fits, CTA visible |
| `/login` | Centered card, no overflow |
| `/signup` | Centered card, no overflow |
| `/join/:code` | Centered card, no overflow |
| `/privacy` | Text readable, no horizontal scroll |
| `/terms` | Text readable, no horizontal scroll |
| `/contact` | No horizontal scroll |

- [ ] **Step 5: Repeat at 390px (iPhone 14)**

Switch DevTools device to iPhone 14 (390×844). Walk through the same routes. Focus on:
- BottomNav safe-area clearance (home indicator is visible at this size)
- Hero actions at 390px — should still stack cleanly

- [ ] **Step 6: Verify desktop at 1280px**

Switch to a 1280px viewport and spot-check:
- `/therapist` — full sidebar visible, no top bar, original particle count
- `/therapist/clients` — PageHero with title+actions on one row, `24px 32px` padding
- `/therapist/prescribe/:id` — tab bar with `0 32px` padding, no horizontal scroll
- `/client` — BottomNav visible
- `/` — full homepage layout

If anything looks different from before this branch, fix it and commit before marking complete.

- [ ] **Step 7: Commit if any last-minute fixes were needed**

```bash
git add -p
git commit -m "fix: final verification pass tweaks"
```
