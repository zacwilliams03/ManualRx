# UI Polish — Therapist & Client App

**Date:** 2026-06-10  
**Scope:** Therapist app + client mobile app. Marketing homepage deferred (separate spec).  
**Approach:** Information-Hierarchy Lift — visual polish as the primary goal, with targeted structural improvements where data surfacing clearly benefits from it.  
**Not in scope:** Exercise library thumbnails, landing page, any new features or backend changes.

---

## 1. Global Token Changes

**Important:** The `CARD` constant in `src/components/therapist/styles.js` already has `borderRadius: '14px'`, `padding: '22px 24px'`, `backdropFilter: 'blur(12px)'`, `position: 'relative'`, and `overflow: 'hidden'`. These are **not** changes — they are already the correct state. The table below lists only what actually needs to change.

### 1.1 `src/components/therapist/styles.js` — `SECTION_LABEL`

| Property | Current | Proposed |
|---|---|---|
| `fontWeight` | `600` | `700` |
| `letterSpacing` | `'0.08em'` | `'0.09em'` |

`CARD` itself needs no changes.

### 1.2 `src/index.css` — CSS custom properties

| Property | Current | Proposed |
|---|---|---|
| `--color-muted` (`:root` / dark mode only) | `#888888` | `#999999` |

Definition is in `src/index.css` at the `:root` block (line 12). The `[data-theme="light"]` value `#475569` is unchanged. This affects all components using `var(--color-muted)` globally — that is intentional; the shift is subtle (contrast remains acceptable) and consistent.

### 1.3 Per-component changes (no shared constant to update)

These are applied individually at each call site as described in §§2–3:

| Change | Where |
|---|---|
| Card hover border `rgba(41,181,204,0.18)` + `transition: border-color 0.2s` | Per card component via `onMouseEnter`/`onMouseLeave` |
| Category/status pill `border-radius: 999px` | Week badges in client Dashboard; category pills in Exercise Library |
| Interactive row `transition: background 0.15s ease` | `ClientAdherenceRow`, activity feed rows |
| Alert row `border-radius: 10px` | `AlertRow` in therapist Dashboard |
| RPE/Pain badge `border-radius: 5px` | `ActivityFeedCard` badge spans |

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
- **Subtitle:** `"{clinicName} · Week {N} of {M}"` — compute using the existing `currentProgramWeek(startDate)` helper already in the client Dashboard. Selection expression:
  ```js
  const datedSessions = activeSessions.filter(s => s.start_date && s.duration_weeks)
  const anchor = datedSessions.sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0]
  const weekN = anchor ? currentProgramWeek(anchor.start_date) : null
  const weekM = anchor?.duration_weeks ?? null
  ```
  Note: `activeSessions` is `sessions.filter(isActive)` and `isActive` returns `true` when dates are `null`, so the additional `filter` is required. If `anchor` is undefined (no dated sessions), fall back to just `"{clinicName}"`.
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
Add a dot progress row between the session meta line and the CTA footer.

**Extraction:** Move `generateSlots` from `src/pages/therapist/Dashboard.jsx` to a new `src/utils/adherenceUtils.js` and export it. Add `import { generateSlots } from '../../utils/adherenceUtils'` to **both** `src/pages/therapist/Dashboard.jsx` (replacing the existing local definition — it is called by both `AdherenceCard` and `computeAlerts`) and `src/pages/client/Dashboard.jsx`.

**In the client card:** call `generateSlots(session, session.session_logs ?? [])`, then `.slice(0, 12)` the result to cap at 12 dots. The therapist view has no numeric slice — it relies on flex-wrap within a fixed-width container. The client card uses an explicit cap.

- Compute `done = slots.filter(s => s.status === 'done').length` and `total = slots.filter(s => s.status !== 'pending').length` for the label.
- Append a `"{done} of {total} sessions"` text label in `font-size: 10px; color: #444` immediately after the dots.
- Dots: `width: 8px; height: 8px; border-radius: 50%`.

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

Add a teal pill indicator behind the active tab icon. The current `Link` has no `position` set — the nearest positioned ancestor is the fixed `<nav>`, so an absolute-positioned pill placed anywhere inside the Link without a positioned parent would escape to the nav level.

**Required structure:**

```jsx
<Link
  style={{ minHeight: '56px', position: 'relative' }}  // add position: relative
  ...
>
  {active && (
    <span style={{           // direct child of Link — positioned relative to Link
      position: 'absolute',
      top: '6px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '36px',
      height: '28px',
      borderRadius: '10px',
      background: 'rgba(41,181,204,0.10)',
    }} />
  )}
  <div style={{ position: 'relative', zIndex: 1 }}>  {/* already exists */}
    <Icon ... />
    {badge}
  </div>
  <span className="..." style={{ position: 'relative', zIndex: 1 }}>{label}</span>
</Link>
```

The pill is a **direct child of the Link** (not inside the icon wrapper div). The Link gets `position: 'relative'` added to its existing `style` prop. The existing icon wrapper `<div>` already has `position: 'relative'` — add `zIndex: 1`. The label `<span>` gets `style={{ position: 'relative', zIndex: 1 }}` added alongside its existing `className`.

No changes to tab labels, icons, badge logic, or routing.

---

## 4. Files Changed Summary

| File | Change type |
|---|---|
| `src/utils/adherenceUtils.js` | New file — extract `generateSlots` from therapist Dashboard |
| `src/components/therapist/styles.js` | Update `SECTION_LABEL`: fontWeight 600→700, letterSpacing 0.08em→0.09em. `CARD` unchanged. |
| `src/index.css` | `--color-muted` dark mode: `#888888` → `#999999` |
| `src/pages/therapist/Dashboard.jsx` | Remove local `generateSlots`, import from utils; header pill; adherence row width; alert row polish; activity feed avatar size; badge radius |
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
