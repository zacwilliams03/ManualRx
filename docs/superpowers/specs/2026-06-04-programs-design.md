# Programs Feature — Design Spec

**Date:** 2026-06-04  
**Status:** Approved  

---

## Overview

Add a Programs feature to PrescriptR. A program is a named, multi-week treatment plan for a client, containing sessions organized by week with optional check-in forms. Programs can be saved as reusable templates. The feature lives alongside the existing sessions system — sessions remain usable standalone.

---

## Data Model

### New tables

**`programs`**
```sql
id                     uuid        PK DEFAULT gen_random_uuid()
therapist_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
client_id              uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE
name                   text        NOT NULL
duration_weeks         int         NOT NULL
start_date             date        -- set when program is activated
default_checkin_form_id uuid       REFERENCES check_in_forms(id) ON DELETE SET NULL
created_at             timestamptz NOT NULL DEFAULT now()
```

**`program_week_checkins`**
```sql
id               uuid  PK DEFAULT gen_random_uuid()
program_id       uuid  NOT NULL REFERENCES programs(id) ON DELETE CASCADE
week_number      int   NOT NULL
checkin_form_id  uuid  NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE
UNIQUE (program_id, week_number)
```

**`program_templates`**
```sql
id                     uuid        PK DEFAULT gen_random_uuid()
therapist_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name                   text        NOT NULL
duration_weeks         int         NOT NULL
default_checkin_form_id uuid       REFERENCES check_in_forms(id) ON DELETE SET NULL
created_at             timestamptz NOT NULL DEFAULT now()
```

**`program_template_sessions`**
```sql
id                   uuid  PK DEFAULT gen_random_uuid()
program_template_id  uuid  NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE
template_id          uuid  REFERENCES templates(id) ON DELETE SET NULL  -- null = custom/inline session
week_number          int   NOT NULL
session_name         text  NOT NULL  -- display name; used when template_id is null
created_at           timestamptz NOT NULL DEFAULT now()
```

**`program_template_week_checkins`**
```sql
id                   uuid  PK DEFAULT gen_random_uuid()
program_template_id  uuid  NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE
week_number          int   NOT NULL
checkin_form_id      uuid  NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE
UNIQUE (program_template_id, week_number)
```

### Modified tables

**`prescriptions`** — add 2 nullable columns:
```sql
program_id    uuid  REFERENCES programs(id) ON DELETE SET NULL
week_number   int
```
Both nullable. A prescription with `program_id IS NULL` is a standalone session (existing behavior unchanged).

### Row Level Security

All new tables follow the existing pattern: therapist-owned rows use `therapist_id = auth.uid()`. `program_week_checkins` and `program_template_week_checkins` are accessible via their parent program/template join.

---

## Flows

### Create client program from scratch
1. Prescribe page → "New Program" button → "Create from scratch"
2. Modal: enter name + week count → "Create"
3. Inserts `programs` row (no `start_date` yet)
4. Navigates to `/therapist/programs/:programId`
5. Therapist builds out weeks and sessions
6. "Set Start Date" field on the editor auto-dates all linked prescriptions: `start_date + (week_number - 1) * 7 days`

### Apply program template to a client
1. Prescribe page → "New Program" button → "Apply program template"
2. Modal: pick a program template from list → enter start date → "Apply"
3. Inserts `programs` row with `start_date`
4. For each `program_template_sessions` row:
   - If `template_id` is set: copies exercises from that template into a new prescription (same logic as existing ApplyTemplateModal)
   - If `template_id` is null: creates an empty prescription with `session_name` as the name
   - Sets `program_id`, `week_number`, and `start_date = program.start_date + (week_number - 1) * 7 days`
5. For each `program_template_week_checkins` row: creates a `check_in_instances` row with `period_start_date` = that week's start date
6. If `program_templates.default_checkin_form_id` is set: creates `check_in_instances` for any weeks not covered by per-week overrides
7. Navigates back to Prescribe page

### Create program template from scratch
1. Templates page → "Program Templates" tab → "New Program Template"
2. Inserts `program_templates` row, navigates to `/therapist/program-templates/:templateId`
3. Editor is identical to the client program editor minus the start date field

### Save client program as template
1. Program editor → "Save as Template" button
2. Prompt for template name
3. Inserts `program_templates` row
4. For each prescription linked to the program: inserts a `program_template_sessions` row, referencing the original `template_id` if the prescription was created from a template, otherwise using the prescription name as `session_name`
5. Copies `program_week_checkins` into `program_template_week_checkins`
6. Toast: "Saved as program template"

---

## UI Changes

### Prescribe page (`Prescribe.jsx`)

**Prescribed Sessions tab — single unified list:**
- Programs and standalone sessions render in one list, sorted by `created_at` descending
- Program group: a header row showing program name + week progress (e.g., "Week 3 of 12 · Started Jun 1") with a colored left border, followed by the program's sessions indented beneath it
- Standalone sessions render exactly as today
- No separate section dividers between programs and standalones

**Button row** — replaces existing 3-button row:
- **"New Session"** → inline dropdown: "Create from scratch" | "Apply session template"
  - "Apply session template" = existing ApplyTemplateModal flow
- **"New Program"** → inline dropdown: "Create from scratch" | "Apply program template"

### Templates page (`Templates.jsx`)

Two tabs:
- **"Session Templates"** — existing list and behavior, button relabeled "New Session Template"
- **"Program Templates"** — lists `program_templates` rows with name, week count, session count; button labeled "New Program Template"; clicking a template navigates to `/therapist/program-templates/:templateId`

### Program editor (new page, shared for programs and program templates)

**Routes:**
- `/therapist/programs/:programId` — client program
- `/therapist/program-templates/:templateId` — program template

**Layout:**
- Header: editable name field + week count field + (client programs only) "Set Start Date" field + "Save as Template" button + back arrow
- "Default check-in form" picker at the header level (applies to all weeks unless overridden)
- Week list: one collapsible panel per week
  - Panel header: "Week N" + session count + check-in badge if a form is assigned
  - Expanded panel:
    - Sessions listed with name, frequency, Edit / Remove actions
    - "New Session" button:
      - In client program mode: navigates to `SessionEdit` with `program_id` + `week_number` pre-set (full exercise editor)
      - In program template mode: prompts for a session name only; creates a `program_template_sessions` row with `template_id = null`. Exercises are added when the template is applied to a client.
    - "From Template" button:
      - In client program mode: opens session template picker, creates a prescription linked to program + week
      - In program template mode: opens session template picker, creates a `program_template_sessions` row with `template_id` set
    - "Check-in form" row: dropdown to assign a check-in form for this week (overrides default)

---

## File Map

| Action | Path | Notes |
|--------|------|-------|
| Create | `src/pages/therapist/ProgramEdit.jsx` | Shared editor for client programs and program templates |
| Modify | `src/pages/therapist/Prescribe.jsx` | Unified list, new button dropdowns, program group rendering |
| Modify | `src/pages/therapist/Templates.jsx` | Two tabs, relabeled buttons |
| Modify | `src/App.jsx` | 2 new protected routes |
| Modify | `src/components/therapist/AppSidebar.jsx` | No nav change needed (Programs live under Clients flow) |

---

## Out of Scope

- Client-facing program view (client sees their sessions as today; program grouping is therapist-only for now)
- Program progress tracking / completion percentage
- Reordering weeks or sessions via drag-and-drop
- Copying a week's sessions to another week
