# Theme Toggle — Design Spec
**Date:** 2026-06-01
**Status:** Approved (v3 — post-review)

## Context

PrescriptR is currently hardcoded to dark mode throughout. Therapists and clients have no way to switch to a lighter interface. This feature adds a light/dark theme toggle accessible from both the Settings page and the therapist onboarding flow. The preference is persisted per user in the database so it follows them across devices.

The light theme uses a Cool Slate palette (blue-gray tones) that is visually adjacent to the existing dark mode — same component shapes, spacing, and teal accent — only the color tokens change.

---

## Architecture

Four layers:

1. **CSS token layer** — `src/index.css` defines all color values as CSS custom properties on `:root` (dark, default). A `[data-theme="light"]` selector overrides them with Cool Slate values. Swapping themes requires toggling one HTML attribute on `<html>`.

2. **Tailwind bridge** — `tailwind.config.js` updates the existing `dark.*` color tokens to reference `var(--color-*)` instead of hardcoded hex. This covers Tailwind-classed components automatically, but the majority of the codebase uses inline `style={{}}` objects with raw hex values — those must be migrated per-component in steps 7–13. The Tailwind update is a minor mechanical step; the per-component inline migration is where most of the work is.

3. **ThemeContext** — new React context that eliminates flash via a two-layer read (localStorage first, then DB profile), applies the theme to `<html data-theme>`, and exposes `{ theme, setTheme }`.

4. **DB persistence** — `theme` text column added to the `users` table. Verified: `AuthContext.loadProfile` queries `.from('users').select('id, email, role, name')` — `theme` is added to this select, so `profile.theme` is available with no extra round-trip.

---

## Color Token Map

| Token | Dark (`:root`) | Light (`[data-theme="light"]`) |
|---|---|---|
| `--color-bg` | `#0e1117` | `#f8fafc` |
| `--color-surface` | `#111111` | `#ffffff` |
| `--color-elevated` | `#1a1a1a` | `#f1f5f9` |
| `--color-border` | `rgba(255,255,255,0.06)` | `rgba(15,23,42,0.08)` |
| `--color-border-strong` | `rgba(255,255,255,0.14)` | `rgba(15,23,42,0.15)` |
| `--color-text` | `#f0f0f0` | `#0f172a` |
| `--color-muted` | `#888888` | `#475569` |
| `--color-subtle` | `#555555` | `#94a3b8` |
| `--color-accent` | `#29B5CC` | `#29B5CC` |
| `--color-accent-bg` | `rgba(41,181,204,0.10)` | `rgba(41,181,204,0.12)` |
| `--color-danger` | `#f87171` | `#ef4444` |
| `--color-success` | `#4ade80` | `#16a34a` |
| `--color-warning` | `#fbbf24` | `#d97706` |

Dark mode is the default — no `data-theme` attribute on `<html>` = dark. Light mode is opt-in via `data-theme="light"`.

---

## Database Changes

Single migration — `theme` goes on the `users` table (confirmed as the table `AuthContext.loadProfile` queries):

```sql
ALTER TABLE users
ADD COLUMN theme text NOT NULL DEFAULT 'dark'
CHECK (theme IN ('dark', 'light'));
```

`AuthContext.loadProfile` adds `theme` to the existing select:
```js
.select('id, email, role, name, theme')
```

`setTheme` DB write also targets `users` — same table as the read path, so persistence is consistent.

---

## ThemeContext

**File:** `src/context/ThemeContext.jsx`

### applyTheme(value)

The helper that actually changes the DOM:
```js
function applyTheme(value) {
  if (value === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}
```

Dark mode removes the attribute (matching the `:root` default selector). Light mode sets `data-theme="light"`. Never set `data-theme="dark"` — that attribute has no matching CSS selector.

### Flash prevention — two-layer read

1. **On mount (synchronous):** read `localStorage.getItem('theme') ?? 'dark'` and call `applyTheme()` immediately. This runs before paint — no flicker.
2. **When profile loads (async):** `useEffect` on `profile` — once `profile.theme` is available, call `applyTheme()` with the authoritative DB value and sync back to localStorage.

```js
useEffect(() => {
  applyTheme(localStorage.getItem('theme') ?? 'dark')
}, [])

useEffect(() => {
  if (!profile) return
  const t = profile.theme ?? 'dark'
  applyTheme(t)
  localStorage.setItem('theme', t)
}, [profile])
```

### setTheme(value)

1. Call `applyTheme(value)` synchronously
2. Update localStorage synchronously
3. Update local React state so `useTheme()` consumers re-render
4. Write to `users` table async (fire-and-forget)

```js
async function setTheme(value) {
  applyTheme(value)
  localStorage.setItem('theme', value)
  setThemeState(value)
  if (!user) return  // DOM + localStorage already updated; DB write requires auth
  await supabase.from('users').update({ theme: value }).eq('id', user.id)
}
```

### Logout behaviour

On logout, `profile` becomes null — the profile `useEffect` does not fire (guard returns early). localStorage is **not cleared**. This means:
- Auth pages after logout show the user's last-cached theme (consistent with what they were using)
- When the same user logs back in, their DB preference is confirmed via the profile `useEffect` (no flash)
- If a different user logs in on the same device, they briefly see the previous user's cached theme until their own profile loads — this is an acceptable edge case on shared devices

Do not reset to dark on logout. The localStorage value is user-device state, not session state.

### Integration in `App.jsx`

```
<AuthProvider>
  <ThemeProvider>
    <RouterProvider />
  </ThemeProvider>
</AuthProvider>
```

`ThemeProvider` must be inside `AuthProvider` to access `useAuth().profile` and `useAuth().user`.

**Hook:** `useTheme()` — returns `{ theme, setTheme }`. Used by `ThemeToggle`, chart components, `PageHero`, and SHIMMER rendering.

---

## ThemeToggle Component

**File:** `src/components/shared/ThemeToggle.jsx`

- Segmented control matching the existing kg/lb weight unit toggle pattern exactly
- Two segments: `Sun` icon + "Light" | `Moon` icon + "Dark" — using `Sun` and `Moon` from `lucide-react` (SVG, no emojis)
- Active segment: `#29B5CC` background + white text
- Inactive segment: `var(--color-muted)` text, transparent background
- Min height 44px (touch target)
- Calls `setTheme()` from `useTheme()` on click
- Smooth `transition-colors duration-200` on segment swap

---

## styles.js — Highest Leverage Change

**File:** `src/components/therapist/styles.js`

`CARD` and `SECTION_LABEL` updated to CSS vars. `SHIMMER` constant is kept as-is (still used as the style definition) but rendered via a new `ShimmerLine` component (see below).

```js
export const CARD = {
  background: 'var(--color-surface)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--color-border)',
  borderRadius: '14px',
  padding: '22px 24px',
  position: 'relative',
  overflow: 'hidden',
}

export const SHIMMER = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
}

export const SECTION_LABEL = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-subtle)',
}
```

### ShimmerLine component

**File:** `src/components/shared/ShimmerLine.jsx`

SHIMMER is used in **33 places across 14 files**. Rather than adding `useTheme()` to each of those components, introduce a small component that owns the theme check internally:

```jsx
import { SHIMMER } from '../therapist/styles'
import { useTheme } from '../../context/ThemeContext'

export default function ShimmerLine() {
  const { theme } = useTheme()
  if (theme === 'light') return null
  return <div style={SHIMMER} />
}
```

All existing `<div style={SHIMMER} />` usages (33 across 14 files) become `<ShimmerLine />`. The import of `SHIMMER` from styles.js can be removed from each consuming file. This is a mechanical find-and-replace across the 14 files listed in steps 10–12.

Light mode cards get top-edge definition from `var(--color-border)` alone, which is sufficient.

---

## ParticleBackground in Light Mode

**File:** `src/components/ParticleBackground.jsx`

The component's `COLORS` array is hardcoded to light values (white, pale blue, teal) that are invisible against `#f8fafc`. `ParticleBackground` itself does not need changes.

`PageHero` reads from `useTheme()` and conditionally renders:
```jsx
const { theme } = useTheme()
{theme === 'dark' && <ParticleBackground ... />}
```

---

## Chart Components

**Files:** `src/components/progress/PainChart.jsx`, `VolumeChart.jsx`

Charts pass color strings directly to Recharts props. Use `useTheme()` and derive color values from `theme` — the chart re-renders automatically when theme changes because `theme` is React state:

```js
const { theme } = useTheme()
const chartColors = {
  accent: '#29B5CC',
  muted:  theme === 'dark' ? '#888888' : '#475569',
  grid:   theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
  text:   theme === 'dark' ? '#888888' : '#475569',
}
```

---

## Settings Pages

**Therapist Settings** (`src/pages/therapist/Settings.jsx`):
- Add `<ThemeToggle />` as a new row in the Preferences section, directly below the weight unit toggle
- Row label: "Theme"

**Client Settings** (`src/pages/client/Settings.jsx`):
- Add `<ThemeToggle />` as a new row in the Preferences card, directly below the weight unit toggle
- Row label: "Theme"

---

## Onboarding

**File:** `src/pages/therapist/Onboarding.jsx`

- Add `<ThemeToggle />` as a new field in the onboarding form, below the weight unit field
- Label: "Theme"
- Subtitle: "Change anytime in Settings"
- `setTheme()` handles DOM + DB — no extra save logic needed

---

## Component Migration

**Scope:** All therapist pages, all client pages, shared components, and auth pages. `HomePage` is explicitly excluded — it is a public marketing page with a deliberate dark aesthetic that is not user-configurable.

**Pattern:** Replace hardcoded hex inline styles with CSS vars:
```js
// before
style={{ color: '#f0f0f0', background: '#111111' }}
// after
style={{ color: 'var(--color-text)', background: 'var(--color-surface)' }}
```

**`<div style={SHIMMER} />` → `<ShimmerLine />`** across all 14 files (find-and-replace).

**Auth pages note:** Auth pages follow the localStorage-cached theme. If a user previously used light mode, they'll see light mode on the login page after logout — this is correct and intentional behaviour.

**Migration order** (highest leverage first):

1. `tailwind.config.js` — update `dark.*` values to `var(--color-*)` references
2. `src/index.css` — define CSS custom properties for both themes; update `html, body` background to `var(--color-bg)`
3. `src/components/therapist/styles.js` — update `CARD`, `SECTION_LABEL` to CSS vars (propagates to ~14 consuming files automatically)
4. `src/components/shared/ShimmerLine.jsx` — create new component
5. `src/context/ThemeContext.jsx` — create new file
6. `src/App.jsx` — wrap router with `ThemeProvider`
7. `src/components/shared/ThemeToggle.jsx` — create new file
8. `src/components/therapist/AppSidebar.jsx` + `SidebarLayout.jsx` — inline hex → CSS vars
9. `src/components/client/BottomNav.jsx` — inline hex → CSS vars
10. `src/components/shared/PageHero.jsx` — inline hex → CSS vars; conditionally hide `ParticleBackground` in light mode
11. All therapist pages: `Dashboard`, `Clients`, `Prescribe`, `SessionEdit`, `Templates`, `TemplateEdit`, `ExerciseLibrary`, `ExerciseDetail`, `ExerciseUpload`, `ClientDataTab`, `Settings` (+ ThemeToggle), `Onboarding` (+ ThemeToggle) — inline hex → CSS vars; `<div style={SHIMMER} />` → `<ShimmerLine />`
12. All client pages: `Dashboard`, `MyExercises`, `SessionWizard`, `History`, `ProgressTab`, `Settings` (+ ThemeToggle), `SessionComplete` — inline hex → CSS vars; `<div style={SHIMMER} />` → `<ShimmerLine />`
13. Auth pages: `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `Join` — inline hex → CSS vars
14. `PainChart`, `VolumeChart` — replace hardcoded color strings with `useTheme()`-derived `chartColors` object

---

## Verification

1. `npm run dev` — app loads in dark mode by default (no `data-theme` on `<html>`)
2. Therapist Settings → toggle to Light → all therapist pages switch to Cool Slate palette immediately
3. Client Settings → toggle to Light → all client pages switch
4. Refresh page — no flash; light mode restores instantly from localStorage before profile loads
5. Log out — login page retains last-used theme from localStorage
6. Log back in — theme confirmed from DB (no flash for same user)
7. Open Onboarding (new therapist) — toggle visible and functional
8. Verify at 375px mobile — no horizontal scroll, nav readable in both themes
9. Confirm `#29B5CC` teal accent identical in both themes
10. Toggle to light — PainChart and VolumeChart update axis/grid colors without page refresh
11. Verify no particles visible in light mode (PageHero)
12. Toggle to light — ShimmerLine hidden, card borders visible
13. WCAG contrast: `#0f172a` on `#ffffff` = 19.1:1 ✓; `#475569` on `#ffffff` = 5.9:1 ✓
14. `HomePage` — confirm it does not respond to theme toggle (always dark)
15. Inspect `<html>` in DevTools: dark mode has no `data-theme` attribute; light mode has `data-theme="light"`
16. Cross-device sync: set light on device A → log in on device B (fresh localStorage) → confirm light loads from DB after profile resolves (brief dark flash then light is acceptable)
