# Mobile Responsiveness Audit — Design Spec
**Date:** 2026-05-29
**Status:** Approved

---

## Goal

Make ManualRx usable on mobile devices (375px–767px) without changing anything for desktop users (≥768px). The desktop experience is considered final and must not regress.

---

## Breakpoint

Single breakpoint: **768px**.

- `< 768px` → mobile treatment
- `≥ 768px` → desktop, unchanged

---

## Constraint

**Desktop must be pixel-perfect identical to today.** Every mobile fix is gated behind `isMobile` or a media query that has no effect above 768px. No Tailwind class changes that affect desktop. No inline style changes that remove existing desktop values.

---

## Shared Infrastructure

### `useIsMobile` hook
**File:** `src/hooks/useIsMobile.js`

```js
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

Used by `SidebarLayout`, `PageHero`, and any page that needs responsive padding.

---

## Therapist Side

### 1. `SidebarLayout` + Mobile Top Bar
**File:** `src/components/therapist/SidebarLayout.jsx`

On **desktop (≥768px):** unchanged — `AppSidebar` fixed at left, `main` with `marginLeft: '240px'`.

On **mobile (<768px):**
- `AppSidebar` is hidden
- A `MobileTopBar` renders at the top (logo left, hamburger ☰ right)
- `main` has `marginLeft: 0`
- Tapping ☰ opens a drawer overlay: `AppSidebar` rendered as a fixed panel sliding in from the left, with a dark backdrop behind it
- Tapping the backdrop or ✕ (shown in place of ☰ when open) closes the drawer
- Clicking any nav link inside the drawer also closes it (`onClose` prop passed to `AppSidebar`)

`MobileTopBar` is a small inline component inside `SidebarLayout.jsx` — no separate file needed.

### 2. `AppSidebar`
**File:** `src/components/therapist/AppSidebar.jsx`

Accepts an optional `onClose` prop. When provided, every `NavItem` `Link` click fires `onClose()` after navigation. `AccountSection` panel links also call `onClose` on action.

Desktop rendering is completely unaffected (no `onClose` passed in normal usage).

### 3. `PageHero`
**File:** `src/components/shared/PageHero.jsx`

On **mobile:**
- Padding: `20px 16px 16px` (was `32px 32px 28px`)
- Title font size: `22px` (was `26px`)
- Title+actions row: `flexDirection: 'column'`, `alignItems: 'flex-start'`, `gap: '12px'` — actions stack below the title
- Actions container: `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: '6px'`

On **desktop:** unchanged.

### 4. Per-page content padding
Every therapist page content wrapper uses `padding: '24px 32px'`. On mobile: `padding: '16px'`.

Pattern applied to:
- `Clients.jsx`
- `Templates.jsx`
- `ExerciseLibrary.jsx`
- `ExerciseUpload.jsx`
- `ExerciseDetail.jsx`
- `Prescribe.jsx`
- `SessionEdit.jsx`
- `TemplateEdit.jsx`
- `Settings.jsx`

`Onboarding.jsx` already uses `padding: '24px 16px'` on its outer wrapper — reduce inner card padding on mobile if needed.

### 5. Prescribe — tab bar
**File:** `src/pages/therapist/Prescribe.jsx`

Tab bar row gets `overflowX: 'auto'` and `WebkitOverflowScrolling: 'touch'` on mobile so the three tab labels scroll horizontally rather than wrapping or overflowing on narrow screens.

### 6. Therapist Dashboard
**File:** `src/pages/therapist/Dashboard.jsx`

The page has a `gridTemplateColumns: '1fr 1fr'` grid at line 576 (AdherenceCard + NeedsAttentionCard side by side). On mobile: switch to `gridTemplateColumns: '1fr'` so they stack vertically. ActivityFeedCard is already full-width below the grid — unchanged. Padding reduction same as other pages.

Also reduce the full-page `ParticleBackground` particleCount on mobile (see section below).

### 7. ParticleBackground on mobile

`PageHero` passes `particleCount={60}` — on mobile reduce to `particleCount={20}`. The therapist Dashboard uses a full-page `<ParticleBackground />` — on mobile reduce its particleCount similarly (20). Desktop values unchanged. `prefers-reduced-motion` behaviour is unaffected (already handled inside the component).

### 8. Z-index stack for mobile drawer

Assign explicit values to avoid conflicts with existing modals:
- Drawer backdrop: `zIndex: 48`
- Drawer panel: `zIndex: 49`
- Existing modals (Add Client, ApplyTemplate, etc.) already use Tailwind `z-50` → they remain above the drawer

`ExercisePicker` modal: on mobile: `width: '95vw'`, `maxHeight: '85vh'`, `overflowY: 'auto'`, confirm it renders at `z-50` or above. Desktop unchanged.

### 9. `ExercisePicker` modal
**File:** `src/components/therapist/ExercisePicker.jsx`

On mobile: `width: '95vw'`, `maxHeight: '85vh'`, `overflowY: 'auto'`. Desktop unchanged.

---

## Client Side

The client side has a `BottomNav` already suited for mobile. The following pages need targeted fixes:

### 10. BottomNav safe-area clearance
**Files:** `src/pages/client/Dashboard.jsx`, `src/pages/client/History.jsx`, `src/pages/client/Settings.jsx`, `src/pages/client/SessionWizard.jsx`

Three client pages use `paddingBottom: '80px'` as a hardcoded clearance for the BottomNav. On iPhones with a home indicator (iPhone X and later), the BottomNav itself is 56px tall + 34px safe-area inset = ~90px total. Content gets clipped on real devices, invisible in DevTools emulation.

Fix: replace `paddingBottom: '80px'` with `paddingBottom: 'calc(80px + env(safe-area-inset-bottom))'` in all three files. `SessionWizard.jsx` already applies this correctly on intro/done screens — the remaining instance at line 573 also needs it.

### 11. `SessionWizard`
**File:** `src/pages/client/SessionWizard.jsx`

- Sticky header: verify it doesn't clip or overlap content on 375px. Reduce horizontal padding on mobile.
- Scale selector buttons: add `flexWrap: 'wrap'` on mobile if the row overflows.
- Intro/done/summary glass cards: verify full-width padding is comfortable on mobile.
- **iOS Safari note:** the sticky header uses `position: sticky` + `backdropFilter: blur(8px)`. This combination has known rendering artifacts on iOS Safari — must be tested on a real iOS device, not just DevTools emulation.

### 12. Client `Dashboard`
**File:** `src/pages/client/Dashboard.jsx`

- Safe-area padding fix (see §10).
- Content padding: reduce on mobile.
- Session cards: verify no horizontal overflow. Check hero section padding.

### 13. Client `History`
**File:** `src/pages/client/History.jsx`

- Safe-area padding fix (see §10).
- Log cards: verify readable on 375px. Reduce padding on mobile.

### 14. Client `Settings`
**File:** `src/pages/client/Settings.jsx`

- Safe-area padding fix (see §10).
- Glass cards (Preferences + Account): verify full-width, no horizontal scroll.

### 15. `ProgressTab` + charts
**Files:** `src/pages/client/ProgressTab.jsx`, `src/components/progress/PainChart.jsx`, `src/components/progress/VolumeChart.jsx`

Charts must use `<ResponsiveContainer width="100%" height={200}>` (or equivalent). If already using it, verify the parent container has no fixed pixel width that constrains it on mobile.

---

## Shared / Auth Pages

### 16. `HomePage`
**File:** `src/pages/HomePage.jsx`

- Hero section: reduce font sizes and padding on mobile.
- Feature sections: check for horizontal overflow or fixed-width containers.

### 17. Auth pages — quick scan
**Files:** `Login.jsx`, `Signup.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Join.jsx`

These use centered card layouts and are likely already responsive. Visually verify at 375px — fix any padding or overflow issues found.

### 18. Legal pages — quick scan
**Files:** `src/pages/Privacy.jsx`, `src/pages/therapist/Terms.jsx`, `src/pages/Contact.jsx`

Text pages — check for horizontal overflow and comfortable mobile padding.

---

## What Does NOT Change

- All desktop styles (≥768px) — zero regressions
- `AppSidebar` visual design — same on desktop, same in the mobile drawer
- `BottomNav` on the client side — already correct
- All Supabase data logic, auth flow, PDF generation, edge functions — untouched

---

## Verification

For each page:
1. Open Chrome DevTools — test at **375px (iPhone SE)** and **390px (iPhone 14)**
2. Confirm no horizontal scroll, no clipped content, no overlapping elements
3. Confirm desktop view (1280px) is visually identical to before

Key flows to test end-to-end on mobile:
- Therapist: open drawer → navigate to Clients → add client modal → navigate to Prescribe
- Therapist: open SessionEdit, use ExercisePicker modal
- Client: complete a session wizard on mobile
- Client: view session history

**Real device required:** Test `SessionWizard` sticky header on a physical iOS device — `position: sticky` + `backdropFilter: blur()` has known Safari rendering artifacts that DevTools emulation does not reproduce. Also verify BottomNav safe-area clearance on an iPhone with home indicator (iPhone X or later).
