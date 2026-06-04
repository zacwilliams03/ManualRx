# Programs Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named multi-week Programs to PrescriptR — per-client, week-organized, with sessions and check-in assignments, saveable as reusable program templates.

**Architecture:** Four new Supabase tables + three nullable columns on `prescriptions`. Unified session+program list on Prescribe page. Shared `ProgramEdit.jsx` editor for client programs and program templates. Two-tab Templates page. Programs accessed via Clients → Prescribe flow, no new sidebar nav item.

**Tech Stack:** React 18 + Supabase JS SDK v2 + lucide-react + existing helpers: `CARD`, `SECTION_LABEL` from `styles.js`, `ShimmerLine`, `PageHero`, `SidebarLayout`

**Spec:** `docs/superpowers/specs/2026-06-04-programs-design.md`

---

## File Map

| Action | Path |
|--------|------|
| DB only | Supabase SQL Editor — migration |
| Create | `src/pages/therapist/ProgramEdit.jsx` |
| Create | `src/components/therapist/ProgramWeekPanel.jsx` |
| Create | `src/components/therapist/ApplyProgramTemplateModal.jsx` |
| Modify | `src/components/therapist/ApplyTemplateModal.jsx` |
| Modify | `src/pages/therapist/SessionEdit.jsx` |
| Modify | `src/pages/therapist/Prescribe.jsx` |
| Modify | `src/pages/therapist/Templates.jsx` |
| Modify | `src/App.jsx` |

---

## Task 1: Database Migration

**Files:** Supabase SQL Editor only.

- [ ] **Step 1: Run migration**

Open Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
-- New tables
CREATE TABLE programs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id               uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                    text        NOT NULL,
  duration_weeks          int         NOT NULL,
  start_date              date,
  default_checkin_form_id uuid        REFERENCES check_in_forms(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE program_week_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  week_number     int  NOT NULL,
  checkin_form_id uuid NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE,
  UNIQUE (program_id, week_number)
);

CREATE TABLE program_templates (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    text        NOT NULL,
  duration_weeks          int         NOT NULL,
  default_checkin_form_id uuid        REFERENCES check_in_forms(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE program_template_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid        NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  template_id         uuid        REFERENCES templates(id) ON DELETE SET NULL,
  week_number         int         NOT NULL,
  session_name        text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_or_name CHECK (template_id IS NOT NULL OR session_name IS NOT NULL)
);

CREATE TABLE program_template_week_checkins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  week_number         int  NOT NULL,
  checkin_form_id     uuid NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE,
  UNIQUE (program_template_id, week_number)
);

-- Modify prescriptions
ALTER TABLE prescriptions
  ADD COLUMN program_id         uuid REFERENCES programs(id) ON DELETE SET NULL,
  ADD COLUMN week_number        int,
  ADD COLUMN source_template_id uuid REFERENCES templates(id) ON DELETE SET NULL;

CREATE INDEX prescriptions_program_id_idx ON prescriptions(program_id);

-- RLS
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_week_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_template_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_template_week_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_own_programs" ON programs
  FOR ALL USING (therapist_id = auth.uid());

CREATE POLICY "therapist_program_week_checkins" ON program_week_checkins
  FOR ALL USING (
    program_id IN (SELECT id FROM programs WHERE therapist_id = auth.uid())
  );

CREATE POLICY "therapist_own_program_templates" ON program_templates
  FOR ALL USING (therapist_id = auth.uid());

CREATE POLICY "therapist_program_template_sessions" ON program_template_sessions
  FOR ALL USING (
    program_template_id IN (SELECT id FROM program_templates WHERE therapist_id = auth.uid())
  );

CREATE POLICY "therapist_program_template_week_checkins" ON program_template_week_checkins
  FOR ALL USING (
    program_template_id IN (SELECT id FROM program_templates WHERE therapist_id = auth.uid())
  );
```

Expected output: "Success. No rows returned."

- [ ] **Step 2: Verify**

In Supabase → Table Editor, confirm these tables exist: `programs`, `program_week_checkins`, `program_templates`, `program_template_sessions`, `program_template_week_checkins`. In `prescriptions` table, confirm columns `program_id`, `week_number`, `source_template_id` are present.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: run programs DB migration"
```

---

## Task 2: Modify `ApplyTemplateModal.jsx`

**Files:**
- Modify: `src/components/therapist/ApplyTemplateModal.jsx`

Add an optional `programContext` prop. When provided, skip the options/customise steps and apply the selected template directly, setting `program_id`, `week_number`, and `source_template_id` on the created prescription.

- [ ] **Step 1: Update the component signature and `createPrescription`**

Replace the existing export line and `createPrescription` function:

```jsx
// Old signature:
export default function ApplyTemplateModal({ therapistId, clientId, defaultFrequencyDays, onClose, onApplied }) {

// New signature (add programContext):
export default function ApplyTemplateModal({ therapistId, clientId, defaultFrequencyDays, onClose, onApplied, programContext }) {
  // programContext shape: { programId: string, weekNumber: number, programStartDate: string|null } | undefined
```

Replace the `createPrescription` function:

```jsx
  async function createPrescription(tmpl) {
    const t = tmpl ?? selectedTemplate
    let extraFields = {}
    if (programContext) {
      const weekOffset = (programContext.weekNumber - 1) * 7 * 86400000
      extraFields = {
        program_id: programContext.programId,
        week_number: programContext.weekNumber,
        source_template_id: t.id,
        start_date: programContext.programStartDate
          ? new Date(new Date(programContext.programStartDate).getTime() + weekOffset).toISOString().split('T')[0]
          : null,
      }
    } else {
      extraFields = { start_date: new Date().toISOString().split('T')[0] }
    }
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        therapist_id: therapistId,
        client_id: clientId,
        name: t.name,
        frequency_days: null,
        duration_weeks: t.duration_weeks ?? null,
        ...extraFields,
      })
      .select('id, name, frequency_days, created_at')
      .single()
    if (error) throw new Error(error.message)
    return data
  }
```

- [ ] **Step 2: Update `selectTemplate` and `applyAsIs`/`applyCustomised` to accept a template argument**

Replace `selectTemplate`:

```jsx
  function selectTemplate(template) {
    setSelectedTemplate(template)
    if (programContext) {
      applyAsIs(template)
    } else {
      setStep('options')
    }
  }
```

Replace `applyAsIs` (pass template arg through to `createPrescription`):

```jsx
  async function applyAsIs(tmpl) {
    const t = tmpl ?? selectedTemplate
    setApplying(true)
    setApplyError(null)
    try {
      const prescription = await createPrescription(t)
      const exerciseRows = (t.template_exercises ?? []).map(te => ({
        prescription_id: prescription.id,
        exercise_id: te.exercise_id,
        sets: te.sets,
        reps: te.reps,
        weight: te.weight,
        therapist_notes: te.therapist_notes,
        measurement_type: te.measurement_type ?? 'reps',
        bilateral: te.bilateral ?? false,
      }))
      if (exerciseRows.length > 0) {
        const { error } = await supabase.from('prescription_exercises').insert(exerciseRows)
        if (error) throw new Error(error.message)
      }
      onApplied()
    } catch (e) {
      setApplyError(e.message || 'Failed to apply template.')
    } finally {
      setApplying(false)
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/ApplyTemplateModal.jsx
git commit -m "feat: add programContext support to ApplyTemplateModal"
```

---

## Task 3: Modify `SessionEdit.jsx` — back-navigation

**Files:**
- Modify: `src/pages/therapist/SessionEdit.jsx`

When `SessionEdit` is opened from within a program week, a `programId` query param is present. The back arrow should return to the program editor instead of the Prescribe page.

- [ ] **Step 1: Import `useSearchParams` and read `programId`**

In `SessionEdit.jsx`, add to the existing react-router-dom import:

```jsx
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
```

Inside the component, after the existing `useParams()` call:

```jsx
  const [searchParams] = useSearchParams()
  const programId = searchParams.get('programId')
```

- [ ] **Step 2: Update back destination in `PageHero`**

Find the `PageHero` component usage in `SessionEdit.jsx`. It currently uses a `back` prop pointing to `/therapist/prescribe/${clientId}`. Update it:

```jsx
back={{ 
  label: programId ? 'Program' : 'Prescribe',
  to: programId
    ? `/therapist/prescribe/${clientId}/programs/${programId}`
    : `/therapist/prescribe/${clientId}`
}}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/therapist/SessionEdit.jsx
git commit -m "feat: session editor back-nav respects programId query param"
```

---

## Task 4: Create `ProgramWeekPanel.jsx`

**Files:**
- Create: `src/components/therapist/ProgramWeekPanel.jsx`

Collapsible week panel used inside `ProgramEdit`. Works in two modes:
- `mode = 'program'`: sessions are `prescriptions` rows; "New Session" navigates to `SessionEdit`; "From Template" opens `ApplyTemplateModal` with `programContext`
- `mode = 'template'`: sessions are `program_template_sessions` rows; "New Session" opens a name prompt modal; "From Template" picks a session template and inserts a `program_template_sessions` row

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ApplyTemplateModal from './ApplyTemplateModal'

// Props:
// mode: 'program' | 'template'
// weekNumber: int
// sessions: array of { id, name, frequencyDays? } (normalized by parent)
// checkinFormName: string | null — name of the check-in form assigned to this week
// checkinForms: array of { id, name }
// programId: string (mode='program')
// templateId: string (mode='template')
// clientId: string (mode='program')
// therapistId: string
// programStartDate: string|null (mode='program')
// onRefresh: () => void — parent refreshes its data after any mutation
export default function ProgramWeekPanel({
  mode,
  weekNumber,
  sessions,
  checkinFormName,
  checkinFormId,
  checkinForms,
  programId,
  templateId,
  clientId,
  therapistId,
  programStartDate,
  onRefresh,
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  async function handleNewSessionFromScratch() {
    if (mode === 'program') {
      setSaving(true)
      const name = `Week ${weekNumber} Session ${sessions.length + 1}`
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          therapist_id: therapistId,
          client_id: clientId,
          name,
          program_id: programId,
          week_number: weekNumber,
          start_date: programStartDate
            ? new Date(new Date(programStartDate).getTime() + (weekNumber - 1) * 7 * 86400000).toISOString().split('T')[0]
            : null,
        })
        .select('id')
        .single()
      setSaving(false)
      if (error) { alert('Failed to create session.'); return }
      navigate(`/therapist/prescribe/${clientId}/sessions/${data.id}?programId=${programId}&weekNumber=${weekNumber}`)
    } else {
      setNewSessionName('')
      setShowNameModal(true)
    }
  }

  async function handleCreateTemplateSession() {
    if (!newSessionName.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('program_template_sessions')
      .insert({
        program_template_id: templateId,
        week_number: weekNumber,
        session_name: newSessionName.trim(),
        template_id: null,
      })
    setSaving(false)
    if (error) { alert('Failed to create session.'); return }
    setShowNameModal(false)
    onRefresh()
  }

  async function handleRemoveSession(sessionId) {
    if (!window.confirm('Remove this session from the program?')) return
    if (mode === 'program') {
      await supabase.from('prescriptions').update({ program_id: null, week_number: null }).eq('id', sessionId)
    } else {
      await supabase.from('program_template_sessions').delete().eq('id', sessionId)
    }
    onRefresh()
  }

  async function handleRename(sessionId) {
    if (!renameValue.trim()) return
    setSaving(true)
    if (mode === 'template') {
      await supabase.from('program_template_sessions').update({ session_name: renameValue.trim() }).eq('id', sessionId)
    }
    setSaving(false)
    setRenamingId(null)
    onRefresh()
  }

  async function handleCheckinChange(e) {
    const formId = e.target.value || null
    if (mode === 'program') {
      if (formId) {
        await supabase.from('program_week_checkins').upsert({ program_id: programId, week_number: weekNumber, checkin_form_id: formId }, { onConflict: 'program_id,week_number' })
      } else {
        await supabase.from('program_week_checkins').delete().eq('program_id', programId).eq('week_number', weekNumber)
      }
    } else {
      if (formId) {
        await supabase.from('program_template_week_checkins').upsert({ program_template_id: templateId, week_number: weekNumber, checkin_form_id: formId }, { onConflict: 'program_template_id,week_number' })
      } else {
        await supabase.from('program_template_week_checkins').delete().eq('program_template_id', templateId).eq('week_number', weekNumber)
      }
    }
    onRefresh()
  }

  const hasBadge = !!checkinFormName

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: open ? 'rgba(41,181,204,0.06)' : 'var(--color-elevated)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {open ? <ChevronDown size={14} color="var(--color-muted)" /> : <ChevronRight size={14} color="var(--color-muted)" />}
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Week {weekNumber}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          {hasBadge && (
            <span style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px' }}>
              Check-in
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border)' }}>
          {/* Sessions list */}
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
              {renamingId === s.id ? (
                <>
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id); if (e.key === 'Escape') setRenamingId(null) }}
                    autoFocus
                    style={{ flex: 1, background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '3px 8px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }}
                  />
                  <button onClick={() => handleRename(s.id)} disabled={saving} style={{ fontSize: '11px', color: '#29B5CC', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setRenamingId(null)} style={{ fontSize: '11px', color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>{s.name}</span>
                  {s.frequencyDays && <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{s.frequencyDays}d</span>}
                  {mode === 'program' && (
                    <button
                      onClick={() => navigate(`/therapist/prescribe/${clientId}/sessions/${s.id}?programId=${programId}&weekNumber=${weekNumber}`)}
                      style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  )}
                  {mode === 'template' && s.isCustom && (
                    <button
                      onClick={() => { setRenamingId(s.id); setRenameValue(s.name) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px' }}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSession(s.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            <button
              onClick={handleNewSessionFromScratch}
              disabled={saving}
              style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}
            >
              + New Session
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'none', color: '#29B5CC', cursor: 'pointer' }}
            >
              + From Template
            </button>
          </div>

          {/* Check-in form row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-subtle)', flexShrink: 0 }}>Check-in:</span>
            <select
              value={checkinFormId ?? ''}
              onChange={handleCheckinChange}
              style={{ fontSize: '12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', padding: '3px 6px', flex: 1, maxWidth: '220px' }}
            >
              <option value="">None (use default)</option>
              {checkinForms.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ApplyTemplateModal for "From Template" */}
      {showApplyModal && mode === 'program' && (
        <ApplyTemplateModal
          therapistId={therapistId}
          clientId={clientId}
          defaultFrequencyDays={null}
          programContext={{ programId, weekNumber, programStartDate }}
          onClose={() => setShowApplyModal(false)}
          onApplied={() => { setShowApplyModal(false); onRefresh() }}
        />
      )}

      {/* For template mode "From Template": simple template picker inline */}
      {showApplyModal && mode === 'template' && (
        <TemplatePicker
          therapistId={therapistId}
          programTemplateId={templateId}
          weekNumber={weekNumber}
          onClose={() => setShowApplyModal(false)}
          onAdded={() => { setShowApplyModal(false); onRefresh() }}
        />
      )}

      {/* Name modal for template mode new session */}
      {showNameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Session name</p>
            <input
              autoFocus
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplateSession() }}
              placeholder="e.g. Lower Body Strength"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowNameModal(false)} style={{ flex: 1, padding: '8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleCreateTemplateSession} disabled={saving || !newSessionName.trim()} style={{ flex: 1, padding: '8px', background: '#29B5CC', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px', opacity: !newSessionName.trim() ? 0.5 : 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple template picker modal for program template mode
function TemplatePicker({ therapistId, programTemplateId, weekNumber, onClose, onAdded }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('templates')
      .select('id, name')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false) })
  }, [])

  async function pick(t) {
    setSaving(true)
    await supabase.from('program_template_sessions').insert({
      program_template_id: programTemplateId,
      week_number: weekNumber,
      template_id: t.id,
      session_name: t.name,
    })
    setSaving(false)
    onAdded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', width: '320px', maxHeight: '420px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Add from template</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
          {!loading && templates.length === 0 && <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>No session templates yet.</p>}
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => pick(t)}
              disabled={saving}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{t.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>Add ›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/therapist/ProgramWeekPanel.jsx
git commit -m "feat: add ProgramWeekPanel collapsible week component"
```

---

## Task 5: Create `ApplyProgramTemplateModal.jsx`

**Files:**
- Create: `src/components/therapist/ApplyProgramTemplateModal.jsx`

Modal for picking a program template + start date, then creating a `programs` row and all linked prescriptions.

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Props:
// therapistId: string
// clientId: string
// onClose: () => void
// onApplied: () => void
export default function ApplyProgramTemplateModal({ therapistId, clientId, onClose, onApplied }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('program_templates')
      .select('id, name, duration_weeks, program_template_sessions(count)')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false) })
  }, [therapistId])

  async function handleApply() {
    if (!selected || !startDate) return
    setApplying(true)
    setError(null)
    try {
      // 1. Create the programs row
      const { data: program, error: progErr } = await supabase
        .from('programs')
        .insert({
          therapist_id: therapistId,
          client_id: clientId,
          name: selected.name,
          duration_weeks: selected.duration_weeks,
          start_date: startDate,
        })
        .select('id')
        .single()
      if (progErr) throw new Error(progErr.message)

      // 2. Fetch full template sessions (need template_exercises for each)
      const { data: templateSessions, error: tsErr } = await supabase
        .from('program_template_sessions')
        .select('id, week_number, session_name, template_id')
        .eq('program_template_id', selected.id)
        .order('week_number', { ascending: true })
      if (tsErr) throw new Error(tsErr.message)

      // 3. For each template session, create a prescription (sequential awaits)
      for (const ts of templateSessions) {
        const weekOffset = (ts.week_number - 1) * 7 * 86400000
        const sessionStartDate = new Date(new Date(startDate).getTime() + weekOffset).toISOString().split('T')[0]

        const { data: prescription, error: pErr } = await supabase
          .from('prescriptions')
          .insert({
            therapist_id: therapistId,
            client_id: clientId,
            name: ts.session_name,
            program_id: program.id,
            week_number: ts.week_number,
            start_date: sessionStartDate,
            source_template_id: ts.template_id ?? null,
          })
          .select('id')
          .single()
        if (pErr) throw new Error(pErr.message)

        if (ts.template_id) {
          // Copy exercises from session template
          const { data: templateExercises, error: teErr } = await supabase
            .from('template_exercises')
            .select('exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral')
            .eq('template_id', ts.template_id)
          if (teErr) throw new Error(teErr.message)

          if (templateExercises.length > 0) {
            const exerciseRows = templateExercises.map(te => ({
              prescription_id: prescription.id,
              exercise_id: te.exercise_id,
              sets: te.sets,
              reps: te.reps,
              weight: te.weight,
              therapist_notes: te.therapist_notes,
              measurement_type: te.measurement_type ?? 'reps',
              bilateral: te.bilateral ?? false,
            }))
            const { error: exErr } = await supabase.from('prescription_exercises').insert(exerciseRows)
            if (exErr) throw new Error(exErr.message)
          }
        }
      }

      // 4. Copy check-in assignments from template
      const { data: templateCheckins } = await supabase
        .from('program_template_week_checkins')
        .select('week_number, checkin_form_id')
        .eq('program_template_id', selected.id)
      if (templateCheckins?.length > 0) {
        await supabase.from('program_week_checkins').insert(
          templateCheckins.map(tc => ({
            program_id: program.id,
            week_number: tc.week_number,
            checkin_form_id: tc.checkin_form_id,
          }))
        )
      }

      // 5. Copy default check-in form
      const { data: fullTemplate } = await supabase
        .from('program_templates')
        .select('default_checkin_form_id')
        .eq('id', selected.id)
        .single()
      if (fullTemplate?.default_checkin_form_id) {
        await supabase.from('programs').update({ default_checkin_form_id: fullTemplate.default_checkin_form_id }).eq('id', program.id)
      }

      onApplied()
    } catch (e) {
      setError(e.message || 'Failed to apply program template.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Apply Program Template</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {/* Template list */}
        {!selected && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {loading && <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!loading && templates.length === 0 && (
              <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>No program templates yet.</p>
            )}
            {templates.map(t => {
              const count = t.program_template_sessions?.[0]?.count ?? 0
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-subtle)' }}>{t.duration_weeks} weeks · {count} session{count !== 1 ? 's' : ''}</p>
                  </div>
                  <span style={{ color: 'var(--color-subtle)' }}>›</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Start date picker after selection */}
        {selected && (
          <div style={{ padding: '20px' }}>
            <div style={{ background: 'var(--color-elevated)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{selected.name}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-subtle)' }}>{selected.duration_weeks} weeks</p>
            </div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '6px' }}>Program start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
            {error && <p style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '10px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setSelected(null)} disabled={applying} style={{ flex: 1, padding: '9px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
              <button onClick={handleApply} disabled={applying || !startDate} style={{ flex: 1, padding: '9px', background: '#29B5CC', border: 'none', borderRadius: '7px', color: '#000', fontWeight: 600, cursor: applying ? 'default' : 'pointer', fontSize: '13px', opacity: applying ? 0.7 : 1 }}>
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/therapist/ApplyProgramTemplateModal.jsx
git commit -m "feat: add ApplyProgramTemplateModal"
```

---

## Task 6: Create `ProgramEdit.jsx`

**Files:**
- Create: `src/pages/therapist/ProgramEdit.jsx`

Shared program editor for both client programs (`/therapist/prescribe/:clientId/programs/:programId`) and program templates (`/therapist/program-templates/:templateId`). Mode is derived from `useParams()` — presence of `clientId` = program mode.

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import ProgramWeekPanel from '../../components/therapist/ProgramWeekPanel'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { CARD } from '../../components/therapist/styles'

export default function ProgramEdit() {
  const { clientId, programId, templateId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const mode = clientId ? 'program' : 'template'
  const entityId = mode === 'program' ? programId : templateId

  const [name, setName] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [startDate, setStartDate] = useState('')
  const [defaultCheckinFormId, setDefaultCheckinFormId] = useState(null)
  const [sessions, setSessions] = useState([]) // prescriptions or program_template_sessions
  const [weekCheckins, setWeekCheckins] = useState({}) // { weekNumber: { id, checkin_form_id, name } }
  const [checkinForms, setCheckinForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveAsTemplateModal, setSaveAsTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchAll()
  }, [entityId, profile?.id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchEntity(), fetchCheckinForms()])
    setLoading(false)
  }

  async function fetchCheckinForms() {
    const { data } = await supabase
      .from('check_in_forms')
      .select('id, name')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
    setCheckinForms(data ?? [])
  }

  async function fetchEntity() {
    if (mode === 'program') {
      const [progRes, sessRes, weekCheckinRes] = await Promise.all([
        supabase.from('programs').select('id, name, duration_weeks, start_date, default_checkin_form_id').eq('id', entityId).single(),
        supabase.from('prescriptions').select('id, name, frequency_days, week_number, source_template_id').eq('program_id', entityId).order('week_number', { ascending: true }),
        supabase.from('program_week_checkins').select('week_number, checkin_form_id, check_in_forms(name)').eq('program_id', entityId),
      ])
      if (progRes.data) {
        setName(progRes.data.name)
        setDurationWeeks(progRes.data.duration_weeks)
        setStartDate(progRes.data.start_date ?? '')
        setDefaultCheckinFormId(progRes.data.default_checkin_form_id ?? null)
      }
      setSessions(sessRes.data ?? [])
      const wc = {}
      for (const row of weekCheckinRes.data ?? []) {
        wc[row.week_number] = { checkinFormId: row.checkin_form_id, checkinFormName: row.check_in_forms?.name ?? null }
      }
      setWeekCheckins(wc)
    } else {
      const [tmplRes, sessRes, weekCheckinRes] = await Promise.all([
        supabase.from('program_templates').select('id, name, duration_weeks, default_checkin_form_id').eq('id', entityId).single(),
        supabase.from('program_template_sessions').select('id, week_number, session_name, template_id').eq('program_template_id', entityId).order('week_number', { ascending: true }),
        supabase.from('program_template_week_checkins').select('week_number, checkin_form_id, check_in_forms(name)').eq('program_template_id', entityId),
      ])
      if (tmplRes.data) {
        setName(tmplRes.data.name)
        setDurationWeeks(tmplRes.data.duration_weeks)
        setDefaultCheckinFormId(tmplRes.data.default_checkin_form_id ?? null)
      }
      setSessions(sessRes.data ?? [])
      const wc = {}
      for (const row of weekCheckinRes.data ?? []) {
        wc[row.week_number] = { checkinFormId: row.checkin_form_id, checkinFormName: row.check_in_forms?.name ?? null }
      }
      setWeekCheckins(wc)
    }
  }

  async function saveName() {
    if (!name.trim()) return
    const table = mode === 'program' ? 'programs' : 'program_templates'
    await supabase.from(table).update({ name: name.trim() }).eq('id', entityId)
  }

  async function handleStartDateChange(e) {
    const date = e.target.value
    setStartDate(date)
    setSaving(true)
    await supabase.from('programs').update({ start_date: date || null }).eq('id', entityId)

    if (date) {
      // Auto-date prescriptions that have no session logs
      const prescriptionIds = sessions.map(s => s.id)
      if (prescriptionIds.length > 0) {
        const { data: logCounts } = await supabase
          .from('session_logs')
          .select('prescription_id')
          .in('prescription_id', prescriptionIds)
        const withLogs = new Set((logCounts ?? []).map(l => l.prescription_id))

        for (const s of sessions) {
          if (!withLogs.has(s.id) && s.week_number) {
            const weekOffset = (s.week_number - 1) * 7 * 86400000
            const sessionStart = new Date(new Date(date).getTime() + weekOffset).toISOString().split('T')[0]
            await supabase.from('prescriptions').update({ start_date: sessionStart }).eq('id', s.id)
          }
        }
      }
    }
    setSaving(false)
  }

  async function handleDefaultCheckinChange(e) {
    const formId = e.target.value || null
    setDefaultCheckinFormId(formId)
    const table = mode === 'program' ? 'programs' : 'program_templates'
    await supabase.from(table).update({ default_checkin_form_id: formId }).eq('id', entityId)
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      const { data: newTemplate, error: tmplErr } = await supabase
        .from('program_templates')
        .insert({ therapist_id: profile.id, name: templateName.trim(), duration_weeks: durationWeeks, default_checkin_form_id: defaultCheckinFormId ?? null })
        .select('id')
        .single()
      if (tmplErr) throw new Error(tmplErr.message)

      for (const s of sessions) {
        await supabase.from('program_template_sessions').insert({
          program_template_id: newTemplate.id,
          week_number: s.week_number,
          session_name: s.name,
          template_id: s.source_template_id ?? null,
        })
      }

      const { data: wcs } = await supabase.from('program_week_checkins').select('week_number, checkin_form_id').eq('program_id', entityId)
      if (wcs?.length > 0) {
        await supabase.from('program_template_week_checkins').insert(
          wcs.map(wc => ({ program_template_id: newTemplate.id, week_number: wc.week_number, checkin_form_id: wc.checkin_form_id }))
        )
      }

      setSaveAsTemplateModal(false)
      setTemplateName('')
      showToast('Saved as program template')
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Build week numbers array
  const weeks = Array.from({ length: durationWeeks }, (_, i) => i + 1)

  // Normalize sessions by week
  function sessionsForWeek(weekNum) {
    if (mode === 'program') {
      return sessions.filter(s => s.week_number === weekNum).map(s => ({
        id: s.id,
        name: s.name,
        frequencyDays: s.frequency_days,
        isCustom: !s.source_template_id,
      }))
    } else {
      return sessions.filter(s => s.week_number === weekNum).map(s => ({
        id: s.id,
        name: s.session_name,
        isCustom: !s.template_id,
      }))
    }
  }

  const backTo = mode === 'program'
    ? `/therapist/prescribe/${clientId}`
    : '/therapist/templates'

  return (
    <SidebarLayout>
      <PageHero
        title={name || 'Program'}
        subtitle={mode === 'program' ? 'Client program' : 'Program template'}
        back={{ label: mode === 'program' ? 'Prescribe' : 'Templates', to: backTo }}
        actions={
          mode === 'program' ? (
            <button
              onClick={() => { setTemplateName(name); setSaveAsTemplateModal(true) }}
              style={{ padding: '8px 14px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}
            >
              Save as Template
            </button>
          ) : null
        }
      />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {loading ? (
          <div style={{ ...CARD }}><ShimmerLine /><div style={{ height: '120px' }} /></div>
        ) : (
          <>
            {/* Header fields */}
            <div style={{ ...CARD, marginBottom: '20px' }}>
              <ShimmerLine />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Program name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={saveName}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Duration */}
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Duration (weeks)</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={durationWeeks}
                      onChange={async e => {
                        const val = parseInt(e.target.value) || 1
                        const clamped = Math.max(1, Math.min(52, val))
                        setDurationWeeks(clamped)
                        const table = mode === 'program' ? 'programs' : 'program_templates'
                        await supabase.from(table).update({ duration_weeks: clamped }).eq('id', entityId)
                      }}
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Start date — program mode only */}
                  {mode === 'program' && (
                    <div style={{ flex: '1', minWidth: '160px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>
                        Start date {saving && <span style={{ color: 'var(--color-subtle)' }}>(saving…)</span>}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>

                {/* Default check-in form */}
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Default check-in form (all weeks)</label>
                  <select
                    value={defaultCheckinFormId ?? ''}
                    onChange={handleDefaultCheckinChange}
                    style={{ padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', width: '100%', maxWidth: '280px' }}
                  >
                    <option value="">None</option>
                    {checkinForms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Week panels */}
            <div>
              {weeks.map(weekNum => (
                <ProgramWeekPanel
                  key={weekNum}
                  mode={mode}
                  weekNumber={weekNum}
                  sessions={sessionsForWeek(weekNum)}
                  checkinFormId={weekCheckins[weekNum]?.checkinFormId ?? null}
                  checkinFormName={weekCheckins[weekNum]?.checkinFormName ?? null}
                  checkinForms={checkinForms}
                  programId={mode === 'program' ? entityId : undefined}
                  templateId={mode === 'template' ? entityId : undefined}
                  clientId={clientId}
                  therapistId={profile.id}
                  programStartDate={startDate || null}
                  onRefresh={fetchEntity}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Save as template modal */}
      {saveAsTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Save as program template</p>
            <input
              autoFocus
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveAsTemplate() }}
              placeholder="Template name"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setSaveAsTemplateModal(false)} style={{ flex: 1, padding: '8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSaveAsTemplate} disabled={savingTemplate || !templateName.trim()} style={{ flex: 1, padding: '8px', background: '#29B5CC', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px', opacity: savingTemplate || !templateName.trim() ? 0.5 : 1 }}>
                {savingTemplate ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 200 }}>
          <span style={{ color: '#29B5CC' }}>✓</span>
          <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{toast}</span>
        </div>
      )}
    </SidebarLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/therapist/ProgramEdit.jsx
git commit -m "feat: add ProgramEdit shared program/template editor"
```

---

## Task 7: Modify `Prescribe.jsx`

**Files:**
- Modify: `src/pages/therapist/Prescribe.jsx`

Add: (1) programs fetch + merge logic, (2) program group rendering in the sessions list, (3) replace existing 3-button row with "New Session" and "New Program" dropdowns.

- [ ] **Step 1: Add imports**

At the top of `Prescribe.jsx`, add to the existing import block:

```jsx
import ApplyProgramTemplateModal from '../../components/therapist/ApplyProgramTemplateModal'
```

- [ ] **Step 2: Add state for programs and dropdowns**

Inside the `Prescribe` component, after the existing state declarations, add:

```jsx
  const [programs, setPrograms] = useState([])
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  const [showProgramDropdown, setShowProgramDropdown] = useState(false)
  const [showApplyProgramModal, setShowApplyProgramModal] = useState(false)
  const [creatingProgram, setCreatingProgram] = useState(false)
```

- [ ] **Step 3: Update `fetchData` to also fetch programs**

Replace the existing `fetchData` function:

```jsx
  async function fetchData() {
    setLoading(true)
    setError(null)

    const [clientRes, sessionsRes, therapistRes, programsRes] = await Promise.all([
      supabase.from('clients').select('id, name, email').eq('id', clientId).single(),
      supabase
        .from('prescriptions')
        .select('id, name, frequency_days, start_date, duration_weeks, created_at, program_id, week_number, prescription_exercises(count), session_logs(count)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true }),
      supabase.from('therapist_profiles').select('default_frequency_days').eq('user_id', profile.id).maybeSingle(),
      supabase
        .from('programs')
        .select('id, name, duration_weeks, start_date, created_at')
        .eq('therapist_id', profile.id)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ])

    if (clientRes.error) { setError('Client not found.'); setLoading(false); return }
    setClient(clientRes.data)
    if (sessionsRes.error) setError('Failed to load sessions.')
    else setSessions(sessionsRes.data)
    if (therapistRes.data?.default_frequency_days) setDefaultFrequencyDays(therapistRes.data.default_frequency_days)
    setPrograms(programsRes.data ?? [])
    setLoading(false)
  }
```

- [ ] **Step 4: Add `createProgram` function**

Add after the existing `createSession` function:

```jsx
  async function createProgram(name, durationWeeks) {
    setCreatingProgram(true)
    const { data, error: insertError } = await supabase
      .from('programs')
      .insert({ therapist_id: profile.id, client_id: clientId, name, duration_weeks: durationWeeks })
      .select('id')
      .single()
    setCreatingProgram(false)
    if (insertError) { alert('Failed to create program.'); return }
    navigate(`/therapist/prescribe/${clientId}/programs/${data.id}`)
  }
```

- [ ] **Step 5: Replace the button row in PageHero `actions`**

Find the `actions` prop in `PageHero` inside `Prescribe.jsx`. Replace the entire inner section that renders the "Apply Template", "New session" buttons (keep the PDF and Message buttons unchanged):

```jsx
            {activeTab === 'prescriptions' && (
              <>
                {/* New Session dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowSessionDropdown(d => !d); setShowProgramDropdown(false) }}
                    style={{ padding: '9px 18px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    New Session ▾
                  </button>
                  {showSessionDropdown && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '10px', minWidth: '190px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden' }}>
                      <button
                        onClick={() => { setShowSessionDropdown(false); createSession() }}
                        disabled={creating}
                        style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}
                      >
                        Create from scratch
                      </button>
                      <div style={{ height: '1px', background: 'rgba(41,181,204,0.1)', margin: '0 10px' }} />
                      <button
                        onClick={() => { setShowSessionDropdown(false); setShowApplyModal(true) }}
                        style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}
                      >
                        Apply session template
                      </button>
                    </div>
                  )}
                </div>

                {/* New Program dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowProgramDropdown(d => !d); setShowSessionDropdown(false) }}
                    style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    New Program ▾
                  </button>
                  {showProgramDropdown && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '10px', minWidth: '200px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 200, overflow: 'hidden' }}>
                      <button
                        onClick={() => { setShowProgramDropdown(false); setShowCreateProgramModal(true) }}
                        style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}
                      >
                        Create from scratch
                      </button>
                      <div style={{ height: '1px', background: 'rgba(41,181,204,0.1)', margin: '0 10px' }} />
                      <button
                        onClick={() => { setShowProgramDropdown(false); setShowApplyProgramModal(true) }}
                        style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer' }}
                      >
                        Apply program template
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
```

Also add `showCreateProgramModal` state and a "Create program" modal. Add to state:

```jsx
  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false)
  const [newProgramName, setNewProgramName] = useState('')
  const [newProgramWeeks, setNewProgramWeeks] = useState(4)
```

Add the "Create program" modal and `ApplyProgramTemplateModal` just before the closing `</SidebarLayout>` tag (alongside the existing `ApplyTemplateModal`):

```jsx
      {showCreateProgramModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px' }}>
            <p style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>New Program</p>
            <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Name</label>
            <input
              autoFocus
              value={newProgramName}
              onChange={e => setNewProgramName(e.target.value)}
              placeholder="e.g. 12-Week Knee Rehab"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
            />
            <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Duration (weeks)</label>
            <input
              type="number"
              min="1"
              max="52"
              value={newProgramWeeks}
              onChange={e => setNewProgramWeeks(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowCreateProgramModal(false)} style={{ flex: 1, padding: '9px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button
                onClick={() => { setShowCreateProgramModal(false); createProgram(newProgramName || 'New Program', newProgramWeeks) }}
                disabled={creatingProgram}
                style={{ flex: 1, padding: '9px', background: '#29B5CC', border: 'none', borderRadius: '7px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplyProgramModal && (
        <ApplyProgramTemplateModal
          therapistId={profile.id}
          clientId={clientId}
          onClose={() => setShowApplyProgramModal(false)}
          onApplied={() => { setShowApplyProgramModal(false); fetchData() }}
        />
      )}
```

Also add a click-outside handler for the dropdowns. Add to the existing `useEffect` block section:

```jsx
  useEffect(() => {
    if (!showSessionDropdown && !showProgramDropdown) return
    const handler = () => { setShowSessionDropdown(false); setShowProgramDropdown(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSessionDropdown, showProgramDropdown])
```

- [ ] **Step 6: Add program group rendering to the sessions tab**

In the `activeTab === 'prescriptions'` section, replace the existing sessions list render with the merged program + standalone list. Find the block that starts `{sessions.length === 0 && (` and replace through the end of `sortedSessions.map(...)`:

```jsx
              {/* Build merged list: programs first (sorted by created_at desc), then standalones */}
              {(() => {
                const programMap = new Map(programs.map(p => [p.id, { program: p, sessions: [] }]))
                const standalones = []
                for (const s of sessions) {
                  if (s.program_id && programMap.has(s.program_id)) {
                    programMap.get(s.program_id).sessions.push(s)
                  } else if (!s.program_id) {
                    standalones.push(s)
                  }
                }

                const items = [
                  ...programs.map(p => ({ type: 'program', ...programMap.get(p.id), sortKey: new Date(p.created_at) })),
                  ...standalones.map(s => ({ type: 'session', session: s, sortKey: new Date(s.created_at) })),
                ].sort((a, b) => b.sortKey - a.sortKey)

                if (items.length === 0) {
                  return <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No sessions or programs yet. Create the first one.</p>
                }

                return items.map((item, i) => {
                  if (item.type === 'program') {
                    const p = item.program
                    const today = new Date()
                    const started = p.start_date && new Date(p.start_date) <= today
                    const currentWeek = p.start_date
                      ? Math.min(p.duration_weeks, Math.max(1, Math.floor((today - new Date(p.start_date)) / (7 * 86400000)) + 1))
                      : null
                    const progressLabel = p.start_date
                      ? (started ? `Week ${currentWeek} of ${p.duration_weeks}` : `Starts ${new Date(p.start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`)
                      : `${p.duration_weeks} weeks · Not started`

                    return (
                      <motion.div
                        key={`prog-${p.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                        style={{ ...CARD, padding: 0, marginBottom: '14px', borderLeft: '3px solid rgba(41,181,204,0.4)' }}
                      >
                        <ShimmerLine />
                        {/* Program header */}
                        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: item.sessions.length > 0 ? '1px solid var(--color-elevated)' : 'none' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#29B5CC' }}>{p.name}</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '3px' }}>{progressLabel}</p>
                          </div>
                          <button
                            onClick={() => navigate(`/therapist/prescribe/${clientId}/programs/${p.id}`)}
                            style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', background: 'transparent', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                        {/* Program sessions indented */}
                        {item.sessions.sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0)).map(s => {
                          const active = isActive(s)
                          const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
                          return (
                            <div
                              key={s.id}
                              style={{ padding: '10px 20px 10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-elevated)', opacity: active ? 1 : 0.55 }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {s.week_number && <span style={{ fontSize: '10px', color: 'var(--color-subtle)', background: 'var(--color-elevated)', padding: '1px 5px', borderRadius: '3px' }}>Wk {s.week_number}</span>}
                                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{s.name}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                                  {s.prescription_exercises[0]?.count ?? 0} ex · {frequencyLabel(s.frequency_days)} · {completedCount} done
                                </p>
                              </div>
                              <Link
                                to={`/therapist/prescribe/${clientId}/sessions/${s.id}?programId=${p.id}&weekNumber=${s.week_number}`}
                                style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-muted)', textDecoration: 'none' }}
                              >
                                Edit
                              </Link>
                            </div>
                          )
                        })}
                      </motion.div>
                    )
                  }

                  // Standalone session
                  const s = item.session
                  const active = isActive(s)
                  const completedCount = parseInt(s.session_logs?.[0]?.count ?? 0)
                  const expected = expectedSessions(s)
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                      style={{ ...CARD, padding: 0, marginBottom: '14px', opacity: active ? 1 : 0.55 }}
                    >
                      <ShimmerLine />
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--color-elevated)' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</span>
                            {!active && <span style={{ fontSize: '11px', padding: '2px 7px', background: 'var(--color-border)', color: 'var(--color-muted)', borderRadius: '4px' }}>Inactive</span>}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '4px' }}>
                            {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                          </p>
                          {active && s.duration_weeks && s.start_date && (
                            <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>Active until {formatExpiryDate(s.start_date, s.duration_weeks)}</p>
                          )}
                          <p style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                            {expected != null ? `${completedCount} / ${expected} sessions completed` : `${completedCount} session${completedCount !== 1 ? 's' : ''} completed`}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {!active && (
                              <button onClick={() => reactivatePrescription(s)} disabled={reactivating === s.id} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', color: '#29B5CC', background: 'transparent', cursor: 'pointer', opacity: reactivating === s.id ? 0.6 : 1 }}>
                                {reactivating === s.id ? 'Copying…' : 'Reactivate'}
                              </button>
                            )}
                            <button onClick={() => downloadPDF(s)} disabled={pdfLoadingId === s.id} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', background: 'transparent', cursor: 'pointer', opacity: pdfLoadingId === s.id ? 0.6 : 1 }}>
                              {pdfLoadingId === s.id ? 'Generating…' : 'PDF'}
                            </button>
                            <Link to={`/therapist/prescribe/${clientId}/sessions/${s.id}`} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', textDecoration: 'none' }}>Edit</Link>
                            <button onClick={() => deleteSession(s.id, s.name)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: 'var(--color-danger)', background: 'transparent', cursor: 'pointer' }}>Delete</button>
                          </div>
                          {pdfError === s.id && <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>PDF failed</span>}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              })()}
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx
git commit -m "feat: add programs to Prescribe page — unified list and New Program button"
```

---

## Task 8: Modify `Templates.jsx`

**Files:**
- Modify: `src/pages/therapist/Templates.jsx`

Add a "Program Templates" tab alongside the existing "Session Templates" tab.

- [ ] **Step 1: Add program templates state**

Inside `Templates`, add after the existing state:

```jsx
  const [activeTab, setActiveTab] = useState('session')
  const [programTemplates, setProgramTemplates] = useState([])
  const [programTemplatesLoading, setProgramTemplatesLoading] = useState(true)
  const [creatingProgramTemplate, setCreatingProgramTemplate] = useState(false)
```

- [ ] **Step 2: Add `fetchProgramTemplates` and call it on mount**

Add the function:

```jsx
  async function fetchProgramTemplates() {
    setProgramTemplatesLoading(true)
    const { data } = await supabase
      .from('program_templates')
      .select('id, name, duration_weeks, created_at, program_template_sessions(count)')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
    setProgramTemplates(data ?? [])
    setProgramTemplatesLoading(false)
  }
```

Update the existing `useEffect`:

```jsx
  useEffect(() => {
    if (profile?.id) {
      fetchTemplates()
      fetchProgramTemplates()
    }
  }, [profile?.id])
```

Add `createProgramTemplate` and `deleteProgramTemplate`:

```jsx
  async function createProgramTemplate() {
    setCreatingProgramTemplate(true)
    const { data, error: insertError } = await supabase
      .from('program_templates')
      .insert({ therapist_id: profile.id, name: 'New Program Template', duration_weeks: 4 })
      .select('id')
      .single()
    if (insertError) { alert('Failed to create program template.'); setCreatingProgramTemplate(false); return }
    navigate(`/therapist/program-templates/${data.id}`)
  }

  async function deleteProgramTemplate(id, name) {
    if (!window.confirm(`Delete program template "${name}"?`)) return
    await supabase.from('program_templates').delete().eq('id', id)
    setProgramTemplates(prev => prev.filter(t => t.id !== id))
  }
```

- [ ] **Step 3: Replace the page structure with tabbed layout**

Replace the entire `return (...)` in `Templates.jsx`:

```jsx
  return (
    <SidebarLayout>
      <PageHero
        title="Templates"
        actions={
          activeTab === 'session' ? (
            <button
              onClick={createTemplate}
              disabled={creating}
              style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1 }}
            >
              {creating ? 'Creating…' : '+ New Session Template'}
            </button>
          ) : (
            <button
              onClick={createProgramTemplate}
              disabled={creatingProgramTemplate}
              style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: creatingProgramTemplate ? 'default' : 'pointer', opacity: creatingProgramTemplate ? 0.6 : 1 }}
            >
              {creatingProgramTemplate ? 'Creating…' : '+ New Program Template'}
            </button>
          )
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 32px' }}>
        {[{ key: 'session', label: 'Session Templates' }, { key: 'program', label: 'Program Templates' }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{ padding: '12px 16px', fontSize: '13px', fontWeight: activeTab === tab.key ? 600 : 400, color: activeTab === tab.key ? '#29B5CC' : 'var(--color-subtle)', background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #29B5CC' : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '860px' }}>

        {/* Session Templates tab */}
        {activeTab === 'session' && (
          <>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" style={{ width: '100%', maxWidth: '320px', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', marginBottom: '12px' }} />
            {categories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                <button onClick={() => setSelectedCategory(null)} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', background: selectedCategory === null ? 'rgba(41,181,204,0.12)' : 'var(--color-elevated)', color: selectedCategory === null ? '#29B5CC' : 'var(--color-muted)', borderColor: selectedCategory === null ? 'rgba(41,181,204,0.3)' : 'var(--color-border)' }}>All</button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', background: selectedCategory === cat ? 'rgba(41,181,204,0.12)' : 'var(--color-elevated)', color: selectedCategory === cat ? '#29B5CC' : 'var(--color-muted)', borderColor: selectedCategory === cat ? 'rgba(41,181,204,0.3)' : 'var(--color-border)' }}>{cat}</button>
                ))}
              </div>
            )}
            {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</p>}
            {loading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!loading && filteredTemplates.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{templates.length === 0 ? 'No session templates yet.' : 'No templates match.'}</p>}
            {!loading && filteredTemplates.length > 0 && (
              <div style={{ ...CARD, padding: 0 }}>
                <ShimmerLine />
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-elevated)' }}><span style={SECTION_LABEL}>Session Templates</span></div>
                {filteredTemplates.map((t, i) => {
                  const exerciseCount = t.template_exercises?.length ?? 0
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filteredTemplates.length - 1 ? '1px solid var(--color-elevated)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {t.category && <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>{t.category}</span>}
                          <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{exerciseCount === 0 ? 'No exercises' : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/therapist/templates/${t.id}`)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'transparent', color: '#29B5CC', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteTemplate(t.id, t.name)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Program Templates tab */}
        {activeTab === 'program' && (
          <>
            {programTemplatesLoading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!programTemplatesLoading && programTemplates.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No program templates yet.</p>}
            {!programTemplatesLoading && programTemplates.length > 0 && (
              <div style={{ ...CARD, padding: 0 }}>
                <ShimmerLine />
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-elevated)' }}><span style={SECTION_LABEL}>Program Templates</span></div>
                {programTemplates.map((t, i) => {
                  const sessionCount = t.program_template_sessions?.[0]?.count ?? 0
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < programTemplates.length - 1 ? '1px solid var(--color-elevated)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '4px' }}>{t.duration_weeks} weeks · {sessionCount} session{sessionCount !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/therapist/program-templates/${t.id}`)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'transparent', color: '#29B5CC', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteProgramTemplate(t.id, t.name)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </motion.div>
    </SidebarLayout>
  )
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/therapist/Templates.jsx
git commit -m "feat: add Program Templates tab to Templates page"
```

---

## Task 9: Modify `App.jsx` — Add Routes

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports**

Add after the existing `TherapistThread` import:

```jsx
import ProgramEdit from './pages/therapist/ProgramEdit'
```

- [ ] **Step 2: Add two new routes**

Add after the existing `/therapist/messages/:clientId` route:

```jsx
          <Route path="/therapist/prescribe/:clientId/programs/:programId" element={<ProtectedRoute requiredRole="therapist"><ProgramEdit /></ProtectedRoute>} />
          <Route path="/therapist/program-templates/:templateId" element={<ProtectedRoute requiredRole="therapist"><ProgramEdit /></ProtectedRoute>} />
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add program editor routes"
```

---

## Verification

Work through these manually after all tasks complete:

1. **DB:** Insert a test row into `programs` in Supabase Table Editor. Confirm `prescriptions` has `program_id`, `week_number`, `source_template_id` columns.

2. **Create program from scratch:** Navigate to `/therapist/prescribe/<clientId>`. Click "New Program" → "Create from scratch". Enter a name and week count. Confirm navigation to the program editor. Expand Week 1. Click "New Session" — confirm navigation to `SessionEdit` with `?programId=...` in the URL. Confirm back button in `SessionEdit` returns to the program editor.

3. **Program in the list:** Return to the Prescribe page. Confirm the program appears in the unified list with an accent left border. Confirm its sessions are indented beneath it with week badges.

4. **Apply session template inside a program:** In the program editor, expand a week. Click "From Template". Confirm `ApplyTemplateModal` opens and successfully creates a prescription linked to the program/week.

5. **Save as template:** In a client program editor, click "Save as Template". Enter a name. Navigate to Templates → Program Templates tab. Confirm the template appears with correct week/session count.

6. **Apply program template:** From the Prescribe page, click "New Program" → "Apply program template". Pick the saved template, set a start date, click Apply. Confirm all sessions are created with correct `start_date` offsets, and the program appears in the unified list.

7. **Program Templates tab:** Navigate to `/therapist/templates`. Confirm two tabs: "Session Templates" and "Program Templates". Confirm "New Session Template" and "New Program Template" buttons work and navigate correctly.

8. **Program template editor:** Navigate to a program template from the Program Templates tab. Confirm mode shows "Program template" in the subtitle. Confirm no "Set Start Date" field and no "Save as Template" button.

9. **Check-in form assignments:** In the program editor, expand a week and assign a check-in form. Confirm the "Check-in" badge appears in the panel header after refresh.
