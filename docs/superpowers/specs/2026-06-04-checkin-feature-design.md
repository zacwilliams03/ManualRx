# Check-In Feature Design

**Date:** 2026-06-04
**Status:** Approved for implementation

---

## Context

Therapists currently have no structured way to check in with clients between sessions. They can see session completion data but have no channel for weekly welfare checks — understanding pain levels, concerns, or how a client is feeling. This feature adds a weekly check-in system: therapists build short forms, assign them to clients on a schedule, and clients complete them from their feed. Responses are one-way (client → therapist only).

---

## Architecture

**Approach: Lazy instance creation (no cron job)**

Check-in forms store a schedule (day of week + start date + duration). When a client loads their Dashboard, the app computes whether a new check-in period is due. If a `check_in_instance` row does not yet exist for that period, it creates one at that moment. After creation, all queries operate on instances — simple status lookups for both client and therapist. A "missed" instance is any `pending` instance whose `period_start_date` predates the current period; this is detected at read time, not stored as a separate status.

**Known v1 limitation — therapist Responses tab "Missed" filter:** Because instances are only created when the client visits the Dashboard, a client who never opens the app will never generate instance rows. The Responses tab "Missed" filter will therefore show no entries for absent clients — the gap is invisible to the therapist. A future iteration can address this with a lightweight server-side catch-up (e.g. an Edge Function triggered on therapist login). For v1, this is accepted and the limitation should be visible in the UI via a note or help text on the Missed filter.

**Scope:** Standalone feature — not tied to prescriptions. No therapist notifications on submission (v1).

---

## Data Model

Four new tables. Run as SQL in the Supabase dashboard.

```sql
-- Forms (both templates and client-specific)
-- client_id = null means this is a reusable template
CREATE TABLE check_in_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_template boolean NOT NULL DEFAULT false,
  created_from_template_id uuid REFERENCES check_in_forms(id) ON DELETE SET NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_date date NOT NULL,
  duration_weeks smallint, -- null = indefinite
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Questions within a form (or template)
CREATE TABLE check_in_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('text', 'scale')),
  order_index smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One instance per (form, client, period) — created lazily when client visits Dashboard
CREATE TABLE check_in_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES check_in_forms(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id, client_id, period_start_date)
);

-- One response per completed instance
CREATE TABLE check_in_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL UNIQUE REFERENCES check_in_instances(id) ON DELETE CASCADE,
  answers jsonb NOT NULL, -- { "<question_id>": <"text answer" | 1..5> }
  submitted_at timestamptz NOT NULL DEFAULT now()
);
```

**Notes on schema decisions:**
- `check_in_responses.client_id` is omitted — it is derivable via `instance_id → check_in_instances.client_id` and storing it would introduce a consistency risk. All RLS and queries reach client context through the instance join.
- The UNIQUE constraint `(form_id, client_id, period_start_date)` ensures exactly one instance per client per form per period, and correctly handles future cases where two clients could share a `form_id`.

### RLS Policies

```sql
-- check_in_forms
-- Therapist: full access to own forms
CREATE POLICY "therapist_own_forms" ON check_in_forms
  FOR ALL USING (therapist_id = auth.uid());

-- Client: read-only access to their assigned form
CREATE POLICY "client_read_own_form" ON check_in_forms
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- check_in_questions
-- Therapist: full access via form ownership
CREATE POLICY "therapist_own_questions" ON check_in_questions
  FOR ALL USING (
    form_id IN (SELECT id FROM check_in_forms WHERE therapist_id = auth.uid())
  );

-- Client: read-only access to questions on their assigned form
CREATE POLICY "client_read_own_questions" ON check_in_questions
  FOR SELECT USING (
    form_id IN (
      SELECT id FROM check_in_forms
      WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

-- check_in_instances
-- Therapist: read own clients' instances
CREATE POLICY "therapist_read_instances" ON check_in_instances
  FOR SELECT USING (
    form_id IN (SELECT id FROM check_in_forms WHERE therapist_id = auth.uid())
  );

-- Client: read + insert own instances
CREATE POLICY "client_own_instances" ON check_in_instances
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- check_in_responses
-- Therapist: read responses for own clients
CREATE POLICY "therapist_read_responses" ON check_in_responses
  FOR SELECT USING (
    instance_id IN (
      SELECT i.id FROM check_in_instances i
      JOIN check_in_forms f ON f.id = i.form_id
      WHERE f.therapist_id = auth.uid()
    )
  );

-- Client: read + insert own responses
CREATE POLICY "client_own_responses" ON check_in_responses
  FOR ALL USING (
    instance_id IN (
      SELECT i.id FROM check_in_instances i
      WHERE i.client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );
```

---

## Feature Areas

### 1. Therapist: Check-Ins Page (`/therapist/checkins`)

New page in the therapist sidebar, tab-based (matches `History.jsx` pattern).

**Responses tab (default)**
- Filter chips: All / Pending / Completed / Missed
- "Missed" chip includes a tooltip or inline note: *"Only shown for clients who have visited the app since the check-in was due."*
- List rows showing: client name, form name, week number, period date, status badge (Completed in teal · Pending in amber · Missed in red)
- Week number computed in JS as: `Math.floor((periodStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1`
- Completed rows have a "View" button that expands inline to show the response detail
- Response detail: each question with its answer. Scale questions render 1–5 pips with the selected value highlighted. Text questions show the written answer as a text block.
- v1 has no pagination — acceptable at current scale; add a 100-row limit to the query to prevent unbounded scans.

**Templates tab**
- List of `check_in_forms` where `is_template = true` for this therapist
- Each row: template name, question count, "Used by N clients" count, Assign + Edit buttons
- "Assign" copies the template (deep copy: form row + all question rows) to a new client-specific form and opens `CheckInEdit` pre-populated
- "New Template" button at bottom opens `CheckInEdit` with `is_template = true` pre-set

**Nav:** Add "Check-Ins" link to `AppSidebar.jsx` after the Exercise Library item and before the bottom Settings zone. Use an appropriate Lucide icon (e.g. `ClipboardList`).

---

### 2. Therapist: Form Builder (`/therapist/checkins/new`, `/therapist/checkins/:formId`)

Single page `CheckInEdit.jsx`. Sections from top to bottom:

1. **Form details** — name input + "Save as template" pill toggle (when toggled on, hides the "Assign to client" section)
2. **Assign to client** — client dropdown (hidden when `is_template = true`); summary line at the very bottom of the page: *"This form will appear in [Name]'s feed every [Day], starting [Date]."*
3. **Questions** — ordered list of question cards, each showing type badge (Written in blue, 1–5 Scale in teal), question text, scale preview dots (for scale type) or placeholder textarea (for text type). Move up/down buttons + Remove. Two add-question buttons: `+ Written question` and `+ 1–5 Scale question`
4. **Schedule** — day-of-week select + start date picker on one row; duration input (number of weeks) + "Indefinite" toggle button on the next row
5. **Save button** at the bottom (above the summary line)

When adding a question, an inline form appears: question text input + type selector (pre-set by which button was pressed, but switchable before confirming).

---

### 3. Client: Dashboard Feed Integration

`Dashboard.jsx` gains a lazy-creation step before rendering. This step runs in parallel with the existing prescriptions fetch and should not block the UI — render a loading state for check-in cards independently, so a failure here does not affect session cards.

**Period calculation algorithm (JS):**
```js
function getCurrentPeriodStartDate(form) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(form.start_date)
  startDate.setHours(0, 0, 0, 0)

  if (startDate > today) return null // form hasn't started yet

  // Walk forward from start_date by 7-day increments until the next period would exceed today
  let periodStart = new Date(startDate)
  // Align to the correct day_of_week on or after start_date
  const daysUntilTarget = (form.day_of_week - startDate.getDay() + 7) % 7
  periodStart.setDate(periodStart.getDate() + daysUntilTarget)

  if (periodStart > today) return null // first scheduled occurrence is in the future

  // Advance by 7 days until the next occurrence would be in the future
  while (true) {
    const next = new Date(periodStart)
    next.setDate(next.getDate() + 7)
    if (next > today) break
    periodStart = next
  }
  return periodStart
}
```

**Lazy creation flow:**
```
1. Fetch active check_in_forms for this client (where client_id = clientRecord.id)
2. For each form, call getCurrentPeriodStartDate(form)
   - If null: skip
3. For each form with a valid period: INSERT into check_in_instances
   ON CONFLICT (form_id, client_id, period_start_date) DO NOTHING
   Verify affected row count — if 0 (conflict) that's fine; if null/error, log and continue
4. Fetch all pending check_in_instances for this client (status = 'pending')
5. Render pending instances as check-in cards above session cards
```

**Error handling:** If the fetch or upsert in steps 1–3 fails, render no check-in cards and show no error to the client (silent degradation). Log the error to the console for debugging. The session cards continue to render normally.

**Check-in card** — visually distinct from session cards:
- Amber/gold border (`rgba(245,158,11,0.25)`) and amber shimmer line
- `✦ CHECK-IN` pill badge in amber
- Form name + question count + "~1 min" estimated time
- Full-width amber "Complete Check-In →" button

Check-in cards render **above** session cards in the feed.

---

### 4. Client: Check-In Completion (`/client/checkin/:instanceId`)

New page `CheckInWizard.jsx`.

**Missed check-in prompt:** On load, query for pending instances for this form where `period_start_date < this instance's period_start_date`, ordered by `period_start_date DESC`, limit 1 (most recent missed only — older gaps are silently skipped). If found, show a red warning banner: *"You missed your check-in for [date]. Would you like to complete that first?"* with "Complete [date] first" and "Skip" buttons. "Complete first" navigates to that instance's route. "Skip" dismisses the banner and proceeds.

Multiple consecutive misses are handled by capping the prompt to one at a time. After completing the most recent missed one, the client is returned to the Dashboard and can tap through to the current check-in, where any remaining older missed ones are similarly shown one at a time.

**Form body:**
- Form name + "Week of [date] · N questions" subtitle
- For each question in `order_index` order:
  - **Scale:** Five circular buttons (1–5), tapping selects. Fixed end labels in v1: `"1 – Not good"` on the left, `"5 – Very good"` on the right (no per-question custom labels — a future iteration can add these)
  - **Text:** Textarea with "Write your answer here…" placeholder
- Submit button — disabled until all questions have an answer. On submit:
  1. Insert `check_in_responses` row: `{ instance_id, answers: { [questionId]: value, ... } }`
  2. Update `check_in_instances.status = 'completed'` for this instance
  3. Navigate back to Dashboard with a success toast: *"Check-in submitted."*

---

### 5. Therapist: Client History Integration (`Prescribe.jsx`)

On the `Prescribe.jsx` client history view, completed check-in responses are merged into the session log timeline.

**Fetch:** In parallel with the existing session logs query, fetch:
```js
supabase
  .from('check_in_responses')
  .select(`
    id, submitted_at, answers,
    check_in_instances!inner(
      period_start_date, form_id,
      check_in_forms!inner(name, check_in_questions(id, question_text, question_type, order_index))
    )
  `)
  .eq('check_in_instances.client_id', clientRecord.id)
  .order('submitted_at', { ascending: false })
```

**Unified timeline entry shape** (normalised before sorting):
```js
// Session log entry
{ type: 'session', date: log.completed_at, data: log }

// Check-in entry
{
  type: 'checkin',
  date: response.submitted_at,
  data: {
    formName: response.check_in_instances.check_in_forms.name,
    periodStartDate: response.check_in_instances.period_start_date,
    answers: response.answers,    // { questionId: value }
    questions: response.check_in_instances.check_in_forms.check_in_questions,
  }
}
```

Sort merged array by `date` descending. Render check-in entries with a `✦ Check-In` label, the form name, submitted date, and an expand/collapse toggle that reveals each question + answer in the same layout as the Check-Ins page detail view.

---

## Routing

```
/therapist/checkins              → CheckIns.jsx (Responses tab)
/therapist/checkins/new          → CheckInEdit.jsx (create)
/therapist/checkins/:formId      → CheckInEdit.jsx (edit)
/client/checkin/:instanceId      → CheckInWizard.jsx (complete)
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/pages/therapist/CheckIns.jsx` | Responses + Templates tabs |
| `src/pages/therapist/CheckInEdit.jsx` | Form builder / editor |
| `src/pages/client/CheckInWizard.jsx` | Client completion page |

## Modified Files

| File | Change |
|------|--------|
| `src/components/therapist/AppSidebar.jsx` | Add Check-Ins nav item after Exercise Library |
| `src/App.jsx` | Add 4 new routes |
| `src/pages/client/Dashboard.jsx` | Lazy instance creation + check-in cards in feed |
| `src/pages/therapist/Prescribe.jsx` | Merge check-in responses into client history timeline |

---

## Active Form Logic

A `check_in_form` is "active" if:
- `duration_weeks IS NULL` (indefinite), OR
- `start_date + (duration_weeks * 7 days) > today`

Only active forms trigger lazy instance creation on the client Dashboard.

---

## Known v1 Gaps

| Gap | Impact | Future fix |
|-----|--------|-----------|
| Missed instances only exist if client visited the app | Therapist Responses "Missed" filter is incomplete for absent clients | Edge Function catch-up on therapist login |
| No pagination on Responses tab | Slow at scale; mitigated by 100-row query limit | Add date-range filter + pagination |
| Scale end labels are fixed ("Not good / Very good") | Labels may not match every question's meaning | Per-question label configuration |

---

## Verification

1. **Create a template:** Go to `/therapist/checkins` → Templates tab → New Template. Add a scale question and a text question. Save. Confirm it appears in the Templates list with correct question count.
2. **Assign to a client:** Click Assign on the template. Confirm the form editor opens pre-populated. Set start date to today, day-of-week to today's day, indefinite. Save. Confirm the form appears in Responses tab as Pending for that client.
3. **Client sees check-in:** Log in as the client. Confirm a check-in card appears above session cards in the feed with the amber styling distinct from session cards.
4. **Complete a check-in:** Tap the check-in card. Answer all questions (confirm Submit stays disabled until all answered). Submit. Confirm Dashboard no longer shows the card, and the Responses tab shows it as Completed.
5. **View response:** On the Check-Ins page, click View on the completed response. Confirm scale answers show the correct pip highlighted and text answers display correctly.
6. **Missed prompt:** In the Supabase dashboard, back-date an existing pending instance's `period_start_date` by 7 days and insert a new pending instance for the current period. Open the current instance as the client — confirm the missed banner appears showing the older date, with "Complete [date] first" and "Skip" options.
7. **Client history:** On the Prescribe page for that client, confirm the completed check-in appears in the history timeline with `✦ Check-In` label and expands to show answers.
8. **Session cards unaffected:** Confirm that if the check-in fetch/upsert fails (simulate by temporarily breaking the query), session cards still render normally.
