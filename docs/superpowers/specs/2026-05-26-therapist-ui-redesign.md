# Therapist UI Redesign — Design Spec
**Date:** 2026-05-26  
**Status:** Approved

---

## Context

The therapist dashboard was recently rebuilt with a polished dark design: navy-blue base (`#0e1117`), subtle cyan particle background, glass-morphic cards with shimmer top borders, and Framer Motion animations. The remaining therapist-side pages (Clients, Prescribe, Templates, Exercise Library, Settings, Onboarding) still use the old flat dark theme (`#0a0a0a`, no glass cards, no hero zone), creating a visible inconsistency. This spec defines how to bring all remaining pages in line with the dashboard's design language.

---

## Scope

**Pages to redesign (full treatment):**
- `/therapist/clients` — Clients list
- `/therapist/prescribe/:clientId` — Prescribe (tabs)
- `/therapist/prescribe/:clientId/sessions/:sessionId` — Session Edit
- `/therapist/templates` — Templates list
- `/therapist/templates/:templateId` — Template Editor
- `/therapist/exercises` — Exercise Library
- `/therapist/exercises/new` — Exercise Upload
- `/therapist/exercises/:id` — Exercise Detail

**Pages to redesign (lighter treatment — form pages):**
- `/settings` — Settings
- `/onboarding` — Onboarding

**Already done:** `/therapist` (Dashboard) — reference design. Dashboard retains full-page `<ParticleBackground spawnFromTop />` — intentionally exempt from the hero-zone-only rule. Other pages use the confined hero pattern.

**Not in scope:** `AppSidebar`, `SidebarLayout` — already correct.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Approach | Shared `PageHero` component + page-by-page | One new component, pages stay readable, one file to change if hero ever updates |
| Particle placement | Hero zone only (not full page) | Performance — full-page particles on every page is heavy |
| Hero style | Title left + subtitle + CTA right + subtle particles | Matches dashboard greeting zone; CTA in hero reduces layout clutter below |
| Animation | Subtle only — fade + slide-up on page load | Fast load times; can layer more later |
| Global bg color | `dark.bg`: `#0a0a0a` → `#0e1117` | One-line Tailwind config change; sidebar already uses `#0e1117`, eliminates the contrast mismatch |

---

## Global Change

**`tailwind.config.js`** — update `dark.bg`:
```js
dark: {
  bg: '#0e1117',  // was #0a0a0a
  // rest unchanged
}
```
This propagates via `bg-dark-bg` on `SidebarLayout` and also affects client-side pages (`src/pages/client/`) — intentional, since they are also dark-themed and the blue tint improves consistency across the whole app. If client pages need to be isolated, override inline there instead of changing the token.

---

## Shared Component: `PageHero`

**File:** `src/components/therapist/PageHero.jsx`

**Props:**
```jsx
<PageHero
  title="Clients"           // page/context title
  subtitle="3 active · 1 inactive"  // optional muted line below
  back={{ label: "Clients", to: "/therapist/clients" }}  // optional breadcrumb
  actions={<><Button>Export PDF</Button><Button primary>+ Add Client</Button></>}  // optional right side
/>
```

**Visual spec:**
- Background: `#0e1117` (inherits from `bg-dark-bg`)
- Radial glow: `radial-gradient(ellipse at 75% 60%, rgba(41,181,204,0.06), transparent 65%)`
- Particles: `<ParticleBackground position="absolute" particleCount={60} />` inside the hero wrapper (which must be `position: relative; overflow: hidden`). The `position` prop already exists — `HomePage.jsx` uses this same pattern.
- Title: 24–26px, `font-weight: 700`, `color: #e8edf5`, `letter-spacing: -0.02em`
- Subtitle: 13px, `color: #666`
- Back breadcrumb (when present): 12px, `color: #555`, rendered above title
- Bottom border: `1px solid rgba(41,181,204,0.08)`
- Padding: `32px 32px 28px` (desktop)
- Animation: `motion.div` fade + slide-up on mount (`opacity: 0→1`, `y: 8→0`, `duration: 0.3`)

---

## Glass Card Style

Reuse the dashboard's `CARD` + `SHIMMER` constants. Extract to `src/components/therapist/styles.js`:

```js
export const CARD = {
  background: 'rgba(13,17,23,0.85)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(100,160,255,0.08)',
  borderRadius: '14px',
  padding: '22px 24px',
  position: 'relative',
  overflow: 'hidden',
}

export const SHIMMER = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)',
  position: 'absolute',
  top: 0, left: 0, right: 0,
}

export const SECTION_LABEL = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#888888', // matches Dashboard.jsx — not #555555
}
```

---

## Animation Pattern

All pages use the same Framer Motion entrance:

```jsx
// Page wrapper
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25, ease: 'easeOut' }}
>

// Staggered list items (Clients, Templates, Exercise Library)
// Cap delay to avoid long waits on large lists
<motion.div
  initial={{ opacity: 0, y: 6 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
>
```

---

## Page-by-Page Spec

### Clients (`Clients.jsx`)
- **Hero:** Title "Clients", subtitle "{n} active · {n} inactive", CTA "+ Add Client"
- **Content:** Search input → glass card with `SECTION_LABEL` "Active Clients" / "Inactive Clients" → client rows (avatar initial + name + email left, status badge + "View" button right)
- **Client avatar:** 34px circle, cyan bg + initials for active, muted gray for inactive
- **Status badge:** `rgba(41,181,204,0.08)` bg, `#29B5CC` text, cyan border

### Prescribe (`Prescribe.jsx`)
- **Hero:** Title = client name, subtitle = "{n} active prescriptions", back breadcrumb "← Clients", CTAs: "Export PDF" (secondary, non-functional placeholder) + "+ Add Prescription" (primary)
- **Tabs:** Flush below hero divider — "Prescribed Sessions" / "Session History" / "Client Data"; active tab = `color: #29B5CC`, `border-bottom: 2px solid #29B5CC`; inactive = `color: #555`
- **Prescribed Sessions tab:** Glass card per prescription — header row (name + frequency/dates + status badge + Edit button), exercise rows below (name left, sets × reps right)
- **Session History tab:** Glass card per completed session — same structure
- **Client Data tab:** Unchanged (charts/analytics — no card re-wrap needed)
- **Tab content:** Staggered fade-in on switch

### Session Edit (`SessionEdit.jsx`)
- **Hero:** Title = session name, back breadcrumb "← {client name}", CTA "Save" (primary)
- **Content:** Form fields in glass card — name, frequency, start date, duration weeks; exercise list rows below with inline edit

### Templates (`Templates.jsx`)
- **Hero:** Title "Templates", subtitle "{n} templates", CTA "+ New Template"
- **Content:** Search + category filter pills → glass card with template rows (name + category badge + exercise count left, Edit + Delete buttons right)
- **Category pills:** Toggle filter, active = `rgba(41,181,204,0.12)` bg + cyan border

### Template Editor (`TemplateEdit.jsx`)
- **Hero:** Title = template name (or "New Template"), back breadcrumb "← Templates", CTA "Save"
- **Content:** Form fields (name, category, duration) in glass card; exercise list in second glass card

### Exercise Library (`ExerciseLibrary.jsx`)
- **Hero:** Title "Exercise Library", subtitle "{n} exercises", CTA "+ Add Exercise"
- **Content:** Search + category pills → glass card with exercise rows (name + category badge left, "Video" badge if present + Delete if custom right)
- **Pagination:** Previous/Next buttons below card, muted styling

### Exercise Upload (`ExerciseUpload.jsx`)
- **Hero:** Title "New Exercise", back breadcrumb "← Exercise Library", CTA "Save Exercise"
- **Content:** Form fields in single glass card (name, description, categories, sets/reps, video upload)

### Exercise Detail (`ExerciseDetail.jsx`)
- **Hero:** Title = exercise name, back breadcrumb "← Exercise Library", CTA "Delete" (red, custom-only)
- **Content:** Category badges, description, video player — in glass card

### Settings (`Settings.jsx`)
- **Hero:** Title "Settings", subtitle "Clinic preferences and account" — no CTA button
- **Content:** Form sections separated by thin dividers (`rgba(255,255,255,0.05)`), uppercase section labels, consistent inputs — no glass cards
- **Inputs:** `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`, `border-radius: 7px`

### Onboarding (`Onboarding.jsx`)
- **Hero:** Title "Welcome to ManualRx", subtitle "Set up your clinic" — no CTA button
- **Content:** Same as Settings form treatment
- **Footer:** "Save" (primary) + "Skip" (muted text link) buttons

---

## Deferred Features

- **Export PDF** — button is rendered on Prescribe page hero but non-functional. Future: generates/prints all prescribed sessions for the client.

---

## Verification

1. Run `npm run dev`, visit each page — confirm `#0e1117` background, hero zone particles, glass cards
2. Check sidebar + content area match (no visible seam between sidebar and main bg)
3. Confirm tab active state (cyan underline) on Prescribe
4. Confirm Framer Motion animations: fade-in on page load, staggered on lists
5. Confirm Export PDF button renders but does nothing on Prescribe
6. Check Settings and Onboarding: form sections, no glass cards, subtle hero
7. Verify no regressions on Dashboard page
