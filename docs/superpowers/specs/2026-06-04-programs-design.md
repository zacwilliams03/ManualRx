# Programs Feature — Design Spec

**Date:** 2026-06-04  
**Status:** Approved  

---

## Overview

Add a Programs feature to PrescriptR. A program is a named, multi-week treatment plan for a client, containing sessions organized by week with optional check-in form assignments. Programs can be saved as reusable templates. The feature lives alongside the existing sessions system — sessions remain usable standalone.

---

## Data Model

### New tables

**`programs`**
```sql
id                      uuid        PK DEFAULT gen_random_uuid()
therapist_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
client_id               uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE
name                    text        NOT NULL
duration_weeks          int         NOT NULL
start_date              date        -- nullable; null = program not yet activated
default_checkin_form_id uuid        REFERENCES check_in_forms(id) ON DELETE SET NULL
created_at              timestamptz NOT NULL DEFAULT now()
```

No `status` column. Active/week-progress state is derived at runtime: `current_week = floor((today - start_date) / 7) + 1`, clamped to `[1, duration_weeks]`. If `start_date IS NULL`, the program is considered "not started".

**`program_week_checkins`**
```sql
id               uuid  PK DEFAULT gen_random_uuid()
program_id       uuid  NOT NULL REFERENCES programs(id) ON DELETE CASCADE
week_number      int   NOT NULL
checkin_form_id  uuid  NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE
UNIQUE (program_id, week_number)
```

Note: `checkin_form_id` uses `ON DELETE CASCADE` (deleting a form removes the week override entirely). `programs.default_checkin_form_id` uses `ON DELETE SET NULL` (deleting a form silently clears the default, leaving the program intact). This asymmetry is intentional: a week override without a form reference is meaningless and should be cleaned up; a program without a default check-in form is still valid.

**`program_templates`**
```sql
id                      uuid        PK DEFAULT gen_random_uuid()
therapist_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name                    text        NOT NULL
duration_weeks          int         NOT NULL
default_checkin_form_id uuid        REFERENCES check_in_forms(id) ON DELETE SET NULL
created_at              timestamptz NOT NULL DEFAULT now()
```

**`program_template_sessions`**
```sql
id                   uuid  PK DEFAULT gen_random_uuid()
program_template_id  uuid  NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE
template_id          uuid  REFERENCES templates(id) ON DELETE SET NULL  -- null = custom/named placeholder
week_number          int   NOT NULL
session_name         text  NOT NULL
created_at           timestamptz NOT NULL DEFAULT now()
CONSTRAINT template_or_name CHECK (template_id IS NOT NULL OR session_name IS NOT NULL)
```

`template_id = null` means a custom placeholder session. `session_name` is always required (serves as display name for both cases). When `template_id IS NOT NULL`, `session_name` is typically the template's name (copied at creation time for display without a join).

**`program_template_week_checkins`**
```sql
id                   uuid  PK DEFAULT gen_random_uuid()
program_template_id  uuid  NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE
week_number          int   NOT NULL
checkin_form_id      uuid  NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE
UNIQUE (program_template_id, week_number)
```

### Modified tables

**`prescriptions`** — add 3 nullable columns:
```sql
program_id         uuid  REFERENCES programs(id) ON DELETE SET NULL
week_number        int
source_template_id uuid  REFERENCES templates(id) ON DELETE SET NULL
```

All nullable. A prescription with `program_id IS NULL` is a standalone session (existing behavior unchanged). `source_template_id` records which session template a prescription was created from — used when saving a client program back to a program template, so the template linkage round-trips correctly.

### Indexes

```sql
CREATE INDEX prescriptions_program_id_idx ON prescriptions(program_id);
```

Add to the migration SQL alongside the table changes.

### Row Level Security

All new tables use `therapist_id = auth.uid()` policies matching the existing pattern. `program_week_checkins` and `program_template_week_checkins` are accessible via their parent program/template's `therapist_id` (policy uses a subquery join).

---

## Check-in Integration (v1 scope)

Programs store check-in form assignments as configuration only. They do **not** eagerly create `check_in_instances` rows at apply-time. The existing lazy instance-creation mechanism (triggered on the client dashboard on load) remains unchanged.

This avoids: (a) RLS changes — therapists currently do not insert `check_in_instances`; (b) conflicts with the existing unique constraint `(form_id, client_id, period_start_date)` on `check_in_instances`; (c) the impedance mismatch between the existing day-of-week driven check-in schedule and program week numbers.

What the program check-in fields are used for in v1: display only (show which form is assigned to each week in the program editor UI so the therapist has a reference). Actual check-in scheduling is still done manually via the existing Check-Ins page.

---

## Flows

### Create client program from scratch
1. Prescribe page → "New Program" → "Create from scratch"
2. Modal: enter name + week count → "Create"
3. Inserts `programs` row (`start_date = null`)
4. Navigates to `/therapist/prescribe/:clientId/programs/:programId`
5. Therapist builds out weeks and sessions in the program editor
6. "Set Start Date" on the editor: when set, updates all linked prescriptions where `session_logs` count = 0 with `start_date = program.start_date + (week_number - 1) * 7 days`. Prescriptions that already have session logs keep their existing `start_date`.

### Apply program template to a client
1. Prescribe page → "New Program" → "Apply program template"
2. Modal: pick a program template → enter start date → "Apply"
3. Inserts `programs` row with `start_date`
4. For each `program_template_sessions` row — processed as **sequential `await` calls in a `for...of` loop** (not batched), matching the pattern used in `ApplyTemplateModal`:
   - If `template_id` is set: fetch `template_exercises` for that template, insert a `prescriptions` row, then insert all `prescription_exercises` rows copied from the template; sets `source_template_id = template_id`
   - If `template_id` is null: insert an empty `prescriptions` row with `name = session_name` (no exercises)
   - Both cases: sets `program_id`, `week_number`, and `start_date = program.start_date + (week_number - 1) * 7 days`
5. Check-in form assignments from `program_template_week_checkins` and `program_templates.default_checkin_form_id` are copied into the new `program_week_checkins` and `programs.default_checkin_form_id` as configuration — no `check_in_instances` rows are created (see Check-in Integration above)
6. Navigates back to Prescribe page

### Create program template from scratch
1. Templates page → "Program Templates" tab → "New Program Template"
2. Inserts `program_templates` row, navigates to `/therapist/program-templates/:templateId`
3. Editor is identical to the client program editor minus the "Set Start Date" field

### Save client program as template
1. Program editor → "Save as Template"
2. Prompt for template name
3. Inserts `program_templates` row (`duration_weeks`, `default_checkin_form_id` copied from program)
4. For each `prescriptions` row linked to the program:
   - If `source_template_id` is set: inserts `program_template_sessions` row with `template_id = source_template_id`, `session_name = prescription.name`
   - If `source_template_id` is null: inserts `program_template_sessions` row with `template_id = null`, `session_name = prescription.name`
5. Copies `program_week_checkins` rows into `program_template_week_checkins`
6. Toast: "Saved as program template"

---

## UI Changes

### Prescribe page (`Prescribe.jsx`)

**Prescribed Sessions tab — data fetching:**

`Prescribe.jsx` makes two parallel fetches on mount (both scoped to `therapist_id` + `client_id`):

1. **Programs query:**
   ```js
   supabase.from('programs')
     .select('id, name, duration_weeks, start_date, created_at, default_checkin_form_id')
     .eq('therapist_id', profile.id)
     .eq('client_id', clientId)
     .order('created_at', { ascending: false })
   ```

2. **Prescriptions query** (existing, unchanged shape):
   ```js
   supabase.from('prescriptions')
     .select('id, name, frequency_days, start_date, created_at, program_id, week_number, ...')
     .eq('therapist_id', profile.id)
     .eq('client_id', clientId)
     .order('created_at', { ascending: false })
   ```

**Client-side merge for rendering:**
- Build a `Map<programId, { program, sessions: [] }>` from the programs result
- Iterate prescriptions: if `program_id` is set, push into the matching program's sessions array; otherwise push into a `standaloneSessions` array
- Render the unified list by interleaving programs and standalones sorted by their respective `created_at` descending. Sort key for a program group = `program.created_at`.

**Unified list rendering:**
- Programs and standalone sessions in one flat list, sorted by their `created_at` descending
- Program group: a header card showing program name + week progress badge (e.g., "Week 3 of 12 · Started Jun 1") with an accent left border, followed by the program's sessions indented beneath it in week order
- Standalone sessions render exactly as today
- No section dividers separating programs from standalones

**Button row** — replaces the existing 3-button row:
- **"New Session"** → inline dropdown: "Create from scratch" | "Apply session template"
  - "Apply session template" triggers the existing `ApplyTemplateModal` flow (unchanged)
- **"New Program"** → inline dropdown: "Create from scratch" | "Apply program template"

### Templates page (`Templates.jsx`)

Two tabs:
- **"Session Templates"** — existing list and behavior; "New Template" button relabeled **"New Session Template"**
- **"Program Templates"** — lists `program_templates` rows with name, week count, and session count; button labeled **"New Program Template"**; clicking a template navigates to `/therapist/program-templates/:templateId`. Session count is fetched via PostgREST embed count: `.select('id, name, duration_weeks, created_at, program_template_sessions(count)')` — same pattern as the existing templates list uses for `template_exercises(count)`.

The existing session template edit route `/therapist/templates/:templateId` → `TemplateEdit.jsx` is unchanged.

### Program editor — `ProgramEdit.jsx` (new, shared component)

**Routes:**
- `/therapist/prescribe/:clientId/programs/:programId` — client program mode
- `/therapist/program-templates/:templateId` — program template mode

**Mode detection:** The component reads `useParams()`. Presence of `clientId` param = client program mode; absence = template mode. A `mode` derived value (`'program' | 'template'`) gates the start-date field, "Save as Template" button, and which DB operations are called.

**Layout:**
- Back arrow (client program → Prescribe page; template → Templates page)
- Editable name field (inline, updates on blur)
- Week count field (number input; adding weeks appends empty panels; reducing weeks prompts confirmation if sessions exist in removed weeks)
- Client program mode only: "Set Start Date" date picker (triggers auto-dating logic described above)
- Client program mode only: "Save as Template" button
- "Default check-in form" dropdown (optional; applies to all weeks unless a week has its own override)
- Week panels (one per week, 1–N):
  - Panel header: "Week N" + session count + check-in badge if a form is assigned to this week
  - Collapsed by default; click to expand
  - Expanded panel:
    - Sessions listed with name, frequency display, **Edit** (navigates to `SessionEdit` / opens name-edit modal in template mode) and **Remove** actions
    - **"New Session"**:
      - Client program mode: navigates to `SessionEdit` with `program_id` + `week_number` + `clientId` pre-set
      - Template mode: modal prompts for session name only; inserts `program_template_sessions` row (`template_id = null`)
    - **"From Template"**: opens session template picker modal
      - Client program mode: creates a `prescriptions` row with `source_template_id` set, linked to program + week
      - Template mode: inserts `program_template_sessions` row with `template_id` set
    - **"Check-in form"** dropdown: assigns a form to this specific week (inserts/updates `program_week_checkins` or `program_template_week_checkins`); overrides the default

---

## File Map

| Action | Path | Notes |
|--------|------|-------|
| Create | `src/pages/therapist/ProgramEdit.jsx` | Shared editor; mode derived from URL params |
| Modify | `src/pages/therapist/Prescribe.jsx` | Unified list with program groups, new button dropdowns |
| Modify | `src/pages/therapist/Templates.jsx` | Two tabs, relabeled buttons |
| Modify | `src/App.jsx` | 2 new protected routes |
| DB migration | Supabase SQL Editor | New tables + index + prescriptions columns |

No changes to `AppSidebar.jsx` (programs are accessed via the Clients → Prescribe flow, not top-level nav).  
No changes to `SessionEdit.jsx` — it receives context via **query params** (not URL params), appended to the existing route `/therapist/prescribe/:clientId/sessions/:sessionId?programId=...&weekNumber=...`. No new route needed; `SessionEdit` reads `useSearchParams()` and passes these values through on save so the back-navigation returns to the correct program editor URL. Adding a new URL-param route would collide with the existing `sessions/:sessionId` pattern.  
No changes to the check-in system.

---

## Out of Scope (v1)

- Client-facing program view (clients see their sessions as today; program grouping is therapist-only)
- Eager `check_in_instances` creation at program apply time (deferred — see Check-in Integration)
- Program progress tracking / completion percentage
- Reordering weeks or sessions via drag-and-drop
- Copying a week's sessions to another week
