# UI Polish — Therapist & Client App

**Date:** 2026-06-10  
**Scope:** Therapist app + client mobile app. Marketing homepage deferred (separate spec).  
**Approach:** Information-Hierarchy Lift — visual polish as the primary goal, with targeted structural improvements where data surfacing clearly benefits from it.  
**Not in scope:** Exercise library thumbnails, landing page, any new features or backend changes.

---

## 1. Global Token Changes

These changes flow through every screen in both apps via the existing CSS custom-property system and shared component styles.

| Property | Current | Proposed |
|---|---|---|
| Card border-radius | `8px` | `12px` (cards), `14px` (prominent/hero cards) |
| Card padding | Mixed (12–16px) | `22px 24px` for therapist app cards; `18px 18px 16px` for client mobile session cards (slightly tighter on small screens) |
| Card backdrop-filter | Absent on most cards | `blur(12px)` + `-webkit-backdrop-filter: blur(12px)` |
| Card hover border | None | `rgba(41,181,204,0.18)` with `transition: border-color 0.2s` |
| Section label size | `9–10px` | `11px`, `font-weight: 700`, `letter-spacing: 0.09em` |
| Muted text (`--color-muted`) dark mode only | `#888888` | `#999999` (slightly more legible, still clearly secondary — light mode value `#475569` unchanged) |
| Category/status pills | Square `border-radius: 4–5px` | Pill `border-radius: 999px` |
| Interactive row hover | Instant | `transition: background 0.15s ease` |
| Alert row border-radius | `8px` | `10px` |
| Badge border-radius (RPE, Pain) | `4px` | `5px` |

The `CARD` style constant in `src/components/therapist/styles.js` should be updated to reflect the new defaults so all consumers pick them up automatically.

---

## 2. Therapist App

### 2.1 Dashboard Header

**File:** `src/pages/therapist/Dashboard.jsx` — `DashboardHeader` component.

- Alert count changes from plain inline text (`3 clients need attention`) to a pill badge:
  - `background: rgba(248,113,113,0.10)`, `border: 1px solid rgba(248,113,113,0.22)`, `color: #f87171`, `border-radius: 999px`, `padding: 2px 10px 2px 8px`
  - Leading red dot (6×6px circle) inside the pill
- Active client count stays as teal text (`color: #29B5CC`), separated by a `·` in `#333`
- No change to the heading text or greeting logic.

### 2.2 AdherenceCard

**File:** `src/pages/therapist/Dashboard.jsx` — `AdherenceCard` / `ClientAdherenceRow`.

- Section label row: the existing expand button (`See all (N)` / `Show less`) already sits on the right side of the header — keep it, just ensure the row is `display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px` (update margin from current `16px`).
- `ClientAdherenceRow` name column: set `width: 80px; flex-shrink: 0` so percentages align cleanly across all rows.
- Dot size stays at `7×7px` — no change.
- Legend: add `margin-left: auto` to the "Each dot = 1 due session" span so it right-aligns within the flex legend row.
- Card border/padding/radius updated via global token changes above.

### 2.3 NeedsAttentionCard

**File:** `src/pages/therapist/Dashboard.jsx` — `NeedsAttentionCard` / `AlertRow`.

- `AlertRow` padding: `10px 14px` (was `10px 12px`).
- `AlertRow` border-radius: `10px` (was `8px`).
- Dismiss `✕` button: keep existing hover-reveal behaviour, no change to logic.
- Footnote text: `color: #444` (was `var(--color-subtle)`) to dim further — it's metadata, not primary content.
- No structural changes.

### 2.4 ActivityFeedCard

**File:** `src/pages/therapist/Dashboard.jsx` — `ActivityFeedCard`.

- Avatar size: `32px → 34px` width/height.
- Avatar background: keep existing `rgba(77,142,247,0.10)` / border `rgba(77,142,247,0.20)` blue treatment — this visually distinguishes the activity feed from the teal-accented adherence/alerts cards.
- Activity row padding: `9px 8px → 10px 8px`.
- RPE/Pain badge border-radius: `4px → 5px`.
- "Last 10 sessions" label: `color: #444` (dimmer — it's a footnote).

### 2.5 Sidebar

**File:** `src/components/therapist/AppSidebar.jsx` — `NavItem`.

- Active nav item: change border-left flush treatment to a rounded right-edge style:
  - `border-radius: 0 8px 8px 0`
  - `margin-left: 0; padding-left: 22px` (compensate for removed left margin)
  - Keeps the `border-left: 2px solid #29B5CC` and `background: rgba(41,181,204,0.08)`.
- Inactive nav items: add `border-radius: 8px` so hover state is contained.
- No changes to logo, account section, or bottom zone structure.

---

## 3. Client App

### 3.1 PageHero — Personalised Greeting

**File:** `src/components/shared/PageHero.jsx` and `src/pages/client/Dashboard.jsx`.

The client dashboard currently passes `title="My Sessions"` and `subtitle="{name} · {clinic}"`. Change to:

- **Title:** `"Hi, {firstName}"` — derive `firstName` from `profile.name.split(' ')[0]` (same pattern used in the therapist dashboard).
- **Subtitle:** `"{clinicName} · Week {N} of {M}"` — compute using the existing `currentProgramWeek(startDate)` helper already in the client Dashboard, applied to the prescription with the earliest non-null `start_date` among `activeSessions`. `M` = that prescription's `duration_weeks`. If no active prescription has both `start_date` and `duration_weeks` set, fall back to just `"{clinicName}"`.
- The `PageHero` component itself does not need to change — only the props passed from `ClientDashboard`.

### 3.2 Session Cards

**File:** `src/pages/client/Dashboard.jsx` — the session card mapped in `visibleSessions.map`.

#### 3.2.1 Card shell
- `border-radius: 14px`
- `padding: 18px 18px 16px`
- `backdrop-filter: blur(12px)`
- Top shimmer line: `position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(41,181,204,0.18), transparent)` — the card needs `position: relative; overflow: hidden`.
- `transition: border-color 0.2s` on hover → `border-color: rgba(41,181,204,0.18)`.
- Recently-completed variant (session done within `frequency_days`): stronger shimmer `rgba(41,181,204,0.35)` and border `rgba(41,181,204,0.20)`.

#### 3.2.2 Dot progress row
Add a dot progress row between the session meta line and the CTA footer. Reuse the existing `generateSlots` function from the therapist dashboard — move it from `src/pages/therapist/Dashboard.jsx` to a new file `src/utils/adherenceUtils.js` and import it in both `Dashboard.jsx` files.

- Show up to 12 dots (same cap as therapist adherence view).
- Append a `"{done} of {total} sessions"` text label in `font-size: 10px; color: #444` immediately after the dots.
- Dots: `width: 8px; height: 8px; border-radius: 50%` — slightly larger than therapist view (8px vs 7px) for mobile legibility.

#### 3.2.3 Week badge
- Currently: `border-radius: 4px` square.
- After: `border-radius: 999px` pill, keep existing teal colours.
- Locked future-week cards: grey badge — `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #555`.

#### 3.2.4 CTA footer layout
- Restructure to a flex row: `display: flex; gap: 8px; align-items: center`.
- Primary CTA button: `flex: 1` — fills remaining space.
- Download button: icon-only, `width: 38px; height: 38px; border-radius: 9px; background: rgba(255,255,255,0.04); border: 1px solid rgba(100,160,255,0.10); color: #555`. The existing download SVG fits.
- The existing "Download all sessions" text button above the list stays — it's a different action (bulk download).

#### 3.2.5 "Done today" state
When `isRecentlyCompleted(session)` is true, the primary CTA changes to:
- Text: `"Do again →"`
- Style: `background: rgba(41,181,204,0.10); border: 1px solid rgba(41,181,204,0.25); color: #29B5CC` — outline teal, not filled.
- This is purely presentational — clicking still navigates to `SessionWizard` as before.

#### 3.2.6 Locked future-week cards
When `isFuture` is true (session not yet available):
- `opacity: 0.45` (was already 0.6 — reduce slightly more).
- Week badge uses grey variant (see 3.2.3).
- CTA button: `background: rgba(255,255,255,0.03); border: 1px solid rgba(100,160,255,0.08); color: #444; cursor: default`.
- Text: `"Locked until Week {week_number}"`.
- No dot progress row rendered for locked cards.

### 3.3 Bottom Nav

**File:** `src/components/client/BottomNav.jsx`.

Add a teal pill indicator behind the active tab icon:

```jsx
// Inside each tab Link, before the Icon:
{active && (
  <span style={{
    position: 'absolute',
    top: '6px',
    width: '36px',
    height: '28px',
    borderRadius: '10px',
    background: 'rgba(41,181,204,0.10)',
  }} />
)}
```

Add `position: 'relative'` explicitly to the `Link` element. The icon wrapper `div` (which already exists around the icon for the badge) gets `position: 'relative'; zIndex: 1` so it sits above the pill. The label `span` also needs `position: 'relative'; zIndex: 1`.

No changes to tab labels, icons, badge logic, or routing.

---

## 4. Files Changed Summary

| File | Change type |
|---|---|
| `src/utils/adherenceUtils.js` | New file — extract `generateSlots` from therapist Dashboard |
| `src/components/therapist/styles.js` | Update `CARD` constant (radius, padding, blur, hover) |
| `src/pages/therapist/Dashboard.jsx` | Import `generateSlots` from utils; header pill; adherence row width; alert row polish; activity feed avatar size; badge radius |
| `src/components/therapist/AppSidebar.jsx` | Active nav item rounded right edge |
| `src/pages/client/Dashboard.jsx` | Personalised hero props; import `generateSlots` from utils; session card shell; dot row; CTA footer; done/locked states |
| `src/components/client/BottomNav.jsx` | Active tab pill indicator |
| `src/components/shared/PageHero.jsx` | No changes needed — props-driven |

---

## 5. Out of Scope

- Exercise library layout (no thumbnail changes).
- Marketing homepage (separate spec).
- Check-in cards (already polished with amber theme shimmer line).
- Session wizard / exercise detail screens.
- New features (quick-start templates, notifications, wearable integrations).
- Any database or API changes.
