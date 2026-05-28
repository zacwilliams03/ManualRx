# Client UI Redesign — Match Therapist Design Language

**Date:** 2026-05-28  
**Status:** Approved

## Problem

The client-facing UI uses plain Tailwind card classes (`bg-dark-surface`, `border-dark-border`, `rounded-lg`) while the therapist side was fully redesigned with glassmorphism cards, shimmer gradients, Framer Motion animations, and PageHero section headers. The two sides share the same color tokens and font but look visually mismatched.

## Goal

Bring the client UI to visual parity with the therapist side using the same design system constants (`CARD`, `SHIMMER`, `SECTION_LABEL` from `styles.js`), without changing navigation structure (bottom nav stays), backend logic, or auth flow.

## Scope

**Pages updated:** Dashboard, History, Settings, SessionWizard, BottomNav  
**Pages excluded:** MyExercises (coming-soon stub — not worth touching)  
**Navigation:** Bottom tab nav kept as-is; no sidebar introduced  
**Backend:** No changes

---

## Architecture Change

### Move shared components

`PageHero.jsx` is purely presentational with no therapist-specific logic. Move it so both sides can import it cleanly:

```
src/components/therapist/PageHero.jsx → src/components/shared/PageHero.jsx
```

`ParticleBackground.jsx` is **already** at `src/components/ParticleBackground.jsx` (not inside `therapist/`). `PageHero.jsx` currently imports it as `'../ParticleBackground'`. After moving `PageHero.jsx` to `src/components/shared/`, that import path stays identical (`'../ParticleBackground'`) since both `shared/` and `therapist/` are one level below `components/`. No change needed to `ParticleBackground.jsx` or its import inside `PageHero.jsx`.

**Update therapist page imports after the move.**  
Run `grep -r "from.*PageHero" src/` to find all usages. Known files requiring an import path update from `'../components/therapist/PageHero'` → `'../components/shared/PageHero'` (or equivalent relative path):

- `src/pages/therapist/Clients.jsx`
- `src/pages/therapist/Prescribe.jsx`
- `src/pages/therapist/Templates.jsx`
- `src/pages/therapist/ExerciseLibrary.jsx`
- `src/pages/therapist/SessionEdit.jsx`
- `src/pages/therapist/TemplateEdit.jsx`
- `src/pages/therapist/Settings.jsx`
- `src/pages/therapist/ExerciseDetail.jsx`
- `src/pages/therapist/ExerciseUpload.jsx`
- `src/pages/therapist/Dashboard.jsx`

Confirm the grep finds no additional usages before moving on. `Dashboard.jsx` also imports `ParticleBackground` directly — that path is unaffected by any move.

`styles.js` stays at `src/components/therapist/styles.js`. Client pages import `{ CARD, SHIMMER, SECTION_LABEL }` directly from there — it is constants-only with no side effects.

---

## Design System Reference

All glass cards follow this pattern (from `styles.js`):

```js
// Container
style={CARD}  // backdrop-filter:blur(12px), rgba(13,17,23,0.85) bg, border-radius:14px

// Shimmer top accent (first child, position:absolute)
<div style={SHIMMER} />  // 1px gradient: transparent → teal → blue → transparent

// Section labels
<div style={SECTION_LABEL}>Label Text</div>  // 11px, uppercase, #888, letter-spacing
```

Primary button: `background:'#29B5CC', color:'#000', borderRadius:'7px', fontWeight:600`  
Teal outline button: `color:'#29B5CC', border:'1px solid rgba(41,181,204,0.3)', background:'transparent'`  
Red outline button: `color:'#f87171', border:'1px solid rgba(248,113,113,0.25)', background:'transparent'`

Framer Motion list stagger: `initial={{ opacity:0, y:8 }}`, `animate={{ opacity:1, y:0 }}`, `transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}`

---

## Page-by-Page Changes

### 1. BottomNav (`src/components/client/BottomNav.jsx`)

Minor glass treatment to match the redesigned pages:
- Add `borderTop: '1px solid rgba(41,181,204,0.08)'` (replaces plain `border-dark-border`)
- Add `backdropFilter: 'blur(8px)'` and `background: 'rgba(14,17,23,0.95)'`
- Active tab teal color already correct — verify it uses `#29B5CC` not a Tailwind class that could drift

### 2. Dashboard (`src/pages/client/Dashboard.jsx`)

- **Add PageHero** (from `shared/PageHero`): title `"My Sessions"`, subtitle built from existing in-scope variables: `profile?.name` (from `useAuth()`) and `clinicName` (from `useClinicName()` hook, already imported). Match the existing null-guard pattern: `{profile?.name}{clinicName ? \` · ${clinicName}\` : ''}`
- **Session cards:** Replace Tailwind card classes with inline `CARD` + `SHIMMER` styles
- **Start button:** Change from `bg-brand-primary text-white` to `background:'#29B5CC', color:'#000'` (black text matches therapist)
- **Completed badge:** Add `border: '1px solid rgba(41,181,204,0.2)'` to the existing teal pill
- **Stagger animation:** Wrap session list in `<motion.div>` with per-item stagger (index `i`, delay `Math.min(i * 0.05, 0.3)`)
- **Page entry:** Wrap content in `motion.div` with `initial={{ opacity:0, y:8 }}`, `animate={{ opacity:1, y:0 }}`

### 3. History (`src/pages/client/History.jsx`)

- **Add PageHero:** title `"History"`, subtitle `"Your completed sessions"`
- **Session log cards:** Replace Tailwind card classes with `CARD` + `SHIMMER` inline styles
- **Tab bar:** Keep existing tab logic; restyle active underline to `borderBottom: '2px solid #29B5CC'` and active color `#29B5CC` via inline styles (remove Tailwind `border-dark-accent` class)
- **Stagger animation:** Per-item on history list
- **Page entry:** `motion.div` fade-up on mount

### 4. Settings (`src/pages/client/Settings.jsx`)

- **Add PageHero:** title `"Settings"`, subtitle `"Preferences & account"`
- **Preferences section:** Wrap in `CARD` + `SHIMMER`; add `SECTION_LABEL` text `"Preferences"` above the weight unit toggle
- **Account section:** Wrap in separate `CARD` + `SHIMMER`; add `SECTION_LABEL` text `"Account"` above buttons
- **Change password button:** Restyle to teal outline (inline styles, remove Tailwind classes)
- **Log out button:** Restyle to red outline (inline styles)
- **Page entry:** `motion.div` fade-up on mount

### 5. SessionWizard (`src/pages/client/SessionWizard.jsx`)

No PageHero. Glass card treatment on each wizard step. Counter pulse animation on set completion.

**Intro step:** Wrap center card in `CARD` + `SHIMMER`. The intro step renders in a `min-h-[100dvh]` centered layout — add `paddingBottom: 'calc(80px + env(safe-area-inset-bottom))'` to the outer container so the card clears the bottom nav (which renders on all client routes including `/client/sessions/:id`). The current intro step lacks this clearance; fix it as part of the redesign.

**Per-exercise step:**
- Wrap the exercise content area in `CARD` + `SHIMMER`. `CARD` has `padding: '22px 24px'` baked in; the exercise step has its own internal padding structure (sticky header, scrollable body, sticky footer CTA). Use a partial spread to avoid conflicting padding: `style={{ ...CARD, padding: 0 }}` on the outer container, then apply padding only to the inner content regions. Same applies to the summary and done-state cards if they have custom padding.
- Target box: keep dark inset style (already close — use `rgba(255,255,255,0.03)` bg)
- Input fields: restyle to `rgba(255,255,255,0.04)` bg, `rgba(255,255,255,0.08)` border, `7px` radius
- Category badge: `background:'rgba(41,181,204,0.08)', border:'1px solid rgba(41,181,204,0.15)', borderRadius:'4px', color:'#29B5CC'`

**Set counter pulse animation:**  
Use a Framer Motion `<motion.span>` wrapping the set number. On set completion, trigger via `key` prop change (changing `key` forces Framer Motion to re-run the animation):
```jsx
<motion.span
  key={currentSet}  // changes on each completion
  initial={{ scale: 1, color: '#f0f0f0' }}
  animate={{ scale: [1, 1.35, 1], color: ['#f0f0f0', '#29B5CC', '#f0f0f0'] }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  Set {currentSet}
</motion.span>
```

**Completed set rows:** Slide in with `initial={{ opacity:0, y:-6 }}`, `animate={{ opacity:1, y:0 }}`, `transition={{ duration:0.25 }}`; styled as teal-tinted recap rows (`rgba(41,181,204,0.07)` bg, teal border)

**Summary step:** Wrap in `CARD` + `SHIMMER`

**Done state:** Wrap success card in `CARD` + `SHIMMER`. Update the "Back to sessions" `<Link>` (currently `bg-brand-primary text-white`) to primary button inline style (`background:'#29B5CC', color:'#000'`) for consistency.

**Intro step buttons:** The "Start session" button (currently `bg-brand-primary text-white`) also needs the same primary button inline style update.

---

## Verification

1. **Dev server:** `npm run dev` — visit client routes (`/client/dashboard`, `/client/history`, `/client/settings`)
2. **Visual check:** Each page shows PageHero with teal shimmer border-bottom, glass cards with shimmer top accent, staggered fade-up on list items
3. **SessionWizard:** Navigate through a session — set counter should pulse teal on each completion; completed set rows slide in
4. **BottomNav:** Glass blur visible on pages with scrollable content behind nav
5. **Therapist pages:** Confirm no regressions — PageHero and ParticleBackground still render correctly after path move
6. **Mobile:** Verify bottom nav clearance (`pb-20`) still gives enough space below last card
