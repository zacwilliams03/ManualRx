# Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light/dark theme toggle to PrescriptR, persisted per user in the database, accessible from Settings and Onboarding.

**Architecture:** CSS custom properties on `:root` (dark default) and `[data-theme="light"]` (Cool Slate override) drive all color changes via a single HTML attribute. `ThemeContext` reads from `localStorage` on mount (instant, no flash), then syncs with the DB profile when it loads. All 33 `<div style={SHIMMER} />` usages become `<ShimmerLine />`, which hides itself in light mode.

**Tech Stack:** React 18, Vite, Tailwind CSS, Supabase JS v2, lucide-react (already installed at ^1.16.0)

---

## File Map

**Created:**
- `src/context/ThemeContext.jsx` — theme state, DOM attribute, DB write
- `src/components/shared/ThemeToggle.jsx` — segmented Light/Dark control
- `src/components/shared/ShimmerLine.jsx` — theme-aware SHIMMER wrapper

**Modified:**
- `src/index.css` — CSS custom properties for both themes
- `tailwind.config.js` — `dark.*` tokens → `var(--color-*)`
- `src/components/therapist/styles.js` — CARD, SECTION_LABEL → CSS vars
- `src/context/AuthContext.jsx` — add `theme` to profile select
- `src/App.jsx` — wrap with ThemeProvider
- `src/components/therapist/AppSidebar.jsx` — inline hex → CSS vars
- `src/components/therapist/SidebarLayout.jsx` — inline hex → CSS vars
- `src/components/client/BottomNav.jsx` — inline hex → CSS vars
- `src/components/shared/PageHero.jsx` — inline hex → CSS vars, hide particles in light
- `src/pages/therapist/Dashboard.jsx` — migrate + ShimmerLine
- `src/pages/therapist/Clients.jsx` — migrate + ShimmerLine
- `src/pages/therapist/ClientDataTab.jsx` — migrate
- `src/pages/therapist/Prescribe.jsx` — migrate + ShimmerLine
- `src/pages/therapist/SessionEdit.jsx` — migrate + ShimmerLine
- `src/pages/therapist/Templates.jsx` — migrate + ShimmerLine
- `src/pages/therapist/TemplateEdit.jsx` — migrate + ShimmerLine
- `src/pages/therapist/ExerciseLibrary.jsx` — migrate + ShimmerLine
- `src/pages/therapist/ExerciseDetail.jsx` — migrate + ShimmerLine
- `src/pages/therapist/ExerciseUpload.jsx` — migrate + ShimmerLine
- `src/pages/therapist/Settings.jsx` — migrate + ThemeToggle row
- `src/pages/therapist/Onboarding.jsx` — migrate + ThemeToggle field
- `src/pages/client/Dashboard.jsx` — migrate + ShimmerLine
- `src/pages/client/SessionWizard.jsx` — migrate + ShimmerLine
- `src/pages/client/History.jsx` — migrate + ShimmerLine
- `src/pages/client/ProgressTab.jsx` — migrate
- `src/pages/client/SessionComplete.jsx` — migrate
- `src/pages/client/MyExercises.jsx` — migrate
- `src/pages/client/Settings.jsx` — migrate + ShimmerLine + ThemeToggle row
- `src/pages/auth/Login.jsx` — migrate
- `src/pages/auth/Signup.jsx` — migrate
- `src/pages/auth/ForgotPassword.jsx` — migrate
- `src/pages/auth/ResetPassword.jsx` — migrate
- `src/pages/Join.jsx` — migrate
- `src/components/progress/PainChart.jsx` — useTheme-derived chart colors
- `src/components/progress/VolumeChart.jsx` — useTheme-derived chart colors
- `src/components/progress/PrescriptionProgressSection.jsx` — ShimmerLine

**Excluded:** `src/pages/HomePage.jsx` — deliberate dark-only marketing page.

---

## Token Reference (use throughout migration)

| Old hex | CSS var |
|---|---|
| `#0e1117` | `var(--color-bg)` |
| `#111111` | `var(--color-surface)` |
| `#1a1a1a` | `var(--color-elevated)` |
| `rgba(255,255,255,0.04)` or `rgba(255,255,255,0.05)` | `var(--color-elevated)` |
| `rgba(255,255,255,0.06)` | `var(--color-border)` |
| `rgba(255,255,255,0.08)` | `var(--color-border)` |
| `rgba(255,255,255,0.14)` | `var(--color-border-strong)` |
| `#f0f0f0` or `#e8edf5` or `#c8d0dc` | `var(--color-text)` |
| `#888888` or `#888` or `#666` | `var(--color-muted)` |
| `#555555` or `#555` | `var(--color-subtle)` |
| `#f87171` | `var(--color-danger)` |
| `#4ade80` | `var(--color-success)` |
| `#fbbf24` | `var(--color-warning)` |
| `#29B5CC` | keep as-is (identical in both themes) |

---

## Task 1: Pre-flight — verify Supabase trigger

**Files:** Supabase dashboard (read-only check)

- [ ] **Step 1: Inspect the trigger that populates `public.users`**

In Supabase Dashboard → Database → Functions, find the trigger function on `auth.users`. Verify the INSERT statement does not specify an explicit column list that excludes `theme`. If the function uses `INSERT INTO public.users (id, email, role, name) VALUES (...)` then adding `theme` with `NOT NULL DEFAULT 'dark'` is safe — existing and new rows get `'dark'` automatically. If the INSERT would fail on a missing column, note it before proceeding.

Expected: The migration is safe to run.

---

## Task 2: Supabase DB migration

**Files:** Supabase Dashboard → SQL Editor

- [ ] **Step 1: Run migration in Supabase SQL Editor**

```sql
ALTER TABLE users
ADD COLUMN theme text NOT NULL DEFAULT 'dark'
CHECK (theme IN ('dark', 'light'));
```

- [ ] **Step 2: Verify**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'theme';
```

Expected output: one row with `column_name = theme`, `data_type = text`, `column_default = 'dark'`.

- [ ] **Step 3: Confirm existing rows have 'dark'**

```sql
SELECT DISTINCT theme FROM users LIMIT 5;
```

Expected: single row with value `dark`.

---

## Task 3: AuthContext — add `theme` to profile select

**Files:**
- Modify: `src/context/AuthContext.jsx:47`

- [ ] **Step 1: Update the select in `loadProfile`**

Find (line 47–48):
```js
      .from('users')
      .select('id, email, role, name')
```

Replace with:
```js
      .from('users')
      .select('id, email, role, name, theme')
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Log in. In browser console:
```js
// Paste into console after login
const { data } = await window.__supabase?.from('users').select('theme').limit(1)
console.log(data)
```

Expected: `[{ theme: 'dark' }]` (or `'light'` if previously set).

- [ ] **Step 3: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: add theme column to users select in AuthContext"
```

---

## Task 4: CSS token foundation

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace `src/index.css` entirely**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg:           #0e1117;
  --color-surface:      #111111;
  --color-elevated:     #1a1a1a;
  --color-border:       rgba(255,255,255,0.06);
  --color-border-strong:rgba(255,255,255,0.14);
  --color-text:         #f0f0f0;
  --color-muted:        #888888;
  --color-subtle:       #555555;
  --color-accent:       #29B5CC;
  --color-accent-bg:    rgba(41,181,204,0.10);
  --color-danger:       #f87171;
  --color-success:      #4ade80;
  --color-warning:      #fbbf24;
}

[data-theme="light"] {
  --color-bg:           #f8fafc;
  --color-surface:      #ffffff;
  --color-elevated:     #f1f5f9;
  --color-border:       rgba(15,23,42,0.08);
  --color-border-strong:rgba(15,23,42,0.15);
  --color-text:         #0f172a;
  --color-muted:        #475569;
  --color-subtle:       #94a3b8;
  --color-accent:       #29B5CC;
  --color-accent-bg:    rgba(41,181,204,0.12);
  --color-danger:       #ef4444;
  --color-success:      #16a34a;
  --color-warning:      #d97706;
}

@layer base {
  html, body {
    background-color: var(--color-bg);
  }

  @media (max-width: 767px) {
    input,
    textarea,
    select {
      font-size: 16px;
    }
  }
}
```

- [ ] **Step 2: Update `tailwind.config.js` — `dark.*` tokens → CSS vars**

Replace the `dark:` block:
```js
        dark: {
          bg:          'var(--color-bg)',
          surface:     'var(--color-surface)',
          elevated:    'var(--color-elevated)',
          border:      'var(--color-border)',
          text:        'var(--color-text)',
          muted:       'var(--color-muted)',
          subtle:      'var(--color-subtle)',
          accent:      'var(--color-accent)',
          'accent-bg': 'var(--color-accent-bg)',
        },
```

- [ ] **Step 3: Verify Tailwind classes work**

Run `npm run dev`. The app should look identical to before (dark mode, no visible change). Open DevTools → Elements, inspect `<html>` — no `data-theme` attribute should exist.

- [ ] **Step 4: Commit**

```bash
git add src/index.css tailwind.config.js
git commit -m "feat: CSS custom property token foundation for theme system"
```

---

## Task 5: styles.js — update CARD and SECTION_LABEL

**Files:**
- Modify: `src/components/therapist/styles.js`

- [ ] **Step 1: Update the file**

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

- [ ] **Step 2: Verify**

Run `npm run dev`. Dark mode cards should look identical (CARD bg/border now use CSS vars that resolve to the same dark values).

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/styles.js
git commit -m "feat: CARD and SECTION_LABEL styles use CSS custom properties"
```

---

## Task 6: ShimmerLine component

**Files:**
- Create: `src/components/shared/ShimmerLine.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { SHIMMER } from '../therapist/styles'
import { useTheme } from '../../context/ThemeContext'

export default function ShimmerLine() {
  const { theme } = useTheme()
  if (theme === 'light') return null
  return <div style={SHIMMER} />
}
```

Note: This file imports from `ThemeContext` which doesn't exist yet (Task 7). Do not render `ShimmerLine` anywhere until Task 7 is complete — keep it as a created-but-unused file for now.

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/ShimmerLine.jsx
git commit -m "feat: ShimmerLine component, hides shimmer accent in light mode"
```

---

## Task 7: ThemeContext

**Files:**
- Create: `src/context/ThemeContext.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ThemeContext = createContext(null)

function applyTheme(value) {
  if (value === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function ThemeProvider({ children }) {
  const { profile, user } = useAuth()
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') ?? 'dark')

  useEffect(() => {
    applyTheme(localStorage.getItem('theme') ?? 'dark')
  }, [])

  useEffect(() => {
    if (!profile) return
    const t = profile.theme ?? 'dark'
    applyTheme(t)
    setThemeState(t)
    localStorage.setItem('theme', t)
  }, [profile])

  async function setTheme(value) {
    applyTheme(value)
    localStorage.setItem('theme', value)
    setThemeState(value)
    if (!user) return
    await supabase.from('users').update({ theme: value }).eq('id', user.id)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/ThemeContext.jsx
git commit -m "feat: ThemeContext with localStorage flash prevention and DB persistence"
```

---

## Task 8: App.jsx — ThemeProvider integration

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add import**

After the existing `import { AuthProvider, useAuth } from './context/AuthContext'` line, add:
```js
import { ThemeProvider } from './context/ThemeContext'
```

- [ ] **Step 2: Wrap the router**

In the `App` component's return, wrap `<BrowserRouter>` with `<ThemeProvider>`:
```jsx
export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* all existing routes unchanged */}
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. App loads in dark mode. Open DevTools console — no errors. Confirm `<html>` has no `data-theme` attribute.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wrap app with ThemeProvider"
```

---

## Task 9: ThemeToggle component

**Files:**
- Create: `src/components/shared/ThemeToggle.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const containerStyle = {
    display: 'flex',
    background: 'var(--color-elevated)',
    borderRadius: '8px',
    padding: '3px',
    gap: '2px',
  }

  const activeStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    minHeight: '38px',
    background: '#29B5CC',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  }

  const inactiveStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    minHeight: '38px',
    background: 'transparent',
    color: 'var(--color-muted)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  }

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={() => setTheme('light')}
        style={theme === 'light' ? activeStyle : inactiveStyle}
        aria-label="Switch to light mode"
      >
        <Sun size={13} />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        style={theme === 'dark' ? activeStyle : inactiveStyle}
        aria-label="Switch to dark mode"
      >
        <Moon size={13} />
        Dark
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Smoke test in isolation**

Temporarily add `<ThemeToggle />` to the therapist Settings page to verify it renders and toggles. Check DevTools: clicking "Light" should set `data-theme="light"` on `<html>`; clicking "Dark" should remove it.

- [ ] **Step 3: Remove temporary smoke test placement** (if you added it in Step 2).

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ThemeToggle.jsx
git commit -m "feat: ThemeToggle segmented control with lucide Sun/Moon icons"
```

---

## Task 10: AppSidebar + SidebarLayout migration

**Files:**
- Modify: `src/components/therapist/AppSidebar.jsx`
- Modify: `src/components/therapist/SidebarLayout.jsx`

**Migration pattern:** Replace every hardcoded hex/rgba with the matching CSS var from the Token Reference table at the top of this plan. Key values to find in these files: `#111111`, `#0e1117`, `#1a1a1a`, `rgba(255,255,255,0.06)`, `rgba(255,255,255,0.08)`, `rgba(255,255,255,0.14)`, `#f0f0f0`, `#888888`, `#555555`.

- [ ] **Step 1: Migrate `AppSidebar.jsx`**

Open the file. Apply the token table — replace every hardcoded colour with the matching `var(--color-*)`. Key spots:
- Sidebar background: `#111111` → `var(--color-surface)`
- Nav item hover background: `rgba(255,255,255,0.04)` or similar → `var(--color-elevated)`
- Active nav item background: keep teal `#29B5CC` / `rgba(41,181,204,0.XX)` (accent — unchanged)
- Text: `#f0f0f0` → `var(--color-text)`, `#888` or `#aaaaaa` → `var(--color-muted)`, `#555` → `var(--color-subtle)`
- Borders: `rgba(255,255,255,0.06)` → `var(--color-border)`, `rgba(255,255,255,0.08)` → `var(--color-border)`
- Top bar background (mobile): `#111111` → `var(--color-surface)`

- [ ] **Step 2: Migrate `SidebarLayout.jsx`**

Apply the same token table to SidebarLayout. Key spots:
- Overlay/drawer background: `rgba(0,0,0,0.X)` — overlays can stay as raw rgba (intentionally dark)
- Layout background: `#0e1117` → `var(--color-bg)`
- Any border values → `var(--color-border)`

- [ ] **Step 3: Verify**

`npm run dev` → navigate to `/therapist`. Sidebar renders correctly in dark mode. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/therapist/AppSidebar.jsx src/components/therapist/SidebarLayout.jsx
git commit -m "feat: AppSidebar and SidebarLayout use CSS custom properties"
```

---

## Task 11: BottomNav + PageHero migration

**Files:**
- Modify: `src/components/client/BottomNav.jsx`
- Modify: `src/components/shared/PageHero.jsx`

- [ ] **Step 1: Migrate `BottomNav.jsx`**

Apply the token table. Key spots:
- Bottom bar background: `#111111` or `#0e1117` → `var(--color-surface)`
- Border top: `rgba(255,255,255,0.06)` → `var(--color-border)`
- Active icon/text: keep teal (`#29B5CC` — unchanged)
- Inactive icon/text: `#555` or `#888` → `var(--color-muted)`

- [ ] **Step 2: Migrate `PageHero.jsx`**

Apply the token table. Then conditionally hide `ParticleBackground` in light mode:

Add import at top:
```jsx
import { useTheme } from '../../context/ThemeContext'
```

Inside the component, add:
```jsx
const { theme } = useTheme()
```

Find the `<ParticleBackground ... />` render and wrap it:
```jsx
{theme === 'dark' && <ParticleBackground ... />}
```

Replace any hardcoded hex background values:
- Hero background: `#0e1117` or similar → `var(--color-bg)`
- Title: `#f0f0f0` or `#e8edf5` → `var(--color-text)`
- Subtitle: `#888` → `var(--color-muted)`

- [ ] **Step 3: Verify**

`npm run dev`. Navigate to `/client` — bottom nav renders. Navigate to `/therapist` — PageHero renders. Toggle to light mode (temporarily from console: `document.documentElement.setAttribute('data-theme','light')`) — ParticleBackground disappears, hero shows Cool Slate background.

- [ ] **Step 4: Commit**

```bash
git add src/components/client/BottomNav.jsx src/components/shared/PageHero.jsx
git commit -m "feat: BottomNav and PageHero use CSS vars; particles hidden in light mode"
```

---

## Task 12: Therapist pages batch 1 — Dashboard, Clients, ClientDataTab

**Files:**
- Modify: `src/pages/therapist/Dashboard.jsx`
- Modify: `src/pages/therapist/Clients.jsx`
- Modify: `src/pages/therapist/ClientDataTab.jsx`

**For each file:**

- [ ] **Step 1: Add `ShimmerLine` import** (Dashboard and Clients use SHIMMER)

```jsx
import ShimmerLine from '../../components/shared/ShimmerLine'
```

Remove `SHIMMER` from the existing `styles` import (keep `CARD`, `SECTION_LABEL`).

- [ ] **Step 2: Replace all `<div style={SHIMMER} />`**

```jsx
// Before
<div style={SHIMMER} />
// After
<ShimmerLine />
```

Dashboard has 3 usages (lines ~210, ~334, ~404). Clients has 2 usages (~240, ~359).

- [ ] **Step 3: Apply token table to all inline hex styles**

Key patterns in Dashboard and Clients:
- Card/panel backgrounds: `rgba(13,17,23,0.85)` → (covered by CARD update in Task 5) or `#111111` → `var(--color-surface)`
- Text colours: `#f0f0f0` → `var(--color-text)`, `#888` → `var(--color-muted)`, `#555` → `var(--color-subtle)`
- Borders: `rgba(255,255,255,0.06)` or `rgba(255,255,255,0.08)` → `var(--color-border)`
- Page background: `#0e1117` → `var(--color-bg)`
- Success/danger/warning colours: use `var(--color-success)`, `var(--color-danger)`, `var(--color-warning)`
- Keep all `#29B5CC` teal values as-is

- [ ] **Step 4: Verify**

`npm run dev`. Navigate to `/therapist` and `/therapist/clients`. No console errors, dark mode looks correct.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/Dashboard.jsx src/pages/therapist/Clients.jsx src/pages/therapist/ClientDataTab.jsx
git commit -m "feat: therapist Dashboard, Clients, ClientDataTab use CSS vars + ShimmerLine"
```

---

## Task 13: Therapist pages batch 2 — Prescribe, SessionEdit

**Files:**
- Modify: `src/pages/therapist/Prescribe.jsx`
- Modify: `src/pages/therapist/SessionEdit.jsx`

- [ ] **Step 1: Add `ShimmerLine` import to each file**

```jsx
import ShimmerLine from '../../components/shared/ShimmerLine'
```

Remove `SHIMMER` from styles import.

- [ ] **Step 2: Replace all `<div style={SHIMMER} />` with `<ShimmerLine />`**

Prescribe has 2 usages (~586, ~667). SessionEdit has 2 usages (~171, ~278).

- [ ] **Step 3: Apply token table to all inline hex styles**

Key additional patterns in Prescribe and SessionEdit:
- Input fields: `rgba(255,255,255,0.04)` bg → `var(--color-elevated)`, `rgba(255,255,255,0.08)` border → `var(--color-border)`, `#e8edf5` text → `var(--color-text)`
- Disabled states / placeholder text: `#555` → `var(--color-subtle)`
- Page background: `#0e1117` → `var(--color-bg)`

- [ ] **Step 4: Verify**

Navigate to a prescription page. Dark mode correct, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx src/pages/therapist/SessionEdit.jsx
git commit -m "feat: Prescribe and SessionEdit use CSS vars + ShimmerLine"
```

---

## Task 14: Therapist pages batch 3 — Templates, TemplateEdit, ExerciseLibrary, ExerciseDetail, ExerciseUpload

**Files:**
- Modify: `src/pages/therapist/Templates.jsx`
- Modify: `src/pages/therapist/TemplateEdit.jsx`
- Modify: `src/pages/therapist/ExerciseLibrary.jsx`
- Modify: `src/pages/therapist/ExerciseDetail.jsx`
- Modify: `src/pages/therapist/ExerciseUpload.jsx`

- [ ] **Step 1: Add `ShimmerLine` import to each file**

```jsx
import ShimmerLine from '../../components/shared/ShimmerLine'
```

Remove `SHIMMER` from styles import in each file.

- [ ] **Step 2: Replace all `<div style={SHIMMER} />` with `<ShimmerLine />`**

Templates: 1 usage (~166). TemplateEdit: 2 usages (~166, ~257). ExerciseLibrary: 1 usage (~157). ExerciseDetail: 1 usage (~154). ExerciseUpload: 2 usages (~124, ~176).

- [ ] **Step 3: Apply token table to all inline hex styles in all five files**

Follow the same pattern as Tasks 12–13.

- [ ] **Step 4: Verify**

Navigate to `/therapist/templates`, `/therapist/exercises`. Dark mode correct, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/Templates.jsx src/pages/therapist/TemplateEdit.jsx src/pages/therapist/ExerciseLibrary.jsx src/pages/therapist/ExerciseDetail.jsx src/pages/therapist/ExerciseUpload.jsx
git commit -m "feat: therapist exercise and template pages use CSS vars + ShimmerLine"
```

---

## Task 15: Therapist Settings — migrate + add ThemeToggle

**Files:**
- Modify: `src/pages/therapist/Settings.jsx`

- [ ] **Step 1: Add imports at top of file**

```jsx
import ThemeToggle from '../../components/shared/ThemeToggle'
```

- [ ] **Step 2: Update `inputStyle`**

```js
const inputStyle = {
  background: 'var(--color-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: '7px',
  color: 'var(--color-text)',
  padding: '9px 14px',
  width: '100%',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}
```

- [ ] **Step 3: Update `activeToggleStyle` and `inactiveToggleStyle`**

```js
const activeToggleStyle = {
  flex: 1, padding: '8px',
  background: 'rgba(41,181,204,0.12)',
  border: '1px solid rgba(41,181,204,0.3)',
  color: '#29B5CC',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}

const inactiveToggleStyle = {
  flex: 1, padding: '8px',
  background: 'var(--color-elevated)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
}
```

- [ ] **Step 4: Update `activeGridStyle` and `inactiveGridStyle`**

```js
const activeGridStyle = {
  padding: '8px',
  background: 'rgba(41,181,204,0.12)',
  border: '1px solid rgba(41,181,204,0.3)',
  color: '#29B5CC',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}

const inactiveGridStyle = {
  padding: '8px',
  background: 'var(--color-elevated)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
}
```

- [ ] **Step 5: Update `dividerStyle` and `fieldLabelStyle`**

```js
const dividerStyle = {
  height: '1px',
  background: 'var(--color-border)',
  margin: '0 0 24px',
}

const fieldLabelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text)',
  marginBottom: '6px',
}
```

- [ ] **Step 6: Update remaining inline hex in JSX**

In the JSX return:
- Logo upload button label: `rgba(255,255,255,0.04)` → `var(--color-elevated)`, `rgba(255,255,255,0.08)` → `var(--color-border)`, `#888` → `var(--color-muted)`
- Change password button: `rgba(255,255,255,0.04)` → `var(--color-elevated)`, `rgba(255,255,255,0.08)` → `var(--color-border)`, `#888` → `var(--color-muted)`
- Loading/error text: `#888` → `var(--color-muted)`, `#f87171` → `var(--color-danger)`, `#4ade80` → `var(--color-success)`
- Cancel link: `#666` → `var(--color-muted)`
- Logo description text: `#666` → `var(--color-muted)`

- [ ] **Step 7: Add ThemeToggle row in Preferences section**

In the JSX, in the Preferences section, after the weight unit `<div style={{ marginBottom: '20px' }}>` block and before the session frequency `<div style={{ marginBottom: '20px' }}>` block, insert:

```jsx
<div style={{ marginBottom: '20px' }}>
  <label style={fieldLabelStyle}>Theme</label>
  <div style={{ marginTop: '6px' }}>
    <ThemeToggle />
  </div>
</div>
```

- [ ] **Step 8: Verify**

Navigate to `/settings`. In dark mode: everything looks correct. Toggle ThemeToggle to Light — the entire app switches to Cool Slate. Toggle back — returns to dark. Reload — theme persists.

- [ ] **Step 9: Commit**

```bash
git add src/pages/therapist/Settings.jsx
git commit -m "feat: therapist Settings migrated to CSS vars + ThemeToggle row"
```

---

## Task 16: Therapist Onboarding — migrate + add ThemeToggle

**Files:**
- Modify: `src/pages/therapist/Onboarding.jsx`

- [ ] **Step 1: Add import**

```jsx
import ThemeToggle from '../../components/shared/ThemeToggle'
import ShimmerLine from '../../components/shared/ShimmerLine'
```

- [ ] **Step 2: Update all inline style constants**

```js
const inputStyle = {
  background: 'var(--color-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: '7px',
  color: 'var(--color-text)',
  padding: '9px 14px',
  width: '100%',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const activeToggleStyle = {
  flex: 1, padding: '8px',
  background: 'rgba(41,181,204,0.12)',
  border: '1px solid rgba(41,181,204,0.3)',
  color: '#29B5CC',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}

const inactiveToggleStyle = {
  flex: 1, padding: '8px',
  background: 'var(--color-elevated)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
}

const activeGridStyle = {
  padding: '8px',
  background: 'rgba(41,181,204,0.12)',
  border: '1px solid rgba(41,181,204,0.3)',
  color: '#29B5CC',
  borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}

const inactiveGridStyle = {
  padding: '8px',
  background: 'var(--color-elevated)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-muted)',
  borderRadius: '7px', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
}

const fieldLabelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text)',
  marginBottom: '6px',
}
```

- [ ] **Step 3: Migrate the onboarding card wrapper**

The card `<motion.div>` in the return currently has hardcoded styles. Replace:
```jsx
style={{
  width: '100%', maxWidth: '440px',
  background: 'var(--color-surface)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--color-border)',
  borderRadius: '16px',
  overflow: 'hidden', position: 'relative',
}}
```

And the outer wrapper:
```jsx
style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: '24px 16px' }}
```

- [ ] **Step 4: Replace inline shimmer div with `<ShimmerLine />`**

Find (line ~224):
```jsx
<div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)', position: 'absolute', top: 0, left: 0, right: 0 }} />
```

Replace with:
```jsx
<ShimmerLine />
```

- [ ] **Step 5: Update remaining inline hex in JSX**

- Title: `#e8edf5` → `var(--color-text)`
- Subtitle / helper text: `#666` → `var(--color-muted)`
- Logo upload label: `rgba(255,255,255,0.04)` → `var(--color-elevated)`, `rgba(255,255,255,0.08)` → `var(--color-border)`, `#888` → `var(--color-muted)`
- Error text: `#f87171` → `var(--color-danger)`
- Skip button: `#555` → `var(--color-subtle)`
- Custom days helper: `#888` → `var(--color-muted)`
- Loading check screen (`bg-dark-bg text-dark-muted`) — these Tailwind classes now work automatically via the CSS var bridge

- [ ] **Step 6: Add ThemeToggle field after weight unit section**

In the form, after the weight unit `<div>` block (after `</div>` that wraps `{['kg', 'lb'].map(...)}`) and before the default frequency `<div>`, insert:

```jsx
{/* Theme */}
<div>
  <label style={fieldLabelStyle}>Theme</label>
  <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 6px' }}>Change anytime in Settings</p>
  <ThemeToggle />
</div>
```

- [ ] **Step 7: Verify**

Navigate to `/onboarding` (or simulate by clearing `has_onboarded` in DB). ThemeToggle appears below weight unit. Toggling changes the entire page theme immediately.

- [ ] **Step 8: Commit**

```bash
git add src/pages/therapist/Onboarding.jsx
git commit -m "feat: Onboarding migrated to CSS vars + ThemeToggle field"
```

---

## Task 17: Client pages batch — Dashboard, SessionWizard, History, ProgressTab, SessionComplete, MyExercises

**Files:**
- Modify: `src/pages/client/Dashboard.jsx`
- Modify: `src/pages/client/SessionWizard.jsx`
- Modify: `src/pages/client/History.jsx`
- Modify: `src/pages/client/ProgressTab.jsx`
- Modify: `src/pages/client/SessionComplete.jsx`
- Modify: `src/pages/client/MyExercises.jsx`

- [ ] **Step 1: Add `ShimmerLine` import to Dashboard, SessionWizard, History**

```jsx
import ShimmerLine from '../../components/shared/ShimmerLine'
```

Remove `SHIMMER` from their styles imports.

- [ ] **Step 2: Replace all `<div style={SHIMMER} />` with `<ShimmerLine />`**

Dashboard: 1 usage (~113). SessionWizard: 4 usages (~244, ~279, ~375, ~592). History: 1 usage (~140).

- [ ] **Step 3: Apply token table to all inline hex styles in all six files**

Common patterns:
- Page background `#0e1117` → `var(--color-bg)`
- Text: `#f0f0f0` → `var(--color-text)`, `#888` → `var(--color-muted)`, `#555` → `var(--color-subtle)`
- Borders: `rgba(255,255,255,0.06)` or `rgba(255,255,255,0.08)` → `var(--color-border)`
- Inputs: `rgba(255,255,255,0.04)` bg → `var(--color-elevated)`, text `#e8edf5` → `var(--color-text)`
- Danger/success: `#f87171` → `var(--color-danger)`, `#4ade80` → `var(--color-success)`

- [ ] **Step 4: Verify**

Navigate to `/client`, `/client/sessions/:id`, `/client/history`. Dark mode correct, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/client/Dashboard.jsx src/pages/client/SessionWizard.jsx src/pages/client/History.jsx src/pages/client/ProgressTab.jsx src/pages/client/SessionComplete.jsx src/pages/client/MyExercises.jsx
git commit -m "feat: client pages use CSS vars + ShimmerLine"
```

---

## Task 18: Client Settings — migrate + add ThemeToggle

**Files:**
- Modify: `src/pages/client/Settings.jsx`

- [ ] **Step 1: Add `ThemeToggle` import**

```jsx
import ThemeToggle from '../../components/shared/ThemeToggle'
import ShimmerLine from '../../components/shared/ShimmerLine'
```

Remove `SHIMMER` from the styles import (keep `CARD`, `SECTION_LABEL`).

- [ ] **Step 2: Replace `<div style={SHIMMER} />` with `<ShimmerLine />`**

Two usages: line ~156 and ~217. Both become `<ShimmerLine />`.

- [ ] **Step 3: Update page wrapper**

Find:
```jsx
<div style={{ minHeight: '100vh', background: '#0e1117', paddingBottom: ... }}>
```

Replace `background: '#0e1117'` with `background: 'var(--color-bg)'`.

- [ ] **Step 4: Update inline hex in the Preferences card form**

- Weight unit inactive button: `background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.08)'` → `background: 'transparent', color: 'var(--color-muted)', border: '1px solid var(--color-border)'`
- Active weight button: keep (`background: '#29B5CC', color: '#000'` — unchanged)
- Clinic name label `#888` → `var(--color-muted)`
- Clinic name text `#f0f0f0` → `var(--color-text)`
- Error `#f87171` → `var(--color-danger)`, success `#4ade80` → `var(--color-success)`
- Password input: `rgba(255,255,255,0.04)` → `var(--color-elevated)`, `rgba(255,255,255,0.08)` → `var(--color-border)`, `#f0f0f0` → `var(--color-text)`
- Password label `#888` → `var(--color-muted)`
- Cancel button `#888` → `var(--color-muted)`
- Logout button border: `rgba(248,113,113,0.25)` stays (it's a transparent danger — fine), color `#f87171` → `var(--color-danger)`
- Logout confirm text `#888` → `var(--color-muted)`, cancel `#555` → `var(--color-subtle)`
- Divider before logout: `rgba(255,255,255,0.06)` → `var(--color-border)`
- Loading/error text: `#888` → `var(--color-muted)`, `#f87171` → `var(--color-danger)`

- [ ] **Step 5: Add ThemeToggle row in Preferences card**

In the Preferences card form, after the weight unit `<div>` (after the `{['kg','lb'].map(...)}` closing `</div>`) and before the `{clinicName && ...}` block, insert:

```jsx
<div style={{ marginBottom: '14px' }}>
  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>Theme</label>
  <ThemeToggle />
</div>
```

- [ ] **Step 6: Verify**

Navigate to `/client/settings`. ThemeToggle appears below weight unit. Toggle to light — entire client experience switches to Cool Slate. Reload — persists.

- [ ] **Step 7: Commit**

```bash
git add src/pages/client/Settings.jsx
git commit -m "feat: client Settings migrated to CSS vars + ShimmerLine + ThemeToggle"
```

---

## Task 19: Auth pages migration

**Files:**
- Modify: `src/pages/auth/Login.jsx`
- Modify: `src/pages/auth/Signup.jsx`
- Modify: `src/pages/auth/ForgotPassword.jsx`
- Modify: `src/pages/auth/ResetPassword.jsx`
- Modify: `src/pages/Join.jsx`

- [ ] **Step 1: Apply token table to all inline hex styles in all five files**

These pages are unauthenticated — `ThemeContext` defaults to the localStorage-cached theme (or dark if none). The migration just replaces hardcoded hex with CSS vars so they respond to the theme attribute correctly.

Common patterns in auth pages:
- Page/card background: `#0e1117` → `var(--color-bg)`, `#111111` → `var(--color-surface)`
- Input fields: `rgba(255,255,255,0.04)` → `var(--color-elevated)`, `rgba(255,255,255,0.08)` → `var(--color-border)`, `#e8edf5` or `#f0f0f0` → `var(--color-text)`
- Labels: `#888` → `var(--color-muted)`, `#666` → `var(--color-muted)`
- Error text: `#f87171` → `var(--color-danger)`
- Links: `#29B5CC` — keep as-is

- [ ] **Step 2: Verify**

Navigate to `/login`. Dark mode looks correct. Check no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/auth/Login.jsx src/pages/auth/Signup.jsx src/pages/auth/ForgotPassword.jsx src/pages/auth/ResetPassword.jsx src/pages/Join.jsx
git commit -m "feat: auth pages use CSS custom properties"
```

---

## Task 20: PrescriptionProgressSection + Chart components

**Files:**
- Modify: `src/components/progress/PrescriptionProgressSection.jsx`
- Modify: `src/components/progress/PainChart.jsx`
- Modify: `src/components/progress/VolumeChart.jsx`

- [ ] **Step 1: Migrate `PrescriptionProgressSection.jsx`**

Add import:
```jsx
import ShimmerLine from '../shared/ShimmerLine'
```

Remove `SHIMMER` from styles import. Replace `<div style={SHIMMER} />` with `<ShimmerLine />` (1 usage, line ~22).

Apply token table to any remaining inline hex.

- [ ] **Step 2: Migrate `PainChart.jsx`**

Add import at top:
```jsx
import { useTheme } from '../../context/ThemeContext'
```

Inside the component, add at the top of the function body:
```jsx
const { theme } = useTheme()
const chartColors = {
  accent: '#29B5CC',
  muted:  theme === 'dark' ? '#888888' : '#475569',
  grid:   theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
  text:   theme === 'dark' ? '#888888' : '#475569',
}
```

Replace hardcoded colour props on Recharts components:
- `stroke="#888888"` or similar on axes/grid → `stroke={chartColors.muted}`
- `stroke="rgba(255,255,255,0.06)"` on CartesianGrid → `stroke={chartColors.grid}`
- `stroke="#29B5CC"` lines → `stroke={chartColors.accent}` (or keep as literal — same value in both themes)
- `fill="#29B5CC"` areas → `fill={chartColors.accent}`
- Tick text colour props → `fill={chartColors.text}`

- [ ] **Step 3: Migrate `VolumeChart.jsx`**

Apply the same pattern as Step 2 for VolumeChart.

- [ ] **Step 4: Verify**

Navigate to a client progress view. In dark mode: charts look identical to before. Toggle to light mode — axis labels, grid lines, and tick text switch to the Cool Slate muted colour.

- [ ] **Step 5: Commit**

```bash
git add src/components/progress/PrescriptionProgressSection.jsx src/components/progress/PainChart.jsx src/components/progress/VolumeChart.jsx
git commit -m "feat: chart components use useTheme for theme-aware colours"
```

---

## Task 21: End-to-end verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify dark mode default**

Open `http://localhost:5173`. Inspect `<html>` in DevTools — no `data-theme` attribute. App appears in dark mode.

- [ ] **Step 3: Therapist toggle to light**

Log in as therapist. Navigate to `/settings`. Click "Light" in the Theme toggle. Confirm:
- `<html>` gains `data-theme="light"`
- Entire app switches to Cool Slate palette immediately
- Sidebar, PageHero, all cards update
- No `<ParticleBackground>` particles visible

- [ ] **Step 4: Persistence check**

Reload the page. App loads in light mode with no dark flash (localStorage read is synchronous). Open Network tab — confirm a PATCH/update to `users` table occurred.

- [ ] **Step 5: Client toggle to light**

Log in as client. Navigate to `/client/settings`. Click "Light" in Theme toggle. Confirm cool slate on client pages, BottomNav, SessionWizard.

- [ ] **Step 6: ShimmerLine hidden in light mode**

In light mode, inspect a card's top edge in DevTools. The `ShimmerLine` div should not be in the DOM (returns null). Cards should still have visible borders from `var(--color-border)`.

- [ ] **Step 7: Chart re-render**

Navigate to a progress view with charts. Toggle between dark and light. PainChart and VolumeChart axis/grid colours should update without page refresh.

- [ ] **Step 8: Onboarding toggle**

Create/simulate a new therapist account. Navigate to `/onboarding`. Confirm ThemeToggle appears below weight unit with "Change anytime in Settings" subtitle.

- [ ] **Step 9: Mobile check**

Resize to 375px width. In both themes: no horizontal scroll, nav readable, touch targets ≥ 44px.

- [ ] **Step 10: WCAG contrast spot-check (light mode)**

In light mode, open DevTools colour picker on body text — should be `#0f172a` on `#ffffff` background (19.1:1 ratio ✓). On muted text (`#475569` on `#ffffff`) = 5.9:1 ✓.

- [ ] **Step 11: HomePage unchanged**

Navigate to `/`. Confirm always dark (no theme toggle, no data-theme response).

- [ ] **Step 12: Final commit**

```bash
git add -A
git commit -m "feat: complete light/dark theme toggle — CSS vars, ThemeContext, DB persistence"
```
