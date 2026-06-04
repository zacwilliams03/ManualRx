# Therapist UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all therapist-side pages (Clients, Prescribe, SessionEdit, Templates, TemplateEdit, ExerciseLibrary, ExerciseUpload, ExerciseDetail, Settings, Onboarding) in line with the redesigned dashboard's design language: navy-blue base, hero zone with confined particles, glass cards with shimmer, and subtle Framer Motion entrance animations.

**Architecture:** One new shared `PageHero` component handles particles + title + CTA for every page. Shared style constants (CARD, SHIMMER, SECTION_LABEL) are extracted from Dashboard.jsx into `styles.js`. A single Tailwind config change (`dark.bg: #0a0a0a → #0e1117`) propagates the blue-tinted background globally. Pages are updated one at a time.

**Tech Stack:** React, Tailwind CSS, Framer Motion, Lucide React, existing `ParticleBackground` component

**Spec:** `docs/superpowers/specs/2026-05-26-therapist-ui-redesign.md`

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `tailwind.config.js` | `dark.bg` `#0a0a0a` → `#0e1117` |
| Create | `src/components/therapist/styles.js` | Shared CARD, SHIMMER, SECTION_LABEL constants |
| Modify | `src/pages/therapist/Dashboard.jsx` | Import CARD/SHIMMER/SECTION_LABEL from styles.js |
| Create | `src/components/therapist/PageHero.jsx` | Shared hero zone component |
| Modify | `src/pages/therapist/Clients.jsx` | Add PageHero, glass card list |
| Modify | `src/pages/therapist/Templates.jsx` | Add PageHero, glass card list |
| Modify | `src/pages/therapist/ExerciseLibrary.jsx` | Add PageHero, glass card list |
| Modify | `src/pages/therapist/ExerciseUpload.jsx` | Add PageHero, glass card form |
| Modify | `src/pages/therapist/ExerciseDetail.jsx` | Add PageHero, glass card content |
| Modify | `src/pages/therapist/Prescribe.jsx` | Add PageHero, glass cards, styled tabs |
| Modify | `src/pages/therapist/SessionEdit.jsx` | Add PageHero, glass card form |
| Modify | `src/pages/therapist/TemplateEdit.jsx` | Add PageHero, glass card form |
| Modify | `src/pages/therapist/Settings.jsx` | Add PageHero, form section treatment |
| Modify | `src/pages/therapist/Onboarding.jsx` | Restyle centered card (no SidebarLayout — standalone page) |

---

## Task 1: Global background + shared style constants

**Files:**
- Modify: `tailwind.config.js`
- Create: `src/components/therapist/styles.js`
- Modify: `src/pages/therapist/Dashboard.jsx` (lines 13–36, the local constants)

- [ ] **Step 1: Update `dark.bg` in Tailwind config**

In `tailwind.config.js`, change `dark.bg` from `#0a0a0a` to `#0e1117`:

```js
dark: {
  bg:          '#0e1117',   // was #0a0a0a — matches sidebar colour
  surface:     '#111111',
  elevated:    '#1a1a1a',
  border:      'rgba(255,255,255,0.06)',
  text:        '#f0f0f0',
  muted:       '#888888',
  subtle:      '#555555',
  accent:      '#29B5CC',
  'accent-bg': 'rgba(41,181,204,0.10)',
},
```

- [ ] **Step 2: Create `src/components/therapist/styles.js`**

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
  top: 0,
  left: 0,
  right: 0,
}

export const SECTION_LABEL = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#888888',
}
```

- [ ] **Step 3: Update Dashboard.jsx to import from styles.js**

In `src/pages/therapist/Dashboard.jsx`, remove the three local constant blocks (CARD, SHIMMER, SECTION_LABEL at lines 13–36) and replace with:

```js
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [ ] **Step 4: Run dev server and verify dashboard is unchanged**

```bash
npm run dev
```

Visit `http://localhost:5173/therapist`. Dashboard should look identical — glass cards, shimmer, section labels unchanged. The only visual change is the `bg-dark-bg` areas are now `#0e1117` instead of `#0a0a0a` (barely perceptible).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/components/therapist/styles.js src/pages/therapist/Dashboard.jsx
git commit -m "refactor: extract shared card styles, update dark.bg to #0e1117"
```

---

## Task 2: PageHero shared component

**Files:**
- Create: `src/components/therapist/PageHero.jsx`

- [ ] **Step 1: Create `src/components/therapist/PageHero.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ParticleBackground from '../ParticleBackground'

/**
 * Props:
 *   title       {string}    required — page or context title
 *   subtitle    {string}    optional — muted line below title
 *   back        {{ label: string, to: string }} optional — breadcrumb rendered above title
 *   actions     {ReactNode} optional — right-side buttons/CTAs
 */
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
      {/* Confined particle background — position="absolute" keeps it inside this wrapper */}
      <ParticleBackground position="absolute" particleCount={60} spawnFromTop />

      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 75% 60%, rgba(41,181,204,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content sits above canvas (z-index) */}
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

- [ ] **Step 2: Verify the component renders without errors**

No visual test yet — it's used in Task 3. Check no TypeScript/lint errors via:

```bash
npm run dev
```

Console should be clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/PageHero.jsx
git commit -m "feat: add shared PageHero component with confined particles"
```

---

## Task 3: Clients page

**Files:**
- Modify: `src/pages/therapist/Clients.jsx`

The Clients page currently renders a plain `<h1>` + a `therapistSince` stat line ("N patients treated since DATE") above a bordered `<ul>`. The new design drops the `therapistSince` stat in favour of the active/inactive count in the PageHero subtitle — the `fetchTherapistSince` function and `therapistSince` state can be removed entirely. The existing `renderClientRow` helper function is also replaced by inline motion.div rows — remove the `renderClientRow` function after replacing the return block (it will be dead code otherwise). All other data logic (fetchClients, handleSubmit, toggleActive, deleteClient, modal) is unchanged.

- [ ] **Step 1: Add imports**

At the top of `Clients.jsx`, add:

```js
import { motion } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [ ] **Step 2: Replace the return() block**

Replace the entire `return (` block (currently starts at line 213) with the following. All state/logic above the return is kept exactly as-is:

```jsx
return (
  <SidebarLayout>
    {/* Hero zone */}
    <PageHero
      title="Clients"
      subtitle={
        listLoading
          ? null
          : `${activeClients.length} active${inactiveClients.length > 0 ? ` · ${inactiveClients.length} inactive` : ''}`
      }
      actions={
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '9px 18px',
            background: '#29B5CC',
            color: '#000',
            border: 'none',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Client
        </button>
      }
    />

    {/* Page content */}
    <div style={{ padding: '24px 32px', maxWidth: '860px' }}>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search clients…"
        style={{
          width: '100%',
          maxWidth: '320px',
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '7px',
          color: '#e8edf5',
          fontSize: '13px',
          marginBottom: '20px',
          outline: 'none',
        }}
      />

      {listLoading && <p style={{ fontSize: '13px', color: '#666' }}>Loading…</p>}
      {listError && <p style={{ fontSize: '13px', color: '#f87171' }}>{listError}</p>}

      {!listLoading && !listError && (() => {
        const rows = searchResults !== null ? searchResults : activeClients
        const showSearch = searchResults !== null

        return (
          <>
            {rows.length === 0 && (
              <p style={{ fontSize: '13px', color: '#666' }}>
                {showSearch ? 'No clients match your search.' : 'No clients yet.'}
              </p>
            )}

            {rows.length > 0 && (
              <div style={{ ...CARD, padding: 0, marginBottom: '12px' }}>
                <div style={SHIMMER} />
                {!showSearch && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={SECTION_LABEL}>Active Clients</span>
                  </div>
                )}
                {rows.map((client, i) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: client.is_active ? 'rgba(41,181,204,0.15)' : 'rgba(61,79,106,0.3)',
                          border: client.is_active ? '1px solid rgba(41,181,204,0.2)' : '1px solid rgba(255,255,255,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: client.is_active ? '#29B5CC' : '#888',
                          flexShrink: 0,
                        }}
                      >
                        {client.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>{client.name}</div>
                        <div style={{ fontSize: '12px', color: '#555', marginTop: '1px' }}>{client.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Link
                        to={`/therapist/prescribe/${client.id}`}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          border: '1px solid rgba(41,181,204,0.3)',
                          borderRadius: '6px',
                          color: '#29B5CC',
                          textDecoration: 'none',
                        }}
                      >
                        View
                      </Link>
                      <button
                        onClick={() => toggleActive(client)}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          background: 'transparent',
                          color: '#666',
                          cursor: 'pointer',
                        }}
                      >
                        {client.is_active ? 'Mark inactive' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => deleteClient(client)}
                        style={{
                          fontSize: '12px',
                          padding: '5px 12px',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: '6px',
                          background: 'transparent',
                          color: '#f87171',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Inactive clients toggle (when not in search mode) */}
            {!showSearch && inactiveClients.length > 0 && (
              <>
                <button
                  onClick={() => setShowInactive(v => !v)}
                  style={{ fontSize: '13px', color: '#555', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginBottom: '12px' }}
                >
                  {showInactive ? 'Hide inactive clients' : `Show inactive clients (${inactiveClients.length})`}
                </button>
                {showInactive && (
                  <div style={{ ...CARD, padding: 0 }}>
                    <div style={SHIMMER} />
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={SECTION_LABEL}>Inactive</span>
                    </div>
                    {inactiveClients.map((client, i) => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 20px',
                          opacity: 0.6,
                          borderBottom: i < inactiveClients.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '34px', height: '34px', borderRadius: '50%',
                              background: 'rgba(61,79,106,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: 700, color: '#888', flexShrink: 0,
                            }}
                          >
                            {client.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>{client.name}</div>
                            <div style={{ fontSize: '12px', color: '#555', marginTop: '1px' }}>{client.email}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => toggleActive(client)}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', background: 'transparent', color: '#666', cursor: 'pointer' }}
                          >
                            Reactivate
                          </button>
                          <button
                            onClick={() => deleteClient(client)}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: '#f87171', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )
      })()}
    </div>

    {/* Add Client Modal — unchanged from original */}
    {showModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        onClick={e => { if (e.target === e.currentTarget && !submitLoading) closeModal() }}
      >
        <div className="w-full max-w-md overflow-hidden rounded-xl bg-dark-surface border border-dark-border shadow-xl">
          <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
            <h2 className="text-sm font-semibold text-dark-text">Add client</h2>
            <button onClick={closeModal} disabled={submitLoading} className="text-lg text-dark-muted hover:text-dark-text disabled:opacity-50 cursor-pointer transition-colors duration-150">×</button>
          </div>
          {!lastInvite ? (
            <>
              <form onSubmit={handleSubmit} id="add-client-form" className="space-y-3 px-5 py-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="mt-1 block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none" />
                </div>
                {formError && <p className="text-sm text-red-400">{formError}</p>}
              </form>
              <div className="flex justify-end gap-2 border-t border-dark-border px-5 py-4">
                <button type="button" onClick={closeModal} disabled={submitLoading}
                  className="rounded border border-dark-border px-4 py-2 text-sm text-dark-muted hover:bg-dark-elevated disabled:opacity-50 cursor-pointer transition-colors duration-150">Cancel</button>
                <button type="submit" form="add-client-form" disabled={submitLoading}
                  className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer">
                  {submitLoading ? 'Adding…' : 'Add client'}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4 px-5 py-4">
              {lastInvite.emailSent ? (
                <div className="rounded border border-green-800/30 bg-green-900/20 p-4">
                  <p className="text-sm font-medium text-green-400">Invite sent to {lastInvite.email}</p>
                  <p className="mt-3 text-sm text-dark-muted">Didn't arrive?{' '}
                    <button onClick={copyLink} className="text-green-400 underline cursor-pointer">{copied ? 'Copied!' : 'Copy link'}</button>
                  </p>
                </div>
              ) : (
                <div className="rounded border border-amber-800/30 bg-amber-900/20 p-4">
                  <p className="text-sm font-medium text-amber-400">Couldn't send email — share this link manually:</p>
                  <p className="mt-1 break-all font-mono text-sm text-amber-400/80">{window.location.origin}/join/{lastInvite.code}</p>
                  <button onClick={copyLink} className="mt-2 rounded border border-amber-800/40 bg-dark-elevated px-3 py-1 text-sm text-amber-400 hover:bg-amber-900/30 cursor-pointer transition-colors duration-150">
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={closeModal} className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark cursor-pointer">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </SidebarLayout>
)
```

- [ ] **Step 3: Visual verification**

```bash
npm run dev
```

Visit `/therapist/clients`. Verify:
- Hero zone visible with particles and cyan glow, title "Clients" in large bold text, "+ Add Client" button right
- `#0e1117` background matches sidebar (no seam)
- Client rows in glass card with shimmer line at top, cyan initials avatar for active clients
- Rows fade+slide in staggered on load
- Inactive toggle still works, modal still opens/submits correctly

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/Clients.jsx
git commit -m "feat: redesign Clients page with PageHero and glass card list"
```

---

## Task 4: Templates page

**Files:**
- Modify: `src/pages/therapist/Templates.jsx`

- [ ] **Step 1: Add imports to Templates.jsx**

```js
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [ ] **Step 2: Replace the page header section in the return() block**

Read the current `Templates.jsx` to find the existing `<h1>` / title block and the outer container div. Replace the pattern:

```jsx
// REMOVE this kind of header pattern (exact text varies):
<div className="max-w-... mx-auto px-6 py-8">
  <h1 className="text-2xl ...">Templates</h1>
  ...header content...
```

With:

```jsx
<SidebarLayout>
  <PageHero
    title="Templates"
    subtitle={templates.length > 0 ? `${templates.length} template${templates.length !== 1 ? 's' : ''}` : null}
    actions={
      <Link
        to="/therapist/templates/new"
        style={{
          padding: '9px 18px',
          background: '#29B5CC',
          color: '#000',
          borderRadius: '7px',
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        + New Template
      </Link>
    }
  />

  <div style={{ padding: '24px 32px', maxWidth: '860px' }}>
    {/* Search input */}
    <input
      type="text"
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="Search templates…"
      style={{
        width: '100%', maxWidth: '320px', padding: '8px 14px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', marginBottom: '12px',
      }}
    />

    {/* Category filter pills — keep existing category logic, restyle pills */}
    {/* Active pill: background rgba(41,181,204,0.12), border rgba(41,181,204,0.3), color #29B5CC */}
    {/* Inactive pill: background rgba(255,255,255,0.04), border rgba(255,255,255,0.08), color #666 */}
    {/* Render existing categories array with the above inline styles */}

    {/* Template list glass card */}
    {filteredTemplates.length > 0 && (
      <div style={{ ...CARD, padding: 0, marginTop: '16px' }}>
        <div style={SHIMMER} />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={SECTION_LABEL}>Templates</span>
        </div>
        {filteredTemplates.map((template, i) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: i < filteredTemplates.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>{template.name}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                {template.category && (
                  <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>
                    {template.category}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: '#555' }}>
                  {template.exercises?.length ?? 0} exercise{template.exercises?.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link
                to={`/therapist/templates/${template.id}`}
                style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', textDecoration: 'none' }}
              >
                Edit
              </Link>
              <button
                onClick={() => deleteTemplate(template.id)}
                style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: '#f87171', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    )}

    {filteredTemplates.length === 0 && (
      <p style={{ fontSize: '13px', color: '#666', marginTop: '16px' }}>No templates found.</p>
    )}
  </div>
</SidebarLayout>
```

> Note: Read the current `Templates.jsx` before editing to identify the exact variable names for the filtered template list and category state. Keep all existing filter/search logic intact — only the JSX structure changes.

- [ ] **Step 3: Visual verification**

Visit `/therapist/templates`. Verify:
- PageHero with "Templates" title + "+ New Template" CTA
- Category filter pills render with cyan active state
- Templates in glass card with shimmer, category badges, staggered fade-in
- Edit navigates to template editor, Delete still works

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/Templates.jsx
git commit -m "feat: redesign Templates page with PageHero and glass card list"
```

---

## Task 5: Exercise Library

**Files:**
- Modify: `src/pages/therapist/ExerciseLibrary.jsx`

- [ ] **Step 1: Add imports**

```js
import { motion } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [ ] **Step 2: Replace header + list in return() block**

Replace the existing page header and exercise list container. Keep all existing pagination, filter, and fetch logic unchanged:

```jsx
<SidebarLayout>
  <PageHero
    title="Exercise Library"
    subtitle={totalCount > 0 ? `${totalCount} exercise${totalCount !== 1 ? 's' : ''}` : null}
    actions={
      <Link
        to="/therapist/exercises/new"
        style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', borderRadius: '7px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
      >
        + Add Exercise
      </Link>
    }
  />

  <div style={{ padding: '24px 32px', maxWidth: '860px' }}>
    {/* Search input */}
    <input
      type="text" value={search} onChange={e => setSearch(e.target.value)}
      placeholder="Search exercises…"
      style={{ width: '100%', maxWidth: '320px', padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', marginBottom: '12px' }}
    />

    {/* Category filter pills — restyle same as Templates (active: cyan, inactive: muted) */}

    {/* Exercise list glass card */}
    {pagedExercises.length > 0 && (
      <div style={{ ...CARD, padding: 0, marginTop: '16px' }}>
        <div style={SHIMMER} />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={SECTION_LABEL}>Exercises</span>
        </div>
        {pagedExercises.map((ex, i) => (
          <motion.div
            key={ex.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 20px',
              borderBottom: i < pagedExercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div>
              <Link
                to={`/therapist/exercises/${ex.id}`}
                style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5', textDecoration: 'none' }}
              >
                {ex.name}
              </Link>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                {(ex.categories ?? []).map(cat => (
                  <span key={cat} style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>
                    {cat}
                  </span>
                ))}
                {ex.video_url && (
                  <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                    Video
                  </span>
                )}
              </div>
            </div>
            {ex.therapist_id && (
              <button
                onClick={() => deleteExercise(ex.id)}
                style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: '#f87171', cursor: 'pointer' }}
              >
                Delete
              </button>
            )}
          </motion.div>
        ))}
      </div>
    )}

    {/* Pagination — keep existing logic, restyle buttons */}
    {totalPages > 1 && (
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: page === 1 ? '#444' : '#888', fontSize: '13px', cursor: page === 1 ? 'default' : 'pointer' }}
        >
          Previous
        </button>
        <span style={{ padding: '6px 8px', fontSize: '13px', color: '#555' }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: page === totalPages ? '#444' : '#888', fontSize: '13px', cursor: page === totalPages ? 'default' : 'pointer' }}
        >
          Next
        </button>
      </div>
    )}
  </div>
</SidebarLayout>
```

> Read `ExerciseLibrary.jsx` before editing to identify the exact variable names for `pagedExercises`, `totalPages`, `page`, `deleteExercise`, and the category filter array.

- [ ] **Step 3: Visual verification**

Visit `/therapist/exercises`. Verify: PageHero, glass card list, category pills, pagination, delete button on custom exercises only, exercise name links to detail page.

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/ExerciseLibrary.jsx
git commit -m "feat: redesign Exercise Library with PageHero and glass card list"
```

---

## Task 6: Exercise Upload + Exercise Detail

**Files:**
- Modify: `src/pages/therapist/ExerciseUpload.jsx`
- Modify: `src/pages/therapist/ExerciseDetail.jsx`

These are simpler pages (single glass card containing a form or detail content).

- [ ] **Step 1: Add imports to both files**

```js
import { motion } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'
```

- [ ] **Step 2: Redesign ExerciseUpload.jsx return() block**

Replace the existing header + form container:

```jsx
<SidebarLayout>
  <PageHero
    title="New Exercise"
    back={{ label: 'Exercise Library', to: '/therapist/exercises' }}
    actions={
      <button
        type="submit" form="exercise-upload-form" disabled={submitting}
        style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? 'Saving…' : 'Save Exercise'}
      </button>
    }
  />

  <div style={{ padding: '24px 32px', maxWidth: '600px' }}>
    <div style={{ ...CARD }}>
      <div style={SHIMMER} />
      <form id="exercise-upload-form" onSubmit={handleSubmit}>
        {/* Keep ALL existing form fields exactly as-is — only restyle inputs */}
        {/* Input style: background rgba(255,255,255,0.05), border 1px solid rgba(255,255,255,0.1), borderRadius 7px, color #e8edf5, padding 8px 14px */}
        {/* Labels: fontSize 12px, color #888, marginBottom 6px */}
        {/* Retain all existing state, handlers, video upload progress logic */}
      </form>
    </div>
  </div>
</SidebarLayout>
```

> Read `ExerciseUpload.jsx` before editing. Keep the entire form structure inside the glass card — only update the outer layout and input styling.

- [ ] **Step 3: Redesign ExerciseDetail.jsx return() block**

```jsx
<SidebarLayout>
  <PageHero
    title={exercise?.name ?? '…'}
    back={{ label: 'Exercise Library', to: '/therapist/exercises' }}
    actions={
      exercise?.therapist_id ? (
        <button
          onClick={handleDelete}
          style={{ padding: '9px 18px', background: 'transparent', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Delete
        </button>
      ) : null
    }
  />

  <div style={{ padding: '24px 32px', maxWidth: '600px' }}>
    {loading && <p style={{ fontSize: '13px', color: '#666' }}>Loading…</p>}
    {exercise && (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ ...CARD }}
      >
        <div style={SHIMMER} />

        {/* Category badges */}
        {(exercise.categories ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {exercise.categories.map(cat => (
              <span key={cat} style={{ fontSize: '11px', padding: '3px 9px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {exercise.description && (
          <p style={{ fontSize: '14px', color: '#aaa', lineHeight: 1.6, marginBottom: '20px' }}>{exercise.description}</p>
        )}

        {/* Video player — keep existing YouTube/HTML5 logic unchanged */}
        {/* Keep all existing video rendering code here */}
      </motion.div>
    )}
  </div>
</SidebarLayout>
```

> Read `ExerciseDetail.jsx` before editing to get exact variable names (`exercise`, `loading`, `handleDelete`) and video rendering code.

- [ ] **Step 4: Visual verification**

Visit `/therapist/exercises/new` — verify PageHero with back breadcrumb, form inside glass card, Save button in hero.
Visit a custom exercise detail — verify PageHero with exercise name, red Delete button, content in glass card.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/ExerciseUpload.jsx src/pages/therapist/ExerciseDetail.jsx
git commit -m "feat: redesign ExerciseUpload and ExerciseDetail with PageHero"
```

---

## Task 7: Prescribe page

**Files:**
- Modify: `src/pages/therapist/Prescribe.jsx`

This is the most complex page. Key facts from the actual file:
- Tab state: `activeTab` with values `'prescriptions'`, `'history'`, `'clientData'` (defined in `TAB_LABELS` const at top)
- Session list: `sortedSessions` (active-first sorted array), not `sessions`
- Exercise count: `s.prescription_exercises[0]?.count` — query returns a count aggregate, NOT individual exercise rows
- Per-prescription PDF: `downloadPDF(s)` already exists and is functional — keep it on each card
- Global Export PDF (hero): placeholder for future "print all sessions" feature
- Apply Template: `setShowApplyModal(true)` — keep this button
- New session: `createSession()` — navigates to a new blank SessionEdit
- Inactive: `isActive(s)` boolean, `reactivatePrescription(s)` function
- Delete: `deleteSession(id, name)` function
- Tab switch must also call `setExpandedLogId(null)`

- [ ] **Step 1: Add imports**

```js
import { motion, AnimatePresence } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [ ] **Step 2: Replace the return() block header and tab section**

Replace everything from `return (` through the closing `</SidebarLayout>`. Keep the loading early-return (`if (loading) { return ... }`) unchanged above it. The new structure:

```jsx
return (
  <SidebarLayout>
    {/* Hero zone */}
    <PageHero
      title={client?.name ?? '…'}
      subtitle={client?.email ?? null}
      back={{ label: 'Clients', to: '/therapist/clients' }}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Global Export PDF — placeholder for future "print all sessions" feature */}
          <button
            onClick={() => {}}
            style={{ padding: '8px 14px', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}
          >
            Export PDF
          </button>
          {activeTab === 'prescriptions' && (
            <>
              <button
                onClick={() => setShowApplyModal(true)}
                style={{ padding: '8px 14px', background: 'transparent', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' }}
              >
                Apply Template
              </button>
              <button
                onClick={createSession}
                disabled={creating}
                style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}
              >
                {creating ? 'Creating…' : 'New session'}
              </button>
            </>
          )}
        </div>
      }
    />

    {/* Tabs — flush below hero border */}
    <div style={{ display: 'flex', padding: '0 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {(['prescriptions', 'history', 'clientData']).map(tab => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); setExpandedLogId(null) }}
          style={{
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? '#29B5CC' : '#555',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === tab ? '2px solid #29B5CC' : '2px solid transparent',
            cursor: 'pointer',
            marginBottom: '-1px',
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>

    {error && <p style={{ padding: '16px 32px', fontSize: '13px', color: '#f87171' }}>{error}</p>}

    {/* Tab content */}
    <div style={{ padding: '24px 32px' }}>
      <AnimatePresence mode="wait">

        {/* ── Prescribed Sessions ── */}
        {activeTab === 'prescriptions' && (
          <motion.div
            key="prescriptions"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {sessions.length === 0 && (
              <p style={{ fontSize: '13px', color: '#666' }}>No sessions yet. Create the first one.</p>
            )}
            {sortedSessions.map((s, i) => {
              const active = isActive(s)
              const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
              const expected = expectedSessions(s)

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                  style={{
                    ...CARD,
                    padding: 0,
                    marginBottom: '14px',
                    opacity: active ? 1 : 0.55,
                  }}
                >
                  <div style={SHIMMER} />
                  {/* Prescription header */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#e8edf5' }}>{s.name}</span>
                        {!active && (
                          <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(255,255,255,0.06)', color: '#888', borderRadius: '4px' }}>Inactive</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                        {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                      </p>
                      {active && s.duration_weeks && s.start_date && (
                        <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                          Active until {formatExpiryDate(s.start_date, s.duration_weeks)}
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                        {expected != null
                          ? `${completedCount} / ${expected} sessions completed`
                          : `${completedCount} session${completedCount !== 1 ? 's' : ''} completed`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!active && (
                          <button
                            onClick={() => reactivatePrescription(s)}
                            disabled={reactivating === s.id}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', background: 'transparent', cursor: 'pointer', opacity: reactivating === s.id ? 0.6 : 1 }}
                          >
                            {reactivating === s.id ? 'Copying…' : 'Reactivate'}
                          </button>
                        )}
                        <button
                          onClick={() => downloadPDF(s)}
                          disabled={pdfLoadingId === s.id}
                          style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#666', background: 'transparent', cursor: 'pointer', opacity: pdfLoadingId === s.id ? 0.6 : 1 }}
                        >
                          {pdfLoadingId === s.id ? 'Generating…' : 'PDF'}
                        </button>
                        <Link
                          to={`/therapist/prescribe/${clientId}/sessions/${s.id}`}
                          style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#888', textDecoration: 'none' }}
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => deleteSession(s.id, s.name)}
                          style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', background: 'transparent', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                      {pdfError === s.id && (
                        <span style={{ fontSize: '11px', color: '#f87171' }}>PDF failed</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* ── Session History ── */}
        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {historyTabLoading && <p style={{ fontSize: '13px', color: '#666' }}>Loading history…</p>}
            {!historyTabLoading && historyTabLogs.length === 0 && (
              <p style={{ fontSize: '13px', color: '#666' }}>No completed sessions yet.</p>
            )}
            {historyTabLogs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                style={{ ...CARD, padding: 0, marginBottom: '12px' }}
              >
                <div style={SHIMMER} />
                {/* Log header — click to expand, same as existing expandedLogId logic */}
                <button
                  onClick={() => setExpandedLogId(prev => prev === log.id ? null : log.id)}
                  style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>
                      {log.prescriptions?.name ?? 'Session'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555', marginTop: '3px' }}>
                      {new Date(log.completed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {log.session_rpe != null ? ` · RPE ${log.session_rpe}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#555' }}>{expandedLogId === log.id ? '▲' : '▼'}</span>
                </button>
                {expandedLogId === log.id && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {(log.exercise_logs ?? []).map(el => (
                      <div key={el.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <ExerciseLogDetail
                          el={el}
                          videoUrls={videoUrls}
                          onPlayVideo={playVideo}
                          weightUnit={weightUnit}
                        />
                      </div>
                    ))}
                    {log.session_notes && (
                      <div style={{ padding: '10px 20px', fontSize: '12px', color: '#666' }}>
                        Note: {log.session_notes}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Client Data ── */}
        {activeTab === 'clientData' && (
          <motion.div key="clientData" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ClientDataTab clientId={clientId} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>

    {/* Apply Template modal — unchanged */}
    <ApplyTemplateModal
      open={showApplyModal}
      onClose={() => setShowApplyModal(false)}
      clientId={clientId}
      therapistId={profile?.id}
      onApplied={fetchData}
    />
  </SidebarLayout>
)
```

- [ ] **Step 3: Visual verification**

Visit `/therapist/prescribe/:clientId`. Verify:
- PageHero shows client name + email, "← Clients" breadcrumb
- "Export PDF" placeholder button (does nothing), "Apply Template" + "New session" show only on prescriptions tab
- Tabs render with correct labels ("Prescribed Sessions", "Session History", "Client Data") and cyan active underline
- Prescription cards show name, exercise count, frequency, completed/expected sessions
- Each card has PDF, Edit, Delete buttons; inactive cards show Reactivate
- Switching tabs triggers fade transition and resets expandedLogId
- History tab lazy-loads on first visit; log rows expand to show exercise detail
- Apply Template modal still opens

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx
git commit -m "feat: redesign Prescribe page with PageHero, styled tabs, and glass prescription cards"
```

---

## Task 8: SessionEdit + TemplateEdit

**Files:**
- Modify: `src/pages/therapist/SessionEdit.jsx`
- Modify: `src/pages/therapist/TemplateEdit.jsx`

Both are form pages with an exercise list. Same pattern: PageHero with back + Save CTA, form fields in a glass card, exercise list in a second glass card.

- [ ] **Step 1: Add imports to both files**

```js
import { motion } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
```

- [ ] **Step 2: Read both files before editing**

Read `SessionEdit.jsx` and `TemplateEdit.jsx` to identify:
- The session/template name variable
- The clientId / client name variable (SessionEdit only)
- The save handler function name
- The exercise list array name and structure

- [ ] **Step 3: Apply PageHero to SessionEdit.jsx**

Replace the existing header in the return() block:

```jsx
<SidebarLayout>
  <PageHero
    title={sessionName || 'Edit Session'}
    back={{ label: clientName || 'Client', to: `/therapist/prescribe/${clientId}` }}
    actions={
      <button
        onClick={handleSave} disabled={saving}
        style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    }
  />

  <div style={{ padding: '24px 32px', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Session details glass card */}
    <div style={{ ...CARD }}>
      <div style={SHIMMER} />
      <div style={{ marginBottom: '16px' }}>
        <span style={SECTION_LABEL}>Session Details</span>
      </div>
      {/* Keep all existing form fields: name, frequency_days, start_date, duration_weeks */}
      {/* Restyle inputs: background rgba(255,255,255,0.05), border 1px solid rgba(255,255,255,0.1), borderRadius 7px */}
    </div>

    {/* Exercise list glass card */}
    <div style={{ ...CARD, padding: 0 }}>
      <div style={SHIMMER} />
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={SECTION_LABEL}>Exercises</span>
      </div>
      {/* Keep all existing exercise add/edit/remove logic and inline editing UI */}
      {/* Each exercise row: padding 13px 20px, borderBottom 1px solid rgba(255,255,255,0.04) */}
    </div>
  </div>
</SidebarLayout>
```

- [ ] **Step 4: Apply PageHero to TemplateEdit.jsx**

```jsx
<SidebarLayout>
  <PageHero
    title={templateName || 'New Template'}
    back={{ label: 'Templates', to: '/therapist/templates' }}
    actions={
      <button
        onClick={handleSave} disabled={saving}
        style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    }
  />

  <div style={{ padding: '24px 32px', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Template details glass card */}
    <div style={{ ...CARD }}>
      <div style={SHIMMER} />
      <div style={{ marginBottom: '16px' }}><span style={SECTION_LABEL}>Template Details</span></div>
      {/* Keep existing: name, category autocomplete, duration_weeks selector */}
    </div>

    {/* Exercise list glass card */}
    <div style={{ ...CARD, padding: 0 }}>
      <div style={SHIMMER} />
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={SECTION_LABEL}>Exercises</span>
      </div>
      {/* Keep all existing exercise list + add exercise UI */}
    </div>
  </div>
</SidebarLayout>
```

- [ ] **Step 5: Visual verification**

Visit a session edit page and a template edit page. Verify: PageHero with correct title + back breadcrumb + Save button, form fields in glass card, exercise list in second glass card, save still works.

- [ ] **Step 6: Commit**

```bash
git add src/pages/therapist/SessionEdit.jsx src/pages/therapist/TemplateEdit.jsx
git commit -m "feat: redesign SessionEdit and TemplateEdit with PageHero and glass card forms"
```

---

## Task 9: Settings + Onboarding (lighter treatment)

**Files:**
- Modify: `src/pages/therapist/Settings.jsx`
- Modify: `src/pages/therapist/Onboarding.jsx`

Settings gets PageHero + form sections (no glass cards). Onboarding is a standalone full-screen centered card with NO SidebarLayout — gets a glass card redesign matching the dark palette, not PageHero.

- [ ] **Step 1: Add imports to both files**

```js
import { motion } from 'framer-motion'
import PageHero from '../../components/therapist/PageHero'
```

- [ ] **Step 2: Redesign Settings.jsx return() block**

```jsx
<SidebarLayout>
  <PageHero
    title="Settings"
    subtitle="Clinic preferences and account"
  />

  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    style={{ padding: '24px 32px', maxWidth: '520px' }}
  >
    {/* Section: Clinic */}
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
        Clinic
      </div>
      {/* Keep existing: clinic name input, logo upload — restyle inputs */}
      {/* Input style: background rgba(255,255,255,0.04), border 1px solid rgba(255,255,255,0.08), borderRadius 7px, color #e8edf5, padding 9px 14px */}
    </div>

    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '24px' }} />

    {/* Section: Preferences */}
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
        Preferences
      </div>
      {/* Keep existing: weight unit toggle, default frequency selector */}
      {/* Active toggle button: background #29B5CC, color #000 */}
      {/* Inactive toggle button: background rgba(255,255,255,0.04), border rgba(255,255,255,0.08), color #666 */}
    </div>

    <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '24px' }} />

    {/* Section: Account */}
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
        Account
      </div>
      {/* Keep existing: change password form */}
    </div>

    {/* Save button */}
    <button
      onClick={handleSave}
      style={{ padding: '9px 24px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
    >
      Save changes
    </button>
    {saved && <span style={{ fontSize: '13px', color: '#4ade80', marginLeft: '12px' }}>Saved</span>}
  </motion.div>
</SidebarLayout>
```

> Read `Settings.jsx` before editing — identify variable names for clinic name, weight unit, frequency, logo, handleSave, saved state.

- [ ] **Step 3: Redesign Onboarding.jsx return() block**

**Important:** `Onboarding.jsx` is a standalone full-screen centered card — it has NO `SidebarLayout`. The actual file is at `src/pages/therapist/Onboarding.jsx` (not `src/pages/Onboarding.jsx`). Do NOT add a sidebar. The existing structure is `<div className="min-h-screen flex items-center justify-center bg-dark-bg">` wrapping a `max-w-md` card. Keep this structure, update the card styling to match the dark design.

Known variable names from the file: `handleSave` (form `onSubmit`), `handleSkip` (button `onClick`), `loading` (submit state), `error` (form error), `clinicName`/`setClinicName`, `weightUnit`/`setWeightUnit`, `logoUrl`, `logoUploading`, `handleLogoUpload`.

Replace the `return (` block (the non-checking version only — keep `if (checking) { return ... }` unchanged):

```jsx
return (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0e1117',
      padding: '24px 16px',
    }}
  >
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(13,17,23,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(100,160,255,0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Shimmer top line */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)', position: 'absolute', top: 0, left: 0, right: 0 }} />

      <div style={{ padding: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e8edf5', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Welcome to ManualRx
        </h1>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 28px' }}>
          Let's get you set up. Takes 30 seconds — change anything later in Settings.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Keep all existing form fields (logo, clinic name, weight unit, frequency) */}
          {/* Restyle inputs: background rgba(255,255,255,0.05), border 1px solid rgba(255,255,255,0.1), borderRadius 7px, color #e8edf5, padding 9px 14px, fontSize 13px */}
          {/* Labels: fontSize 12px, color #888, marginBottom 6px, display block */}
          {/* Toggle buttons active: background #29B5CC, color #000, border transparent */}
          {/* Toggle buttons inactive: background rgba(255,255,255,0.04), border 1px solid rgba(255,255,255,0.08), color #666 */}

          {error && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingTop: '4px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '10px 24px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Saving…' : 'Save and continue'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              style={{ fontSize: '13px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  </div>
)
```

> Read `src/pages/therapist/Onboarding.jsx` before editing to copy the existing form field JSX (logo upload, clinic name, weight unit toggle, frequency selector) verbatim into the form above — only restyle the inputs/buttons as noted.

- [ ] **Step 4: Visual verification**

Visit `/settings` — verify: PageHero with "Settings" title, form sections with uppercase labels and dividers, no glass cards, inputs styled consistently, Save button works.
Navigate to `/onboarding` directly (or temporarily remove the `has_onboarded` redirect) — verify centered glass card on `#0e1117` background, form fields styled consistently, Save and Skip both work.

- [ ] **Step 5: Commit**

```bash
git add src/pages/therapist/Settings.jsx src/pages/therapist/Onboarding.jsx
git commit -m "feat: redesign Settings and Onboarding with PageHero and form section treatment"
```

---

## Task 10: Final cross-page review

- [ ] **Step 1: Run through all pages in order**

```bash
npm run dev
```

Visit each route and verify the checklist below:

| Page | Check |
|------|-------|
| `/therapist` | Dashboard unchanged, full-page particles still present |
| `/therapist/clients` | Hero, glass card, avatar initials, stagger animation |
| `/therapist/prescribe/:id` | Hero, tabs with cyan underline, glass prescription cards, Export PDF button present but non-functional |
| `/therapist/prescribe/:id/sessions/:sid` | Hero with back breadcrumb, two glass cards (details + exercises) |
| `/therapist/templates` | Hero, category pills, glass card list |
| `/therapist/templates/:id` | Hero with back breadcrumb, two glass cards |
| `/therapist/exercises` | Hero, category pills, glass card list, pagination |
| `/therapist/exercises/new` | Hero with back breadcrumb, glass card form |
| `/therapist/exercises/:id` | Hero with exercise name, glass card content |
| `/settings` | Hero, divider sections, no glass cards |
| `/onboarding` | Hero, divider sections, Skip button |

- [ ] **Step 2: Check sidebar seam**

Sidebar background (`#0e1117`) and main content background (`#0e1117` via `dark.bg`) should be seamless — no visible border between them from the color difference.

- [ ] **Step 3: Commit if any final tweaks were needed**

```bash
git add -p
git commit -m "fix: cross-page polish from final review"
```
