# Project Context — ManualRx
> Paste this file into every new Claude/Claude Code session before asking for help.
> Keep it updated as the project evolves.

---

## App Name

**Status: DECIDED — ManualRx**
- Domain: manualrx.app (register immediately if not yet done; also check manualrx.com)
- GitHub repo: rename from `prescriptr` → `manualrx` (github.com/zacwilliams03/prescriptr → Settings → General)
- Supabase project: rename to ManualRx (cosmetic only)
- Vercel project: rename to manualrx, add manualrx.app domain
- Supabase Auth URLs: Site URL → https://manualrx.app; Redirect URLs → add https://manualrx.app/reset-password


---



A web-based exercise prescription platform built specifically for **massage therapists and manual therapists**. It has two distinct interfaces — one for the therapist and one for the client — and is designed to be sold as a SaaS product to real clinics and solo practitioners.

---

## The Two Interfaces

### Therapist Interface
- Search a built-in exercise library (with video demonstrations)
- Add exercises to a client's program
- Upload their own exercise videos (stored in a personal library they can reuse)
- Write therapist notes on each prescribed exercise
- Manage multiple clients

### Client Interface
- View exercises prescribed to them by their therapist
- Watch the exercise video for each exercise
- Log completed reps/sets
- Write optional notes when completing an exercise (e.g. "felt pain on rep 3")

---

## Core Features (MVP)

1. **Dual-role authentication** — therapist and client accounts with separate permissions
2. **Exercise library** — searchable, each exercise has a built-in video, description, and default reps/sets
3. **Custom video upload** — therapists can upload their own videos, saved to a personal library for reuse across clients
4. **Exercise prescription** — therapist assigns exercises from the library (or their own library) to a specific client
5. **Rep/set logging** — client logs completions per exercise
6. **Notes fields** — one for the therapist (visible to client), one for the client (filled in on completion)

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | React | Web app, mobile-responsive |
| Backend/Database | Supabase | Auth, PostgreSQL database, file storage |
| Hosting | Vercel | Connected to GitHub, auto-deploys |
| Video (built-in library) | Cloudflare Stream or Bunny.net | Cheap, fast video CDN |
| Video (therapist uploads) | Supabase Storage | Fine for MVP |
| Payments (later) | Stripe | Subscription billing |
| Version control | GitHub | All code lives here |

---
## Client Onboarding & Access Model

### Decision: invite-based signup, not code-only access

Therapists invite clients into the platform. Clients have real accounts (email + password) but their access is gated by the therapist's subscription.

### Flow
1. Therapist enters client details: name, email, (optionally DOB)
2. System creates a pending invite record with a unique single-use code
3. Therapist shares either a link (`manualrx.app/join/AB12CD`) or the raw code
4. Client opens the link or enters the code on a `/join` page
5. Client sets a password → account created with `role: 'client'`, linked to the inviting therapist
6. Invite code is consumed (cannot be reused)
7. From then on, the client logs in with email + password at the same `/login` page

### Why not code-only access
- No account recovery if code is lost
- Code becomes a permanent credential that can leak
- No email = no way to send reminders or password resets
- Industry pattern (Rehab My Patient, SimpleSet, etc.) uses real accounts

### Paywall model
- Therapist pays subscription
- Clients access free, but only because their therapist is paying
- If therapist cancels, their clients lose access
- Same login page for both roles; routing decides destination based on `users.role`

### Client features (MVP)
What clients can do once logged in:
- View exercises prescribed to them
- Watch the video for each exercise
- Log reps/sets/weight completed per exercise
- Add a note per exercise
- Rate pain per exercise on a **0–10 NPRS** (Numerical Pain Rating Scale) — standard clinical scale
- Rate session **RPE on Borg CR-10** (0–10) — standard for exercise intensity
- Add a final note for the whole session

### New database tables needed
- **client_invites** — id, therapist_id, code (unique, indexed), email, name, dob (nullable), created_at, consumed_at (nullable), expires_at
- **exercise_logs** already exists — needs additional columns: weight_completed, pain_rating (0–10), exercise_notes (rename of client_notes if needed)
- **session_logs** (new) — id, prescription_id, client_id, completed_at, session_rpe (0–10), session_notes
  (One session_log per "I did my exercises today" event, with multiple exercise_logs linked to it)

### Open privacy/compliance questions
- DOB is health-adjacent PII — do we actually need it for MVP? Defer if not.
- Privacy Act (AU) and HIPAA (US, if selling there) treat exercise + pain + identity as health info
- Need a privacy policy before launch
- Need to decide: where does data live (Supabase Sydney = AU only currently — good for AU customers, may need US region for US customers)


## Database Structure (current — as built)

### Tables
- **users** — id, email, role (therapist / client), name, created_at
- **therapist_profiles** — user_id, clinic_name, logo_url, branding_color, has_onboarded (bool, default false), weight_unit (text, default 'kg'), default_frequency_days (integer)
- **clients** — id, therapist_id, user_id, name, email, created_at, weight_unit (text, default 'kg')
- **client_invites** — id, therapist_id, code (unique), email, name, created_at, consumed_at (nullable), expires_at
- **exercises** — id, name, description, category, video_url, thumbnail_url, is_custom, created_by (null if built-in), default_sets, default_reps, fts (tsvector, generated), created_at
- **therapist_video_library** — id, therapist_id, exercise_id, video_url, label, created_at
- **templates** — id, therapist_id, name, category (nullable text, free-form tag e.g. "Rotator Cuff"), created_at. RLS: therapist_id = auth.uid()
- **template_exercises** — id, template_id (FK → templates, CASCADE), exercise_id (FK → exercises), sets, reps, weight (nullable numeric, canonical kg), therapist_notes, created_at. RLS: template_id IN (SELECT id FROM templates WHERE therapist_id = auth.uid())
- **prescriptions** — id, therapist_id, client_id, name, frequency_days (nullable integer), start_date (date, nullable), duration_weeks (integer, nullable), created_at, notes
- **prescription_exercises** — id, prescription_id, exercise_id, sets, reps, weight (nullable numeric), frequency, therapist_notes, order
- **session_logs** — id, prescription_id, client_id, completed_at, session_rpe (0–10), session_notes
- **exercise_logs** — id, prescription_exercise_id, client_id, session_log_id (FK to session_logs), completed_at, sets_completed, reps_completed (nullable — deprecated, null on new logs), weight_completed (nullable — deprecated, null on new logs), pain_rating (0–10), client_notes, video_url, sets_data (JSONB — array of `{reps, weight}` per set; use this for all new logs)
- **dashboard_dismissed_alerts** — id, therapist_id (FK → auth.users, CASCADE), alert_type (text, CHECK IN ('overdue', 'program_complete')), prescription_id (FK → prescriptions, CASCADE), dismissed_at (timestamptz, default NOW()). RLS: therapist_id = auth.uid(). UNIQUE (therapist_id, alert_type, prescription_id). Used by the therapist dashboard NeedsAttentionCard to persist dismissed alerts across sessions.

### Key patterns
- `prescriptions.frequency_days`: null = no repeat, 1 = daily, 7 = weekly, N = custom
- `exercises.is_custom = true` + `created_by = therapist UUID` for custom exercises
- `clients.user_id` = auth UID of the client (set when they claim their invite)
- RLS on all tables. Therapists see only their own clients/prescriptions. Clients see only their own data.
- **Avoid using `.order('order', ...)` in Supabase JS** — `order` is a reserved SQL keyword and causes silent query failures
- **After any ALTER TABLE, run `NOTIFY pgrst, 'reload schema';`** to refresh PostgREST schema cache
- **`exercise_logs.client_id` is a FK to `clients.id`** — NOT `auth.uid()`. When inserting exercise_logs from the client, you must look up `clients.id` where `user_id = auth.uid()` and use that. Passing `auth.uid()` directly will fail with an RLS violation. `session_logs.client_id` stores `auth.uid()` directly — these two tables are inconsistent; don't assume they follow the same pattern.
- **`sets_data` JSONB column** stores per-set actuals as `[{reps: "10", weight: "20"}, ...]`. `sets_completed` = array length. `reps_completed` and `weight_completed` are deprecated (null on new logs) — use `sets_data` for all new logging. The history display falls back to the old aggregate fields when `sets_data` is null (for logs created before Session 9).

---

## Auth & Roles

- Supabase Auth handles login/signup
- Two roles: `therapist` and `client`
- Therapists can see and manage their own clients only
- Clients can only see their own prescribed exercises
- Row Level Security (RLS) enforced at the database level in Supabase

---

## Design Direction

- **Audience:** Health professionals — needs to feel clean, trustworthy, and clinical without being cold
- **Tone:** Refined, calm, professional. Think: a well-designed physio clinic, not a gym app
- **Key UX principles:**
  - Therapist side: fast to use, minimal clicks to prescribe an exercise
  - Client side: extremely simple, can't get confused, video is front and centre
- **Mobile:** Client interface must work well on phone (clients will use it at home)
- **Branding:** Neutral enough that clinics can add their own logo/colour later (white-label feature planned)

---

## Monetization (planned)

| Plan | Price | Includes |
|---|---|---|
| Solo | $29/month | 1 therapist, unlimited clients |
| Clinic | $70/month | Up to 5 therapists, shared custom library |
| Practice | $120/month | Unlimited therapists, analytics, white-label |

Annual billing at 20% discount. Stripe handles subscriptions.

---

## Competitors (for context)

- **Rehab My Patient** — ~£11/month, physio-focused, strong UK/AU market
- **SimpleSet** — ~$20-40/month, clean UI, not massage-specific
- **My Rehab Connection** — $14/month, basic, patient mobile app
- **Phydeo** — custom video focused, no built-in library
- **Wibbi** — enterprise, 20,000+ exercises, expensive

**Our edge:** First tool built specifically for massage/manual therapists. Simpler, cleaner, and more focused than the physio tools.

---

## Competitor Feature Gap Analysis

> Researched May 2026. Sources: Rehab My Patient, SimpleSet, Physitrack, TrueCoach.
> Purpose: track what the market has that ManualRx does not, and prioritise accordingly.

---

### What ManualRx has that competitors lack
- Built specifically for massage/manual therapists (all competitors are physio/OT-first)
- Simpler, more focused UX — not trying to be an EMR
- Per-set logging with JSONB storage (granular beyond most competitors)
- Feedback video upload per exercise (client films themselves)

---

### Gaps by priority

#### High — therapists will notice the absence

**1. Session/program templates**
Rehab My Patient and SimpleSet both let therapists save a group of exercises as a reusable template for a condition or patient type. In ManualRx every session is built from scratch. For a therapist treating 10 clients with similar presentations this is a real time cost. Most requested missing feature in SimpleSet reviews.

**2. PDF / print export of the exercise program**
Rehab My Patient allows therapists to email or print the exercise plan. Some clients — particularly older ones — want a printed sheet. No export option excludes that segment. Also useful when a client loses phone access.

**3. In-app messaging (therapist ↔ client)**
TrueCoach and SimpleSet (user-requested) both support direct messaging. Currently there is no way for a client to ask a question or a therapist to send a follow-up without going outside the app. Not a dealbreaker at MVP but becomes a retention problem as therapists rely on the tool daily.

**4. Client progress / adherence visibility**
SimpleSet and Physitrack show clients their adherence trends and pain score history over time. In ManualRx clients can log sessions but have no summary view — no "8 of 12 sessions completed this month", no pain trend chart. This is the primary engagement driver on the client side. Without it the client interface is a task list, not a tool.

---

#### Medium — can ship without, but matter for retention

**5. Outcome measures / PROMs**
SimpleSet and Physitrack support validated Patient-Reported Outcome Measures (e.g. Oswestry, DASH, PSFS) — standardised clinical questionnaires therapists use to measure progress objectively. Manual therapists do use these. Not fatal to omit, but a visible gap vs. established tools.

**6. Therapist mobile app**
Physitrack's mobile app lets clinicians prescribe and review client programs hands-free in a clinical setting. ManualRx's therapist interface is desktop-first (intentionally, for now). In practice, therapists often want to pull up a client program on their phone mid-session. Listed as lower priority in project status — keep it there for now, but revisit after Stripe.

**7. Practice management / EMR integration**
SimpleSet has one-click charting that syncs to EMR notes. Physitrack integrates with Jane App, Cliniko, Zanda, CorePlus, and others. Many AU therapists already use Jane App or Cliniko. No integration means an extra login and an extra tool, which increases churn risk at the clinic tier.

---

#### Low — not relevant to ManualRx's positioning

**Telehealth / video calls** — Physitrack has it. Not applicable to massage therapy workflows. Skip.

**Native iOS/Android apps** — Competitors have them. Responsive web is fine for now. Revisit at scale.

**Full EMR / clinical notes** — Moves ManualRx into regulated health records territory. Increases compliance surface area significantly. Do not build until compliance questions (HIPAA, AU Privacy Act) are resolved and customer research confirms demand.

---

### Build order recommendation (based on impact vs. complexity)

| Priority | Feature | Complexity | Notes |
|---|---|---|---|
| 1 | Session templates | Low | UI + DB only, no new compliance issues |
| 2 | Client progress/adherence view | Low–Medium | Uses data already in DB (session_logs, exercise_logs) |
| 3 | PDF export | Medium | ✅ DONE (Session 28) |
| 4 | In-app messaging | Medium–High | New table, real-time or polling, moderation considerations |
| 5 | PROMs | High | Clinical validation required, compliance implications |
| 6 | EMR integrations | High | Deferred until post-revenue |

---

### Compliance note (client notes / clinical records)
A therapist-facing "client notes" page (free-text clinical observations) would cross into health record territory under AU Privacy Act and US HIPAA. Competitors have it, but it meaningfully increases legal obligations (data retention, right of access, breach notification). Do not build before compliance questions are resolved. Exercise prescription data (pain ratings, RPE, session logs) is already health-adjacent — a dedicated clinical notes field is a harder line.

## Project Status

- [x] Accounts created: GitHub, Supabase, Vercel
- [x] Claude Code installed and working
- [x] App name decided: ManualRx ✅ final
- [x] Project context document created
- [x] Repo created on GitHub
- [x] Supabase project created
- [x] Base React app scaffolded
- [x] Database tables created and RLS enabled
- [x] Auth (login/signup) working
- [x] Client invite flow (therapist invites, client joins via link)
- [x] Exercise library (browse, search, filter, detail view)
- [x] Custom exercise video upload (Supabase Storage)
- [x] Prescription / session flow (therapist creates sessions, assigns exercises)
- [x] Client session completion — step-by-step wizard (sets/reps/weight/pain/effort/notes + optional feedback video upload per exercise)
- [x] Therapist session history — inline history panel on Prescribe page, per-session log with exercise breakdown and video playback
- [x] Client dashboard completed badge
- [x] Per-set exercise logging — client steps through each prescribed set individually; data stored as JSONB array
- [x] Therapist History tab — redesigned as "Session History" with collapsible summary rows (session name, date, RPE); click to expand full exercise detail
- [x] Session wizard UX improvements — prescribed target card, prefilled placeholders, reps/weight input order corrected
- [x] Session delete — therapists can delete prescriptions with full cascade (prescription_exercises, session_logs, exercise_logs)
- [x] Client exercise visibility — clients can now see exercise names and videos in the wizard
- [x] Mobile polish pass (client side) — iOS input zoom fix, 44px touch targets, dvh viewport, safe area insets
- [x] Therapist persistent nav — replaced with dark fixed-left sidebar (see Session 31)
- [ ] Video content for built-in exercise library (decision pending)
- [ ] Stripe integration
- [x] Password reset / email flows
- [ ] Therapist mobile polish pass (separate, lower priority)
- [x] App deployed to Vercel at www.manualrx.com
- [x] Fix client login bug (disabled email confirmation in Supabase — Session 15)
- [x] Automatic invite email — Resend + Supabase Edge Function built and deployed (Session 15). ⚠️ Needs end-to-end test once Resend domain verification completes for manualrx.com
- [x] Therapist onboarding flow — one-time /onboarding page shown after signup (Session 16)
- [x] Therapist settings page — permanent /settings page accessible from nav (Session 16)
- [x] Account consolidated into Settings for both roles — therapist Settings includes change-password section; /account removed from therapist nav
- [x] Client session history page — /client/history shows all completed sessions with collapsible exercise detail
- [x] Functional kg/lb weight unit conversion — weights stored canonically in kg; display converts to viewer's preferred unit for both therapist and client across all pages
- [x] Invite email uses therapist first name only (not full name) in both subject line and body
- [x] Video attachment indicator in session builder — exercises with a video show "Video attached" in grey during search, category browse, and configure view; added exercises show the full video player inline
- [x] Reusable session templates — Templates tab in nav; therapists create/edit/delete named exercise programs with optional category tag; ExercisePicker extracted as shared component (used by SessionEdit and TemplateEdit); Apply Template modal on Prescribe page with search + category filter pills; applying creates a fresh prescription, template is never modified
- [x] Prescription duration + active/inactive state — `start_date` and `duration_weeks` added to prescriptions; `duration_weeks` added to templates as a default; active/inactive derived client-side (+7 grace period); inactive cards shown dimmed with Inactive badge + Reactivate button (duplicates prescription with today as new start_date, navigates to SessionEdit); clients only see active prescriptions; applying a template copies its duration_weeks + sets start_date = today
- [x] PDF export — therapist can download a PDF of any prescription; "Download PDF" button on each session card; client-side generation via `@react-pdf/renderer`; lazy-fetches exercise data on click; filename sanitised; loading + error state per card; clinic name branding (falls back to "ManualRx"); weight in therapist's unit; bodyweight exercises shown as "Bodyweight"
- [x] Marketing homepage — dark-theme, 7-section landing page at `/` route (`src/pages/HomePage.jsx`); DM Serif Display headings, Lenis smooth scroll, Framer Motion animations with `prefers-reduced-motion` support; Logo Option 1 (F1 Bar) implemented; sections: Nav, Hero, Features, How It Works, Pricing, CTA Banner, Footer
- [x] Static red flag safety disclaimer — muted `text-xs` line at the bottom of every per-exercise step in `SessionWizard`: "Stop and seek medical advice if you experience sudden severe pain, chest pain, or dizziness."
- [x] High pain rating gate — when client rates pain ≥ 7/10, amber warning box appears in `SessionWizard` after the ScaleSelector with an "I understand, continue anyway" checkbox; Next button disabled until acknowledged; acknowledgement resets on each step change
- [x] Clinic branding — logo upload in Settings and onboarding flow; clinic logo + name displayed in client session header (Session 35)
- [x] AppSidebar visual refresh — teal gradient background (`rgba(41,181,204,0.05)` → `#0e1117`), 2px teal left-border active indicator, `rgba(41,181,204,0.12)` teal-tinted dividers (Session 36)
- [x] ParticleBackground component — `src/components/ParticleBackground.jsx`; reusable canvas 2D particle animation; `spawnFromTop` prop (false = particles rise from bottom for dashboard, true = particles fall from top for homepage hero); `position` prop ('fixed' default vs 'absolute' for contained sections); respects `prefers-reduced-motion` (Session 36)
- [x] Therapist dashboard rebuilt — full rewrite of `src/pages/therapist/Dashboard.jsx`; **AdherenceCard**: 14-day dot grid per active client (done/missed/pending slots, adherence %), See all/collapse; **NeedsAttentionCard**: overdue alerts (≥2 consecutive missed slots), program-complete detection, dismiss-to-DB via `dashboard_dismissed_alerts` upsert with AnimatePresence exit animation; **ActivityFeedCard**: last 10 sessions with RPE badge (≤6 teal/≥7 amber) and pain badge (0–4 teal/5–7 amber/8–10 red); single prescriptions fetch shared by first two cards (Session 36)
- [x] Full therapist UI redesign — all therapist-side pages (Clients, Templates, ExerciseLibrary, ExerciseUpload, ExerciseDetail, Prescribe, SessionEdit, TemplateEdit, Settings, Onboarding) updated to glass card design language with shared `PageHero`, `CARD`/`SHIMMER`/`SECTION_LABEL` constants from `styles.js`, confined hero-zone particles, and Framer Motion page + list animations (Session 37)
- [x] ExercisePicker glass redesign — `src/components/therapist/ExercisePicker.jsx` restyled to glass card with shimmer, matching inputs and section label; used in SessionEdit and TemplateEdit (Session 37)
- [x] Dashboard active client count highlighted — "N active clients" text in DashboardHeader now uses `#29B5CC` in both the alerts-present and all-clear states (Session 37)

---

---

## Open Questions / Decisions To Make

- ~~What to name the app~~ → **ManualRx** — final decision, Session 13
- **Primary customer:** Individual therapists vs clinic owners — needs more research before marketing decisions
- Where to source the initial built-in exercise video library
- Whether to build native mobile apps later or stick with a mobile-responsive web app
- HIPAA/privacy compliance requirements (important for selling to US clinics)
- Trademark registration for ManualRx — file in AU first, then US before any US expansion
- HIPAA/privacy compliance requirements (important for selling to US clinics)

Exercise Content — Research & Decision Log
Options Considered
Option 1: Exercise Animatic Ultimate Bundle
One-time purchase (~$329 on sale). 2,400+ animated 3D exercise videos, lifetime commercial license, logo branding included, future releases included.
Pros:

One-time cost, no ongoing licensing fees
Professional, consistent visual style across all videos
Logo branding included — looks polished from day one
Delivered within 4 business days
Future releases included free (though logo encoding costs extra per batch)

Cons:

Gym-focused library. Your audience is massage/manual therapists — the relevant content (cervical stretches, nerve mobilisations, postural rehab, rotator cuff, neural flossing etc.) exists but is a subset, not the core. You're paying for a lot of irrelevant content
Locked visual style — you cannot commission new exercises later unless Exercise Animatic releases them. If you need a specific exercise that doesn't exist in their library, you're stuck or forced to mix visual styles
No alternative found with equivalent quality and commercial licensing, so if you outgrow this library you'd need to rebuild the content layer entirely
No refunds on digital products


Option 2: Film exercises yourself
Pros:

Complete control — film exactly what manual therapists need, no irrelevant content
Unlimited expandability — add any exercise at any time
Authentic and specific to your niche — could be a genuine differentiator vs competitors using generic gym animations
Consistent style as long as you maintain production consistency

Cons:

Significant time investment upfront and ongoing
Production quality requires decent equipment, space, and editing
Scales poorly early on — not viable for launch, only realistic as a long-term content strategy
You become a content production operation, not just a software business


Option 3: YouTube video links
Pros:

Zero cost and zero production effort
Instantly available — no waiting, no purchases
Massive variety — virtually any exercise exists on YouTube already
Easy to expand the library at any time by adding new links

Cons:

You don't control the content — videos can be deleted, made private, or changed at any time with no warning, breaking prescriptions silently
No branding — clients are watching someone else's channel, not your product
Ads — YouTube serves ads on videos, including competitor ads. You have no control over what plays before or during the exercise
Off-platform experience — clicking out to YouTube breaks the clinical feel of the product and the seamless UX you're building
Reliability risk — a therapist's prescribed exercise disappearing because a YouTuber deleted their video is a product failure, not a user error
Potential licensing grey area if you're embedding and monetising a SaaS product around free YouTube content


Current Status
No decision made. Building with placeholder/seed data in the interim so development is not blocked.
Recommendation to revisit
Decision should be driven by what the first real therapist customers say they need. If the exercise list for manual therapy is narrow and well-defined (likely), filming them yourself over time may be the most defensible long-term strategy, with Exercise Animatic as a stopgap for launch.Sonnet 4.6

## Feature Backlog

### Pre-Launch (must ship before going live)

**1. Clinic branding (therapist logo on client-facing pages)**
Show therapist's clinic name and logo in the client exercise view header.
- Add `logo_url` column to `therapist_profiles`
- Add logo upload to Settings page (Supabase Storage, same pattern as
  exercise video uploads)
- Display `clinic_name` + `logo_url` in client prescription/exercise
  view header. Therapist profile already accessible via
  `prescriptions.therapist_id`
- No theme system — image + name display only
- Skip cropping; accept any image, display at fixed size
~Half day.

---

### Post-Launch

**3. SMS Integration (Twilio)**
Replace/supplement email with SMS for client invites and exercise
reminders. Email gets lost — SMS open rates are significantly higher.

Scope:
- Add optional `phone` field to Add Client form
- Build `send-invite-sms` Supabase Edge Function via Twilio — same
  pattern as `send-invite-email`. Message: "[TherapistName] has shared
  an exercise program with you: manualrx.app/join/{code}"
- Build `send-reminders` scheduled Edge Function (pg_cron) — daily SMS
  to clients with active prescriptions, stored phone number, and
  reminder enabled
- Add `reminder_time` (time) and `reminder_enabled` (bool) to `clients`
  table
- Fallback: phone exists → SMS; no phone → existing Resend email flow
- Cost: ~AUD $0.08–0.12/SMS via Twilio. Absorb at launch volume.
- Dependencies: Twilio account. Secrets needed in Supabase:
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

**4. Therapist alert on high pain**
If a client logs pain ≥ 7/10 (`exercise_logs.pain_rating`), send the
therapist an SMS or email: "[Client Name] reported a pain rating of
8/10 today." Requires edge function trigger on `exercise_logs` insert.
Defer until therapist feedback confirms demand.

**5. Outcome Measures / PROMs**
Validated questionnaires (Oswestry, DASH, PSFS) assigned by therapists
to measure progress objectively. Visible gap vs SimpleSet and Physitrack
but not essential for massage/manual therapy niche at launch. Revisit
post-validation.

**6. Practice Management Integrations**
Cliniko, Jane App, Nookal, Zanda. Not realistic until ManualRx has an
established clinic customer base. Requires OAuth/API partnership with
each platform. Long-term only.

## Branding

### Status
Colour palette **decided** (Sessions 31–32 — full dark sweep). Typography **decided** (Session 18). Logo and favicon not yet done.

### Decisions locked

**Colour palette — Dark theme (near-black + teal accent)**

The entire app — therapist UI, client UI, auth pages, and homepage — uses a unified dark theme. The old "Slate Navy + Bright Teal" light palette (decided Session 18) was superseded in Sessions 31–32.

**App UI** — `dark.*` tokens in `tailwind.config.js` under `theme.extend.colors.dark`:

| Role | Hex | Tailwind token |
|---|---|---|
| Page background | `#0e1117` | `bg-dark-bg` |
| Card / sidebar / surface | `#111111` | `bg-dark-surface` |
| Hover / input fill | `#1a1a1a` | `bg-dark-elevated` |
| Border | `rgba(255,255,255,0.06)` | `border-dark-border` |
| Primary text | `#f0f0f0` | `text-dark-text` |
| Muted text | `#888888` | `text-dark-muted` |
| Subtle text / placeholders | `#555555` | `text-dark-subtle` |
| Accent (buttons, links, active, icons) | `#29B5CC` | `bg-dark-accent` / `text-dark-accent` |
| Accent background (badge bg, tinted panels) | `rgba(41,181,204,0.10)` | `bg-dark-accent-bg` |

> Note: `dark.bg` was `#0a0a0a` through Session 36 — updated to `#0e1117` in Session 37 to match the sidebar and eliminate a visible contrast seam. The homepage still uses `#0a0a0a` as raw hex (intentional — it doesn't use Tailwind tokens).

**Homepage** — raw hex inline styles (no Tailwind tokens). bg `#0a0a0a`, surface `#111111`, primary `#29B5CC`, text `#f0f0f0`, muted `#888888`.

**`brand.*` tokens** — still present in `tailwind.config.js` but are secondary / legacy. Primary value is `#29B5CC` (same accent). The old light-theme values (`#F7F8F9` bg, `#CDE9EF` border etc.) are no longer used in the UI — do not treat them as active. If doing a light-mode variant in future, start from scratch.

Invite email template still uses old `#2E6B7A` — update when re-doing email templates.

---

### Glass Card Design Language (therapist UI — Session 37)

All therapist-side content pages now use a shared glass-morphic card style defined in `src/components/therapist/styles.js`:

```js
// CARD — use as spread: style={{ ...CARD }}
background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(12px)',
border: '1px solid rgba(100,160,255,0.08)', borderRadius: '14px',
padding: '22px 24px', position: 'relative', overflow: 'hidden'

// SHIMMER — place as first child inside any CARD div
height: '1px', background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)',
position: 'absolute', top: 0, left: 0, right: 0

// SECTION_LABEL — uppercase label style
fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
letterSpacing: '0.08em', color: '#888888'
```

**PageHero component** (`src/components/therapist/PageHero.jsx`) — shared page header used on every therapist page except Onboarding. Props: `title`, `subtitle` (optional), `back` (`{ label, to }` optional breadcrumb), `actions` (optional JSX). Renders a confined particle zone using `<ParticleBackground position="absolute" particleCount={60} spawnFromTop />` inside a `position:relative; overflow:hidden` wrapper, plus a `radial-gradient` cyan glow and a bottom border `rgba(41,181,204,0.08)`. Padding: `32px 32px 28px`.

**Particle placement:** Hero zone only (not full page) on all pages except Dashboard. Dashboard retains full-page `<ParticleBackground spawnFromTop />` — intentionally exempt.

**Framer Motion pattern:**
- Page wrapper: `motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }}`
- Staggered list items: `delay: Math.min(index * 0.05, 0.3)` (capped to avoid long waits on large lists)
- Tab content switches (Prescribe): `AnimatePresence mode="wait"`

**Inputs (on Settings, Onboarding, ExercisePicker):**
`background: rgba(255,255,255,0.04), border: 1px solid rgba(255,255,255,0.08), borderRadius: 7px, color: #e8edf5, padding: 9px 14px`

**Toggle buttons active/inactive:**
- Active: `rgba(41,181,204,0.12)` bg + `rgba(41,181,204,0.3)` border + `#29B5CC` text
- Inactive: `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.08)` border + `#888` text

**Typography — DM Sans**
- Loaded via Google Fonts (preconnect + link in `index.html`)
- Set as default `font-sans` in `tailwind.config.js` — no per-component changes needed
- Weights in use: 400 (body), 500 (labels, nav), 600 (headings, buttons)

### Design Direction
- **Feel:** Clinical without being cold. Professional enough for health practitioners, not so sterile it feels like a hospital system.
- **Audience split:** Therapist interface — used at a desk, can be moderately dense. Client interface — used on mobile at home, must be airy and simple.
- **Reference point:** A well-designed allied health clinic, not a gym app or a consumer wellness product.
- **Key principle:** Restraint. Whitespace and consistency do the heavy lifting. Colour is used intentionally, not decoratively.
- **Avoid:** Wellness app aesthetic, hospital system aesthetic, generic health crosses or abstract human figures in any future logo work.

### Homepage — Design Direction (decided)

- Dark theme committed — near-black background (`#0a0a0a`), primary accent `#29B5CC`
- Reference aesthetic: Linear.app — restrained motion, dark, single accent colour
- Typography: DM Serif Display (headings/hero) paired with DM Sans (body) — font contrast
  signals premium without being ornate
- No light/dark toggle — committing to dark mode for both homepage and app UI
- App UI dark mode sweep to follow after homepage is finalised

**Homepage sections (built — Session 30):**
1. Nav — fixed, blur backdrop, Logo Option 1 + links + CTA buttons
2. Hero — "Exercise prescription, made easy." — DM Serif Display, teal glow, grid texture, app mockup (hidden on mobile)
3. Features — 3-column card grid: Prescribe in minutes, Your own video library (featured), Client progress tracking
4. How it works — "Simple for you. Simple for them." — 3 numbered steps
5. Pricing — 3 tiers: Solo $29, Clinic $70, Practice $120 (figures TBC before launch)
6. CTA banner — "Give your clients a better experience — starting today."
7. Footer — logo, legal links (placeholder), copyright

**Removed:** "Trusted by" logo strip — no customers yet, add closer to launch

**Pending (TODOs in code):**
- Confirm pricing figures before launch (`{/* TODO: confirm pricing before launch */}`)
- Confirm contact email — currently `mailto:hello@manualrx.app` (`{/* TODO: replace mailto with confirmed address before launch */}`)
- ~~Add real Privacy policy, Terms, Contact pages for footer links~~ — ✅ done. Pages live at `/privacy`, `/terms`, `/contact`; footer links use React Router `<Link>`. **Pre-launch: have a lawyer review all three docs — current drafts are placeholder-quality and need to hold up under AU Privacy Act (and HIPAA if US expansion).**

**Build order:** ~~Logo~~ → ~~Homepage~~ → ~~App UI dark mode sweep~~

---

### Logo — Shortlisted Options (not yet decided)

Two finalists identified. Both use `#29B5CC` teal for "Rx".

**Option 1 — F1 Bar (Outfit Bold) ✅ SELECTED & IMPLEMENTED**
- "ManualRx" in Outfit Bold, thin teal vertical bar on left edge
- Implemented in `src/pages/HomePage.jsx` as the `<Logo />` component
- 3px teal (`#29B5CC`) vertical bar + "Manual" white + "Rx" teal, Outfit Bold 700, 17px
- Also needs implementing in the app UI (TherapistNav, client pages) — currently still text-only

**Option 2 — H1 Bracket (RedHat Mono)** — ruled out. See above.

**Favicon:** Not yet done. Approach: "Rx" in teal on dark bg once app UI logo is implemented.

---

### Pricing — Structure Decision

Solo-only at launch. Clinic tier deferred.

**Reason:** If Solo = unlimited clients, there is no forcing function for a clinic to
upgrade — they'd just buy multiple Solo plans. The Clinic tier requires a multi-therapist
shared library system (shared video ownership, per-seat billing, permissions) which is a
non-trivial build. Do not sell it before it exists.

**Roadmap:** Solo → validate → talk to clinic customers → build what they ask for → add
Clinic tier. Pricing to be confirmed at launch; current placeholders: Solo $29/mo.

### Still needed before launch

**Logo / favicon:**
- Wordmark: "ManualRx" in DM Sans SemiBold — white version (for nav) + dark version (`#1E2D3D`, for light backgrounds)
- Favicon: "Rx" in `#3DBDB5` on white, minimum 32×32px
- No icon mark / symbol yet — deferred until post-validation

**Email templates:**
- Invite email still uses old `#2E6B7A` — needs updating to new palette
- Supabase auth emails (password reset, confirmation) still show Supabase defaults — must be customised in Supabase dashboard → Authentication → Email Templates before launch
- Supabase sender name shows "Supabase" — change to "ManualRx" in dashboard before launch

**Pages:**
- ~~Marketing/home page~~ — ✅ done (Session 30). Live at `/`.
- ~~Privacy policy page~~ — ✅ done. Live at `/privacy` (`src/pages/Privacy.jsx`). **Pre-launch: have a lawyer review — draft needs to hold up under AU Privacy Act.**
- ~~Terms of service page~~ — ✅ done. Live at `/terms` (`src/pages/therapist/Terms.jsx`). **Pre-launch: legal review required.**
- ~~Contact page~~ — ✅ done. Live at `/contact` (`src/pages/Contact.jsx`).
---

## Session Log

### Session 1
- Defined core app concept and feature set
- Researched competitors: Rehab My Patient, SimpleSet, My Rehab Connection, Phydeo, Wibbi
- Decided on tech stack: React + Supabase + Vercel + Cloudflare Stream + Stripe
- Set up accounts: GitHub ✅, Supabase ✅, Vercel ✅, Claude Code ✅
- Identified primary target: individual massage/manual therapists (to be validated)
- Planned monetisation tiers: Solo $19/mo, Clinic $49/mo, Practice $99/mo

### Session 2
- Walked through full tech stack explanation (Supabase, Vercel, GitHub, Claude Code)
- Created PROJECT_CONTEXT.md briefing document and workflow
- Explored app name options extensively
- Shortlisted: PrescriptR, PrescribR, TherAlign, ManualRx (PrescriptRx ruled out — redundant)
- Decision: sitting on name until customer research is done
- Identified that "how it reads" matters more than "how it sounds" for a written SaaS product
- Noted good brand instinct — caught the PrescriptRx redundancy independently

### Session 3
- Connected project to GitHub (github.com/zacwilliams03/prescriptr)
- Created Supabase project, region: Sydney
- Ran full database schema (all 8 tables)
- Enabled Row Level Security on all tables with policies
- App confirmed running locally via npm run dev
- Next: build auth flow (Login/Signup with therapist/client roles)

### Session 4
- Built therapist signup, login, logout, role-based routing
- Created database trigger on auth.users → public.users (handles role + name from signup metadata)
- Added ProtectedRoute and PublicOnlyRoute wrappers in App.jsx
- AuthContext now tracks session + profile + signOut
- Auth deferred for later: password reset, email resend, client invite-link signup, RLS audit

### Session 5
- Built therapist client management: add client form + client list (Clients.jsx)
- Built invite code generation: crypto.randomUUID(), 7-day expiry, copyable link
- Built client claim flow: /join/:code public route, password setup, consumed_at marking
- Added logout button to client dashboard
- Full RLS audit across all 9 tables
- Fixed role escalation bug on users UPDATE (added WITH CHECK)
- Fixed over-broad UPDATE policies on clients and client_invites
- Fixed client_invites SELECT exposing full table to anon users
- Added missing policies to therapist_profiles, therapist_video_library, prescription_exercises, exercise_logs
- Restricted exercises INSERT to therapists only
- Added exercises DELETE policy
- Fixed prescriptions policy TO public → TO authenticated

### Session 6 — Exercise Library
**SQL run:**
- Added `default_sets` and `default_reps` columns to `exercises`
- Added `fts` tsvector generated column + GIN index on exercises (enables full-text search)
- Seeded 20 built-in exercises across 8 body regions (Cervical, Thoracic, Lumbar, Shoulder, Hip, Knee, Ankle/Foot, General)
- Created `exercise-videos` Supabase Storage bucket (public) with upload/view/delete policies

**Frontend built:**
- `ExerciseLibrary.jsx` — server-side search (textSearch on fts column), category filter pills (including 'Custom' tab which filters `is_custom=true`, not `category='Custom'`), pagination (PAGE_SIZE=12), 300ms debounced search, grid layout
- `ExerciseDetail.jsx` — VideoPlayer component: YouTube URLs → `<iframe>` embed, all other URLs (Supabase Storage) → HTML5 `<video>` tag, null → placeholder. Delete button shown only for own custom exercises
- `ExerciseUpload.jsx` — upload to `exercise-videos` bucket at path `therapist-videos/{therapist_id}/{timestamp}.{ext}`, `onUploadProgress` callback, animated progress bar, success state with "View exercise" + "Add another"
- `App.jsx` — added routes for `/therapist/exercises/new` (MUST come before `/:id`) and `/therapist/exercises/:id`

**Key decisions:**
- Custom exercises appear in their body region tabs AND in a dedicated 'Custom' tab
- Video player must detect URL type — Supabase Storage URLs are direct MP4 links (use `<video>`), not embeds

### Session 7 — Prescription / Session Flow
**SQL run:**
- `ALTER TABLE prescriptions ADD COLUMN name TEXT NOT NULL DEFAULT 'Session', ADD COLUMN frequency_days INTEGER`
- Created `session_logs` table with RLS (clients insert/read own; therapists read their clients')
- `ALTER TABLE exercise_logs ADD COLUMN weight_completed NUMERIC, pain_rating INTEGER, session_log_id UUID`
- `ALTER TABLE prescription_exercises ADD COLUMN weight NUMERIC`
- RLS policies added for session_logs and exercise_logs
- `NOTIFY pgrst, 'reload schema'` — required after ALTER TABLE to refresh PostgREST schema cache

**Frontend built:**
- `Prescribe.jsx` — sessions list for a client, auto-names new sessions ("Session 1", "Session 2"…), navigates to SessionEdit on creation. Added "Prescribe" link to each client row in `Clients.jsx`
- `SessionEdit.jsx` — category-based exercise picker: Custom at top, then body regions. Each category drills into a text-only exercise list. Selecting an exercise shows a configure panel (sets, reps, weight optional, therapist notes). Search bar above categories — typing switches to search results, clearing returns to categories. Exercise list always visible above the picker so therapist can see what's already added
- `client/Dashboard.jsx` — replaced placeholder with session list: session name, exercise count, frequency label, last completed date, "Start" button
- `client/SessionComplete.jsx` — per-exercise: video player (same YouTube/HTML5/null logic as ExerciseDetail), therapist notes in blue box, sets/reps/weight(optional)/pain(0–10) inputs. Session-level: RPE (0–10 Borg CR-10) + session notes. On complete: inserts session_log then exercise_logs. Success screen on completion
- `App.jsx` — added routes `/therapist/prescribe/:clientId/sessions/:sessionId` and `/client/sessions/:sessionId`

**Key decisions:**
- Session frequency: null = no repeat, 1 = daily, 7 = weekly, N = custom days
- Weight is prescribed on `prescription_exercises.weight` (target) and logged on `exercise_logs.weight_completed` (actual)
- `order` is a reserved SQL keyword — never use `.order('order', ...)` in Supabase JS queries (causes silent failures). Remove the sort or rename the column
- After any `ALTER TABLE`, always run `NOTIFY pgrst, 'reload schema'` or SELECT queries on new columns will silently fail

### Session 8 — Session Completion Wizard & Therapist History

**Bug fixed:**
- Root cause: `clients.user_id` never being set on Join because the "Clients can link their account" UPDATE policy used `USING (user_id = auth.uid())` — which evaluates false when `user_id` is NULL (initial signup). Fix: dropped and recreated the policy to allow update when `user_id IS NULL AND email = auth.email()` OR `user_id = auth.uid()`
- `Join.jsx` now surfaces the link error instead of swallowing it silently
- `client/Dashboard.jsx` now shows an error instead of silently returning empty when client profile lookup fails

**SQL run:**
- `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS video_url text`
- `NOTIFY pgrst, 'reload schema'`
- Dropped and recreated "Clients can link their account" UPDATE policy on clients
- Created `feedback-videos` Supabase Storage bucket (private)
- Storage policies: clients upload to `{auth.uid()}/...` folder; therapists can read all videos in bucket (MVP — broad, tighten later)

**Frontend built:**
- `client/SessionWizard.jsx` — new step-by-step session completion wizard replacing `SessionComplete.jsx`. Flow: intro → one exercise per screen (video, therapist notes, sets/reps/weight, pain 0–10 selector, client notes, optional feedback video upload) → summary (exercise recap, session effort 0–10, session notes) → done. Videos staged locally and uploaded to `feedback-videos` bucket on submit
- `client/Dashboard.jsx` — green "Completed" badge on sessions with at least one log
- `therapist/Prescribe.jsx` — "History" toggle per session card, inline panel showing session logs in reverse-chronological order, expandable per-log exercise breakdown with sets/reps/weight/pain/client notes, signed-URL video playback
- `App.jsx` — route `/client/sessions/:sessionId` now points to `SessionWizard`

**Key patterns (add to known gotchas):**
- `clients.user_id` is the auth UUID; `prescriptions.client_id` is `clients.id` — these are different and serve different purposes
- Feedback videos stored at `{auth.uid()}/{timestamp}_{prescription_exercise_id}.{ext}` in `feedback-videos` bucket. Therapist playback uses signed URLs (1hr expiry) via `supabase.storage.createSignedUrl()`
- Session effort uses existing `session_rpe` column — label changed to plain language "How hard was the session?" in the UI only
- Never use `.order('order', ...)` in Supabase JS — `order` is a reserved SQL keyword (causes silent failures). Use `.order('id', ...)` instead

### Session 9 — Per-set logging, therapist history tab, RLS fixes

**Bugs fixed:**
- `exercise_logs` INSERT was failing silently for clients — root cause: `exercise_logs.client_id` is a FK to `clients.id`, not `auth.uid()`. The client wizard was passing `profile.id` (= `auth.uid()`). Fix: fetch `clients.id` where `user_id = auth.uid()` on load and use that for the insert. Added null guard — if client profile lookup fails, wizard shows an error rather than letting the insert fail silently.
- Therapist history dropdown was showing empty — root cause: missing RLS policies for therapist SELECT on `session_logs` and `exercise_logs`. Added both policies.

**SQL run:**
- `ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS sets_data JSONB`
- Recreated client INSERT policy on `exercise_logs`: `WITH CHECK (client_id = (SELECT id FROM clients WHERE user_id = auth.uid()))`
- Recreated client SELECT policy on `exercise_logs`: same pattern
- Added therapist SELECT policy on `session_logs`: via `prescription_id IN (SELECT id FROM prescriptions WHERE therapist_id = auth.uid())`
- Added therapist SELECT policy on `exercise_logs`: via `prescription_exercise_id IN (... JOIN prescriptions WHERE therapist_id = auth.uid())`
- `NOTIFY pgrst, 'reload schema'`

**Frontend built:**
- `client/SessionWizard.jsx` — replaced single sets/reps/weight inputs with per-set flow: wizard steps through each prescribed set individually (Set 1 of 3, Set 2 of 3, etc.), collecting weight + reps per set. After all sets done, shows pain scale + notes. Per-set data stored as `sets_data` JSONB array. `reps_completed` and `weight_completed` deprecated (null on new logs).
- `therapist/Prescribe.jsx` — added Prescriptions | History tab switcher. History tab fetches all completed sessions for the client across all prescriptions, displayed newest-first with always-expanded exercise breakdowns. Shared `ExerciseLogDetail` component used in both the inline toggles (Prescriptions tab) and History tab. Exercise display now shows: Prescribed target (sets × reps @ weight), per-set actuals (Set 1 / Set 2 / Set 3), Pain rating, Comment: [client notes]. Inline history toggle query updated to also fetch prescribed sets/reps/weight.

**Key patterns (add to known gotchas):**
- `exercise_logs.client_id` is a FK to `clients.id` — NOT `auth.uid()`. Always look up `clients.id` where `user_id = auth.uid()` before inserting exercise_logs. `session_logs.client_id` stores `auth.uid()` directly. These two tables are inconsistent — do not assume they follow the same pattern.
- `sets_data` JSONB holds `[{reps, weight}, ...]`. Fallback to `sets_completed`/`reps_completed`/`weight_completed` for old logs where `sets_data` is null.
- History tab data fetch: one-shot `useEffect` with `[activeTab, sessions, historyTabLoaded]` deps. The `historyTabLoaded` dep is intentional — when it flips to true the effect re-runs but immediately returns, preventing double-fetches.

### Session 10 — Therapist UI polish, wizard improvements, delete session, client exercise visibility

**SQL run:**
- Added `ON DELETE CASCADE` to `exercise_logs.session_log_id → session_logs.id` (was SET NULL)
- Confirmed existing cascades on `prescription_exercises.prescription_id`, `session_logs.prescription_id`, `exercise_logs.prescription_exercise_id` were already CASCADE
- Added RLS policy on `exercises` table: `"Clients can read prescribed custom exercises"` — allows authenticated users to read all built-in exercises (`is_custom = false`), their own custom exercises (`created_by = auth.uid()`), and any custom exercise prescribed to them (via prescription chain)

**Frontend changes — `therapist/Prescribe.jsx`:**
- Renamed tabs: "Prescriptions" → "Prescribed Sessions", "History" → "Session History"
- Removed inline History button and history panel from session cards (history moved entirely to the Session History tab)
- Session History tab redesigned: compact collapsible rows showing session name, date, and RPE; click to expand full exercise detail; single-expand behaviour; `expandedLogId` resets on tab switch
- "Effort" label changed to "RPE" throughout
- Added `deleteSession` function with confirm dialog and cascade-safe DB delete; Delete button added to each session card (left of Edit)

**Frontend changes — `therapist/SessionEdit.jsx`:**
- Save button now navigates back to `/therapist/prescribe/${clientId}` after saving

**Frontend changes — `client/SessionWizard.jsx`:**
- Added prominent "Target" card showing prescribed sets × reps @ weight before the per-set inputs
- Reps and weight input placeholders prefilled with prescribed values
- Reps input moved to left, weight to right (more intuitive order)
- Null safety added for `ex.exercises` throughout (name, category, video_url) — prevents blank screen crash if a prescription_exercise has a missing exercises join
- Exercise name now displays correctly as heading; exercise video renders below heading when `video_url` is set

**Key patterns (add to known gotchas):**
- PostgREST nested joins (e.g. `exercises(name, video_url)` inside a `prescription_exercises` query) are evaluated under the requesting user's RLS permissions. If the client has no SELECT policy on `exercises`, the join silently returns `null` — no error. Always verify client-role RLS covers any table used in a nested join.
- `ON DELETE CASCADE` must be explicit when creating FK constraints — Postgres default is NO ACTION. Check `confdeltype` in `pg_constraint` (`c` = CASCADE, `a` = NO ACTION, `n` = SET NULL).

### Session 11 — Mobile polish (client) + Therapist nav

**Mobile polish (client side):**
- `index.html`: added `viewport-fit=cover` to viewport meta (enables iOS safe area)
- `src/index.css`: global `font-size: 16px` rule on inputs/textareas on mobile — prevents iOS Safari auto-zoom on focus
- `src/pages/client/SessionWizard.jsx`: reps → `inputMode="numeric"`, weight → `inputMode="decimal"` (correct mobile keyboards); input/textarea padding `py-1.5` → `py-2.5` (44px touch targets); ScaleSelector buttons `w-8 h-8` → `w-11 h-11` (44px); all `min-h-screen` → `min-h-[100dvh]` (dynamic viewport height); scrollable content areas use `pb-[max(2rem,env(safe-area-inset-bottom))]` for iPhone home indicator
- `src/pages/client/Dashboard.jsx`: header `flex-wrap`, Log out + Start buttons `py-1.5` → `py-2.5`

**Therapist navigation:**
- New: `src/components/therapist/TherapistNav.jsx` — persistent dark top nav bar on all therapist pages. Clients link highlights on `/therapist/clients/*` and `/therapist/prescribe/*`. Exercises link highlights on `/therapist/exercises/*`.
- `src/pages/therapist/Dashboard.jsx`: full redesign — time-of-day greeting + first name, live client count query, old standalone log out button removed
- All therapist pages updated: `Clients`, `ExerciseLibrary`, `ExerciseDetail`, `ExerciseUpload`, `Prescribe`, `SessionEdit` — each has TherapistNav at top, content wrapped in max-width container with consistent padding

### Session 12 — Password reset flow

**Frontend built:**
- `src/pages/auth/ForgotPassword.jsx` — pre-login email entry; calls `resetPasswordForEmail` with `redirectTo: window.location.origin + '/reset-password'`; always shows generic confirmation regardless of whether email exists (prevents enumeration)
- `src/pages/auth/ResetPassword.jsx` — recovery-link landing page; three internal states: `checking` (spinner, default) → `ready` (new password form, triggered by `PASSWORD_RECOVERY` event via `onAuthStateChange`) → `invalid` (3-second fallback, shown when no recovery event fires — tune timeout after real-device testing); `updateUser` errors mapped to fixed user-facing string, raw error logged to console; redirects to `/login` after 1500ms on success
- `src/pages/Account.jsx` — in-app change-password page for authenticated users (both roles); conditionally renders `TherapistNav` when `profile?.role === 'therapist'`; two-step re-auth: `signInWithPassword` to verify current password, then `updateUser` — success only shown after both succeed

**App.jsx routes added:**
- `/forgot-password` → `PublicOnlyRoute` → `ForgotPassword`
- `/reset-password` → unguarded (Supabase exchanges recovery token on load, creating a temporary session — `PublicOnlyRoute` would bounce the user)
- `/account` → `ProtectedRoute` with no `requiredRole` (both therapist and client access)

**Nav updates:**
- `Login.jsx` — "Forgot your password?" link added below password field
- `TherapistNav.jsx` — "Account" link added in right group between name and Log out, using existing `navLink()` helper
- `client/Dashboard.jsx` — "Account" link added before Log out button, matching button style

**Pre-deploy reminder:** Add production domain to Supabase → Authentication → URL Configuration → Redirect URLs (`https://<domain>/reset-password`). Also add `http://localhost:5173/reset-password` for local dev if not already done.

### Session 13 — Name change to ManualRx

Extensive name exploration across multiple sessions.
- PrescriptR ruled out: established US company at prescriptr.com creates brand conflict, drug connotation risk, US ad targeting would create immediate confusion
- TherAlign ruled out: TherAlignHealth is a US drug prescription company
- Multiple Rx-suffix names ruled out: MotionRx, KineticRx, RehabRx all taken
- Scriptly ruled out: taken by US pharmacy management software
- ManualRx selected: no trademark registrations found in USPTO or IP Australia, no conflicting operating business found in web searches, "manual therapy" is correct clinical term used across massage, physio and OT, Rx reads as clinical shorthand not drug prescription in context
- Decision: register manualrx.app, implement name change across codebase (see below)
- Trademark note: file for registration in AU and US before any serious US expansion

### Session 14 — First deployment, bug discovery

**Completed:**
- Committed all code from sessions 5–13 (was never pushed to GitHub — Vercel was serving a stale placeholder)
- Added `.agents/`, `.superpowers/`, `skills-lock.json` to `.gitignore`
- Set up Vercel project, connected manualrx.com domain via Namecheap DNS (A record + CNAME)
- Supabase Auth URLs updated: Site URL → https://www.manualrx.com, Redirect URL → https://www.manualrx.com/reset-password
- App live at www.manualrx.com, therapist login and password reset confirmed working
- Domain: manualrx.com only — manualrx.app not purchased (consider buying to park defensively, ~$14/yr)

**Bugs discovered:**
- Client login fails with "could not load profile" — root cause: Supabase email confirmation is enabled. Fixed in Session 15 by disabling email confirmation in Supabase → Authentication → Providers → Email.
- Invite link is manually copied by therapist — fixed in Session 15 with Resend + Edge Function.

---

### Next steps (in priority order)

#### 1. ✅ Fix client login bug — DONE (Session 15)
Disabled email confirmation in Supabase → Authentication → Providers → Email.

#### 2. ✅ Automatic invite email — BUILT (Session 15), needs end-to-end test
Resend + Supabase Edge Function fully implemented and deployed. Amber fallback path confirmed working. Pending: Resend domain verification for manualrx.com (DNS propagation in progress as of 2026-05-18). Once verified, test green path: add a client with a real email, confirm "Invite sent" box appears and email arrives.

#### 3. ✅ Therapist onboarding + settings — DONE (Session 16)
See Session 16 below.

#### 4. Test invite email green path
Once Resend domain verification completes for manualrx.com, add a client with a real email address and confirm: "Invite sent" green box appears, email arrives, invite link works, client can set password and log in.

#### 5. Consolidate settings — merge Account page into Settings
Currently therapists have two places with overlapping concerns: `/account` (change password) and `/settings` (clinic name, weight unit, frequency). These should be one page. Plan:
- Add a "Change password" section to `/settings` — re-auth with current password, then `updateUser` (same logic as `Account.jsx`)
- Remove or redirect `/account` for the therapist role (clients still use `/account` for their own password change)
- Remove the "Account" nav link from `TherapistNav` — replaced by Settings
- The client "Account" link on the client dashboard stays as-is

#### 6. Video content for built-in exercise library
#### 7. Stripe integration

---

### Session 15 — Client login bug fix + automatic invite email

**Bug fixed:**
- Client login "could not load profile" — fixed by disabling email confirmation in Supabase → Authentication → Providers → Email. With confirmation disabled, `signUp` in `Join.jsx` returns an active session immediately, the `clients.update({ user_id })` call runs with a valid JWT, and RLS allows it.

**Automatic invite email built:**
- Resend account created. Domain `manualrx.com` added with DKIM, SPF, and DMARC DNS records added to Namecheap. MX record skipped (Namecheap doesn't expose it when email hosting is active — not blocking, only affects bounce tracking).
- Supabase Edge Function: `supabase/functions/send-invite-email/index.ts` — Deno TypeScript. Verifies caller JWT via service role client, builds invite URL from `SITE_URL` secret, extracts client first name, builds sender line (falls back gracefully if `clinicName` is null), POSTs to Resend API. Returns `{ success: true }` or 500.
- `Clients.jsx` updated: fetches `therapist_profiles.clinic_name` on mount (stored as `clinicName` state, does not shadow auth context `profile`). After both DB inserts succeed, invokes edge function with `{ code, email, clientName, therapistName, clinicName }`. Failure condition: `!fnError && fnData?.success === true`. Two success UI paths: green "Invite sent to [email]" with secondary copy-link on success; amber "Couldn't send email — share this link manually" with prominent copy-link on failure.
- Secrets set: `RESEND_API_KEY`, `SITE_URL`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into Edge Functions — do not add manually.
- Edge function deployed via `supabase functions deploy send-invite-email`.
- Amber fallback path confirmed working in production (Resend rejected send because domain not yet verified).
- GitHub remote updated to `github.com/zacwilliams03/ManualRx.git`.

**⚠️ Still needs:** Resend domain verification to complete (DNS propagating as of 2026-05-18), then test green path end-to-end. See Next Steps item 4.

**Email template details:**
- From: `ManualRx <invites@manualrx.com>`
- Subject: `[TherapistName] has shared an exercise program with you`
- Body: ManualRx wordmark (Ocean Slate `#2E6B7A`), greeting with client first name only, sender line, CTA button (Ocean Slate), 7-day expiry note, no-reply notice. All inline styles for Gmail/Outlook compatibility.
- Colors: only two occurrences of `#2E6B7A` in the template — trivial to update when palette is finalised.

---

### Session 16 — Therapist onboarding flow + settings page

**SQL run:**
- `ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS has_onboarded boolean DEFAULT false`
- `ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'kg'`
- `ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS default_frequency_days integer`
- `NOTIFY pgrst, 'reload schema'`
- Verified: `therapist_profiles.user_id` has both PRIMARY KEY (`therapist_profiles_pkey`) and UNIQUE (`therapist_profiles_user_id_key`) constraints — upsert with `{ onConflict: 'user_id' }` is safe

**Frontend built:**
- `src/pages/therapist/Onboarding.jsx` — one-time setup page shown after signup. On mount: checks `has_onboarded` on `therapist_profiles`; redirects to `/therapist` if already true. Fields: clinic name (text), weight unit (kg/lb toggle), default session frequency (No repeat / Daily / Weekly / Custom). "Save and continue" upserts all fields + `has_onboarded: true`. "Skip for now" upserts `has_onboarded: true` only. Both paths show inline error on failure; neither redirects on failure. `authLoading` guard prevents stuck spinner if auth never resolves.
- `src/pages/therapist/Settings.jsx` — permanent settings page at `/settings`. Same three fields, pre-populated from `therapist_profiles` on mount. Separate `fetchError` state suppresses the form if load fails (prevents saving blank values over real data). "Save changes" upserts fields. "Settings saved." confirmation auto-dismisses after 3 seconds via `useRef` timer with unmount cleanup. `hasFetchedRef` prevents re-fetch when `AuthContext` creates a new profile object reference on token refresh.
- `src/App.jsx` — added `/onboarding` and `/settings` routes, both `<ProtectedRoute requiredRole="therapist">`
- `src/pages/auth/Signup.jsx` — post-signup `navigate` changed from `/therapist` to `/onboarding`
- `src/components/therapist/TherapistNav.jsx` — "Settings" link added between Account and Log out

**Key decisions:**
- Login flow does NOT redirect `has_onboarded = false` therapists to `/onboarding` — they land on `/therapist` as normal. Onboarding only shown on the signup path. Pre-migration therapists (existing accounts with `has_onboarded = false`) can reach it by navigating manually; acceptable for MVP.
- `clinic_name` saves as `null` (not `''`) when left blank — `clinicName || null` on upsert
- `/onboarding` and `/settings` are top-level routes (consistent with `/account`), not `/therapist/*`
- GitHub remote updated: `git remote set-url origin https://github.com/zacwilliams03/ManualRx.git`

**Tested and confirmed working:**
- New signup → `/onboarding` → save → `/therapist`
- Return login → `/therapist` (onboarding not shown again)
- Skip flow → `/therapist`, `has_onboarded = true` in DB
- Settings pre-populated, save persists, success banner auto-dismisses
- Access control: unauthenticated → `/login`, client role → `/client`

### Session 18 — UI colour pass + typography

**Decisions made:**
- Colour palette finalised: Slate Navy + Bright Teal (new palette, not one of the three prior shortlisted options)
- Typography: DM Sans via Google Fonts

**Code changes:**
- `tailwind.config.js` — added 9 custom `brand.*` colour tokens + DM Sans as default `font-sans`
- `index.html` — added DM Sans Google Fonts preload links + `<meta name="theme-color" content="#1E2D3D">`
- `src/components/therapist/TherapistNav.jsx` — nav background `bg-gray-800` → `bg-brand-nav`; active link colour → `text-brand-primary`
- All 20 component/page files updated: replaced all `blue-*` Tailwind classes with `brand-*` tokens; replaced `gray-800` button/CTA colours with `brand-primary`; therapist note boxes in SessionWizard use `brand-note-*` tokens; Custom exercise badges use `brand-primary-light/dark`
- Build verified clean (`npm run build` — no errors, zero `blue-*` classes remaining)

**Key implementation detail:**
- All brand colours live in `tailwind.config.js` — a future palette change is a single-file edit
- Note box disambiguation: `bg-blue-50` in SessionWizard (therapist notes shown to client) → `brand-note-bg`; `bg-blue-50` elsewhere (badges, info panels) → `brand-primary-light`

### Session 19 — Functional kg/lb weight unit conversion

**No SQL changes needed** — `therapist_profiles.weight_unit` and `clients.weight_unit` already existed from Session 16. Weights in `prescription_exercises.weight`, `exercise_logs.weight_completed`, and `exercise_logs.sets_data` were already effectively canonical kg (UI was always hardcoded to "kg").

**New files:**
- `src/utils/weightUtils.js` — `toCanonical(value, unit)`, `fromCanonical(kgValue, unit)`, `formatWeight(kgValue, unit)`
- `src/hooks/useWeightUnit.js` — fetches current user's `weight_unit` from `therapist_profiles` or `clients` based on `profile.role`; returns `'kg'` as default

**Frontend changes:**
- `therapist/SessionEdit.jsx` — weight input label dynamically shows unit; on save, converts to canonical kg via `toCanonical`
- `therapist/Prescribe.jsx` — all weight displays (prescribed target, per-set actuals, weight_completed fallback) use `formatWeight` with therapist's unit
- `client/SessionWizard.jsx` — prescribed target and input label show client's unit; placeholder converts canonical kg to display unit; recap during session shows raw-entered value + unit label (not yet converted); on submit, converts all set weights to canonical kg before saving to `sets_data`
- `client/SessionComplete.jsx` — weight placeholder shows unit; converts to canonical kg on save
- `client/History.jsx` — all weight displays use `formatWeight` with client's unit

**Key pattern:**
- Weights always stored in canonical kg. Input conversion (`toCanonical`) happens on save. Display conversion (`formatWeight`) happens on render. `useWeightUnit` hook handles per-role table routing using `profile.role` (not `user.role` — `user` is the raw Supabase auth object with no `.role` field).
- `sets_data` recap in SessionWizard during an in-progress session shows raw user-entered strings (`${s.weight} ${weightUnit}`) — these are not canonical yet. Canonical conversion only happens on final submission.

---

### Session 22 — Persistent client account-linking bug fix

**Bug fixed:**
- `clients.user_id` was silently left NULL after the join flow completed, causing "could not load profile" on the client dashboard.
- Root cause: The client-side `UPDATE clients SET user_id = ?` call relied on RLS USING clause `(user_id IS NULL AND lower(email) = lower(auth.jwt() ->> 'email'))`. The `auth.jwt() ->> 'email'` claim is unreliable for newly created sessions — PostgREST does not always include it. This caused the USING clause to evaluate to NULL (not TRUE), silently filtering the row and updating 0 rows with no error returned.
- Secondary issue: Supabase JS returns `{ data: null, error: null }` on any non-error UPDATE without `.select()`, so the code couldn't detect the 0-row silent failure. Fixed by adding `.select('id')` and checking `!linkData?.length`.
- Tertiary issue: A `SECURITY DEFINER` RPC function (`claim_client_invite`) was created as a fallback, but PostgREST continued to return 404 even after `NOTIFY pgrst, 'reload schema'` — the schema cache reload is unreliable for newly created functions.

**Final fix — DB trigger (most robust approach):**
- Created `handle_client_account_link()` SECURITY DEFINER function + `on_client_account_link` trigger on `AFTER INSERT ON auth.users`.
- Trigger reads `therapist_id` from `raw_user_meta_data`, runs `UPDATE clients SET user_id = NEW.id WHERE lower(email) = lower(NEW.email) AND therapist_id = ... AND user_id IS NULL`, and marks `client_invites.consumed_at = now()`. All in one transaction, no RLS involved.
- `Join.jsx` `signUp()` call updated to pass `therapist_id: invite.therapist_id` in `options.data` so the trigger has it available.
- Removed all client-side link + invite-consumption logic from `Join.jsx`. `handleSubmit` now just calls `signUp()`, checks `data.user?.id` and `data.session`, then shows success.

**SQL run:**
```sql
CREATE OR REPLACE FUNCTION public.handle_client_account_link()
RETURNS TRIGGER AS $$
DECLARE
  v_therapist_id uuid;
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'client' AND
     NEW.raw_user_meta_data->>'therapist_id' IS NOT NULL THEN
    UPDATE public.clients SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
    AND therapist_id = (NEW.raw_user_meta_data->>'therapist_id')::uuid
    AND user_id IS NULL;
    UPDATE public.client_invites SET consumed_at = now()
    WHERE lower(email) = lower(NEW.email)
    AND therapist_id = (NEW.raw_user_meta_data->>'therapist_id')::uuid
    AND consumed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_client_account_link
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_client_account_link();
```

**Key gotchas confirmed:**
- `auth.jwt() ->> 'email'` is unreliable in RLS for new sessions — do not rely on it. Use `auth.users` subquery or SECURITY DEFINER functions.
- `NOTIFY pgrst, 'reload schema'` does not reliably expose newly created functions via PostgREST in all cases.
- Supabase `.update()` without `.select()` always returns `{ data: null, error: null }` on success regardless of rows affected — always add `.select('id')` and check result length when row-count matters.

---

### Session 23 — Invite email first name + video attachment in session builder

**`supabase/functions/send-invite-email/index.ts`:**
- Added `therapistFirstName = therapistName.split(' ')[0]` — email subject and body now use first name only, not full name

**`therapist/SessionEdit.jsx`:**
- Added `VideoPlayer` component (same YouTube/HTML5/null logic as `SessionWizard`, `ExerciseDetail`)
- Added `video_url` to all four exercise queries: `runSearch`, `selectCategory`, `fetchData` exercises join, `confirmAdd` exercises join
- Search results and category list: exercises with `video_url` show "Video attached" in grey below the exercise name
- Configure view header: "Video attached" label shown below category when exercise has a video
- Added exercises list: `VideoPlayer` renders below each exercise row when `pe.exercises.video_url` is set — video_url is returned via the `.select()` chained after `.insert()` in `confirmAdd`, so it populates immediately without a re-fetch

**Edge function redeployed:** `supabase functions deploy send-invite-email`

---

### Session 24 — Reusable session templates

**SQL run:**
```sql
CREATE TABLE templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), therapist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapists manage own templates" ON templates FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
CREATE TABLE template_exercises (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE, exercise_id UUID NOT NULL REFERENCES exercises(id), sets INTEGER, reps INTEGER, weight NUMERIC, therapist_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapists manage own template exercises" ON template_exercises FOR ALL USING (template_id IN (SELECT id FROM templates WHERE therapist_id = auth.uid())) WITH CHECK (template_id IN (SELECT id FROM templates WHERE therapist_id = auth.uid()));
NOTIFY pgrst, 'reload schema';
```

**New files:**
- `src/components/therapist/ExercisePicker.jsx` — shared exercise picker extracted from SessionEdit. Props: `onAdd(async { exerciseId, sets, reps, weight, notes })`, `weightUnit`, `disabled`, `confirmLabel` (default 'Add to session'). Manages its own three-view state (browse/category/configure); calls `onAdd` and resets on success, shows error on throw.
- `src/pages/therapist/Templates.jsx` — list all templates; "Add Template" eagerly creates a record (name = "New Template") and navigates to TemplateEdit; cards show name, category badge, exercise count, exercise names; Edit + Delete per card.
- `src/pages/therapist/TemplateEdit.jsx` — create/edit a template; name + category (with datalist autocomplete from therapist's existing categories) at top; exercise list + ExercisePicker below; Save navigates back to /therapist/templates.
- `src/components/therapist/ApplyTemplateModal.jsx` — two-step modal on Prescribe page. Step 1: search bar + category filter pills + template list (all client-side filtered). Step 2: apply as-is (copies template exercises directly) or customise (inline editable exercise list before confirming). Applying creates a new `prescriptions` + `prescription_exercises`; template is never mutated. `onApplied` callback triggers `fetchData()` on Prescribe to refresh session list with correct exercise counts.

**Files modified:**
- `src/pages/therapist/SessionEdit.jsx` — inline picker replaced with `<ExercisePicker onAdd={handleAddExercise} weightUnit={weightUnit} />`; `toCanonical` call moved into ExercisePicker; all picker state/handlers removed from SessionEdit
- `src/components/therapist/TherapistNav.jsx` — "Templates" nav link added (highlights on `/therapist/templates`)
- `src/pages/therapist/Prescribe.jsx` — "Apply Template" button added alongside "New session"; `ApplyTemplateModal` mounted when `showApplyModal` is true
- `src/App.jsx` — routes `/therapist/templates` and `/therapist/templates/:templateId` added

**Key decisions:**
- No `order` column on `template_exercises` (reserved SQL keyword). Order by `created_at ASC`.
- Deleting a template cascades to `template_exercises` only — no FK from `prescriptions` to `templates`, so applied prescriptions survive template deletion.
- `createPrescription()` selects only `id, name, frequency_days, created_at` (not exercise count) because exercises haven't been inserted yet at that point; Prescribe calls `fetchData()` after apply to get real counts.
- Category is free text (`template_exercises.category`). TemplateEdit fetches all therapist templates on load, deduplicates categories client-side, feeds them into a `<datalist>` for native browser autocomplete — no separate categories table needed.
- Apply modal filtering is entirely client-side: search (substring on name) + category pill (exact match); both filters combine with AND.

---

### Session 25 — Prescription duration + active/inactive state

**SQL run:**
```sql
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER;
NOTIFY pgrst, 'reload schema';

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER;
NOTIFY pgrst, 'reload schema';
```

**Files modified:**
- `src/pages/therapist/SessionEdit.jsx` — added Start date field (date input, defaults to today) and Duration pill selector (None / 1 / 2 / 4 / 6 / 8 / 12 weeks / Custom) below the frequency selector; `saveMeta` saves `start_date` and `duration_weeks` to DB
- `src/pages/therapist/TemplateEdit.jsx` — added Duration pill selector (no start date on templates); hint label "applied when template is used"; `saveMeta` saves `duration_weeks`
- `src/components/therapist/ApplyTemplateModal.jsx` — template fetch includes `duration_weeks`; `createPrescription()` now sets `start_date = today`, copies `duration_weeks` from template, and sets `frequency_days = null` (therapist sets frequency in SessionEdit after applying)
- `src/pages/therapist/Prescribe.jsx` — fetch includes `start_date`, `duration_weeks`, `session_logs(count)`; added `isActive`, `expectedSessions`, `reactivatePrescription` helpers; sessions sorted active-first then by `created_at`; active cards show "Active until [date]" and completion count (X / Y if duration + frequency both set); inactive cards dimmed (`opacity-50 bg-gray-50`) with grey "Inactive" badge and Reactivate | Edit | Delete buttons
- `src/pages/client/Dashboard.jsx` — fetch includes `start_date`, `duration_weeks`; `isActive` helper added; only active prescriptions rendered (no label shown to client — sessions silently disappear)

**Key decisions:**
- Active/inactive derived in JS on every render from `start_date` + `duration_weeks` — no `is_active` boolean column (would go stale)
- Grace period: expiry = `start_date + duration_weeks * 7 + 7` days — real-world programmes rarely run perfectly on schedule
- Prescriptions with `start_date IS NULL` or `duration_weeks IS NULL` are always active
- Reactivate = duplicate: creates a new prescription row (same name/frequency/duration/notes, `start_date = today`), copies all `prescription_exercises`, navigates to SessionEdit. Original prescription is NOT modified — kept as inactive historical record
- Templates get `duration_weeks` only — `start_date` is always set at apply time (today)
- Applying a template sets `frequency_days = null`; therapist configures frequency in SessionEdit afterward
- `session_logs(count)` from PostgREST returns `[{ count: "3" }]` — a string inside an array. Always `parseInt(s.session_logs?.[0]?.count ?? 0)` when using it

---

### Session 26 — Clients page UI redesign + is_active per client

**SQL run:**
```sql
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
NOTIFY pgrst, 'reload schema';

-- Fixed RLS policy: replaced auth.users subquery with auth.email()
DROP POLICY "clients can self-link via invite" ON clients;
CREATE POLICY "clients can self-link via invite" ON clients
  FOR UPDATE
  USING (user_id IS NULL AND lower(email) = lower(auth.email()))
  WITH CHECK (user_id = auth.uid());
NOTIFY pgrst, 'reload schema';
```

**Files modified:**
- `src/pages/therapist/Clients.jsx` — full rewrite. New layout: header with "X patients treated since DD Mon YYYY" stat (total client count + therapist account creation date via `supabase.auth.getUser()`); search bar filters all clients (active + inactive) client-side; "Add Client" button opens a modal containing the existing invite flow (same inserts + edge function call); client list shows active clients by default with a "Show inactive clients (N)" toggle that reveals a labelled inactive section; each client row has Details (renamed from Prescribe, same route), Mark inactive / Reactivate toggle (updates `is_active` in DB + local state without refetch), and Delete with `window.confirm` (removes from local state on success — cascade to prescriptions already in place).

**Key decisions:**
- `is_active = true` DEFAULT covers all existing clients — no backfill needed
- Active/inactive is a stored boolean on `clients` (unlike prescription active state which is derived from duration). Clients don't have an expiry concept — only therapists mark them inactive manually
- Cascade from `clients → prescriptions` confirmed already in place (`confdeltype = 'c'`)
- Delete uses `window.confirm` — no second modal needed, keeps state management simple
- `renderClientRow` is a plain function (not a React component) returning JSX — avoids creating a new component file while keeping the map body readable
- `therapistSince` formatted with `toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })` — locale-aware

**Critical gotcha discovered:**
- A Supabase RLS UPDATE policy on `clients` ("clients can self-link via invite") contained `SELECT users.email FROM auth.users WHERE users.id = auth.uid()` in its USING clause. PostgreSQL evaluates ALL matching UPDATE policies for every authenticated user — so therapists (not just clients) were hitting this subquery and getting `42501 permission denied for table users`. Fix: replace the `auth.users` subquery with `auth.email()`, which reads the email from the JWT with no extra privilege required. **Rule: never use `SELECT FROM auth.users` in a RLS USING/WITH CHECK clause — use `auth.uid()`, `auth.email()`, or `auth.jwt()` instead.**

---

### Session 27 — Client progress feature (completion rate, pain chart, volume chart)

**SQL run:** None — no new tables or columns. All data sourced from existing `session_logs`, `exercise_logs`, `prescriptions`, `therapist_profiles`.

**New dependencies:**
- `recharts` — line charts
- `vitest` (dev) — unit tests for pure utility functions; `test: { globals: true }` added to `vite.config.js`; `"test": "vitest run"` added to `package.json` scripts

**New files:**
- `src/utils/progressUtils.js` — four pure functions: `computeCompletionStats`, `computeExerciseVolume`, `computePainData`, `computeVolumeData`. No DB access, fully unit-tested.
- `src/utils/progressUtils.test.js` — 18 vitest tests covering all four functions
- `src/hooks/useProgressData.js` — fetches `session_logs` with nested `exercise_logs(pain_rating, sets_data, sets_completed, reps_completed, weight_completed)` for a given array of `prescriptionIds`. Cancellable on unmount. Used on both client and therapist surfaces.
- `src/components/progress/CompletionStat.jsx` — renders "X of Y sessions completed" (when both duration_weeks and frequency_days are set) or "X sessions completed" (when either is null)
- `src/components/progress/PainChart.jsx` — recharts `LineChart` for average pain per session (y-axis 0–10). Shows fallback text if fewer than 2 data points.
- `src/components/progress/VolumeChart.jsx` — recharts `LineChart` for total volume per session in the therapist's weight unit. Fallback text if fewer than 2 data points.
- `src/components/progress/PrescriptionProgressSection.jsx` — collapsed card by default; shows prescription name + completion summary. Click to expand CompletionStat + PainChart + VolumeChart. Each card expands independently.
- `src/pages/client/ProgressTab.jsx` — client's Progress tab content. Filters to active prescriptions only. Fetches therapist's `weight_unit` from `therapist_profiles` via `prescriptions[0].therapist_id`. Passes all prescriptions to `PrescriptionProgressSection`.
- `src/pages/therapist/ClientDataTab.jsx` — therapist's Client Data tab. Uses `useWeightUnit()` (already exists at `src/hooks/useWeightUnit.js`). Shows all prescriptions (active + inactive) for the client.

**Files modified:**
- `src/pages/client/Dashboard.jsx` — added `therapist_id` to prescriptions select; added `activeTab` state (`'sessions'` default); added Sessions/Progress tab switcher (same pattern as Prescribe.jsx); gated existing session list behind `activeTab === 'sessions'`; renders `<ProgressTab prescriptions={sessions.filter(isActive)} />` on progress tab
- `src/pages/therapist/Prescribe.jsx` — added `clientData: 'Client Data'` to `TAB_LABELS`; added `'clientData'` to tab array; renders `<ClientDataTab prescriptions={sessions} />` after history tab block
- `package.json` — recharts in dependencies, vitest in devDependencies, test script added
- `vite.config.js` — `test: { globals: true }` added

**RLS — no new policies needed:**
- `session_logs`: client SELECT (`WHERE client_id = auth.uid()`) and therapist SELECT (`WHERE prescription_id IN (SELECT id FROM prescriptions WHERE therapist_id = auth.uid())`) both cover the new query
- `exercise_logs`: nested select from session_logs applies existing RLS automatically on both surfaces
- `therapist_profiles`: existing client read policy (`WHERE user_id IN (SELECT therapist_id FROM clients WHERE user_id = auth.uid())`) covers the weight_unit fetch in ProgressTab

**Key decisions:**
- Volume stored canonically in kg in the DB; converted to therapist's `weight_unit` at display time (same pattern as the rest of the app via `weightUtils.js`)
- Client progress view uses the **therapist's** `weight_unit` (not the client's own setting) — volume was prescribed in that unit; fetched via `prescriptions[0].therapist_id → therapist_profiles.weight_unit`
- Pain chart excludes sessions where every exercise log has `pain_rating = null`; averages only non-null ratings within a session
- Volume chart excludes sessions where all exercise logs have zero/null weight (bodyweight-only sessions)
- `sets_data` JSONB preferred for volume calculation; falls back to `reps_completed × weight_completed` for old logs that predate per-set data
- Cards collapsed by default — click to expand. Multiple cards expand independently (no accordion behaviour).
- Minimum 2 data points required to render a chart; fewer shows plain-text fallback message
- `useProgressData` uses `prescriptionIds.join(',')` as the `useEffect` dependency key to avoid array reference churn

---

### Session 28 — PDF export for prescriptions

**SQL run:** None.

**New dependencies:**
- `@react-pdf/renderer` — client-side PDF generation

**New files:**
- `src/utils/pdfUtils.js` — two pure utility functions: `sanitise(str)` (strips special chars, collapses hyphens, trims leading/trailing hyphens — used for safe PDF filenames); `weightDisplay(kgValue, unit)` (returns `formatWeight` result, or `'Bodyweight'` when value is null/undefined/0). Both TDD'd before implementation.
- `src/utils/pdfUtils.test.js` — 12 vitest tests covering sanitise edge cases (spaces, slashes, apostrophes, collapse) and weightDisplay (null, undefined, zero, kg, lb)
- `src/components/therapist/PrescriptionPDF.jsx` — `@react-pdf/renderer` Document component. Uses only renderer primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`) — no HTML elements or Tailwind inside. Props: `clinicName`, `clientName`, `prescriptionName`, `exercises[]`, `weightUnit`. Layout: header with clinic name (falls back to "ManualRx") + "EXERCISE PROGRAM" subtitle in brand-primary, meta row (client / program / date), divider, numbered exercise list (name, sets×reps@weight or Bodyweight, therapist notes in tinted box if non-empty), footer.

**Files modified:**
- `src/pages/therapist/Prescribe.jsx` — added `useClinicName` hook; added `pdfLoadingId` and `pdfError` state (keyed by prescriptionId); added `downloadPDF(prescription)` async function: fetches `prescription_exercises(sets, reps, weight, therapist_notes, exercises(name))` lazily on click, generates PDF blob via `pdf(<PrescriptionPDF/>).toBlob()`, triggers browser download, clears state in finally block, sets `pdfError` on throw; added "Download PDF" button to each prescription card (left of Edit) with disabled/loading state and inline error text on failure; filename pattern: `sanitise(clientName)-sanitise(prescriptionName).pdf`

**Key patterns:**
- `@react-pdf/renderer` uses its own layout engine — never use HTML elements or Tailwind classes inside a `Document` component. Use `StyleSheet.create({})` with plain JS style objects.
- PDF data is fetched lazily on click (not preloaded) — `prescription_exercises` are not in the main `fetchData` query (which only fetches `count`). This keeps the Prescribe page fast when there are many prescriptions.
- `pdf().toBlob()` is the imperative pattern; avoids `PDFDownloadLink` which requires data to be ready before render.
- `useClinicName()` already handles therapist role correctly — queries `therapist_profiles` directly by `user.id`. Safe to call from any therapist page.
- Chunk size warning in Vite build is expected — `@react-pdf/renderer` adds significant JS. Not an error.

---

### Session 29 — Returning-client auto-link

**Problem:** The `on_client_account_link` trigger fires on `AFTER INSERT ON auth.users` (new signups only). When an existing client receives an invite from a second therapist and logs in, no trigger fires — `clients.user_id` stays NULL and `client_invites.consumed_at` is never set.

**Fix — new SQL function:**
```sql
CREATE OR REPLACE FUNCTION public.claim_pending_invites()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE clients SET user_id = auth.uid()
  WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND user_id IS NULL;
  UPDATE client_invites SET consumed_at = now()
  WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND consumed_at IS NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_pending_invites() TO authenticated;
```
Run in Supabase SQL Editor. No migration file — project has no tracked migrations.

**AuthContext change:** `onAuthStateChange` now fires `claim_pending_invites()` on `SIGNED_IN` events only (not token refreshes or page reloads). Uses async IIFE — fire-and-forget, errors only logged to console.

```javascript
if (event === 'SIGNED_IN') {
  ;(async () => {
    const { error } = await supabase.rpc('claim_pending_invites')
    if (error) console.error('claim_pending_invites failed:', error)
  })()
}
```

**Dashboard query hardening:** A client can now have multiple `clients` rows (one per therapist). Five files used `.single()` on `clients WHERE user_id = ?` — this throws when multiple rows exist. Fix applied to all five: `Dashboard.jsx`, `Settings.jsx`, `SessionWizard.jsx`, `useWeightUnit.js`, `useClinicName.js`:
```javascript
.eq('user_id', profile.id)
.order('created_at', { ascending: false })
.limit(1)
.single()
```
Most-recently-created therapist relationship wins. Proper therapist-picker UI is out of scope for now.

**Join.jsx message:** Updated "already registered" error from "An account with this email already exists. Please log in." → "You already have an account. Just log in and you'll be connected to your new therapist automatically."

**Key gotchas discovered:**
- `supabase.rpc()` returns a PromiseLike (thenable), not a full Promise — `.catch()` does not exist on it and calling it throws a TypeError that crashes the login flow. Always use `await` inside an async IIFE, or `.then(null, handler)`.
- `claim_pending_invites()` consumes ALL unconsumed invites for the email in one login — if two therapists have pending invites simultaneously, both get consumed. Known limitation, acceptable for now.

---

### Session 30 — Marketing homepage

**New dependency:** `lenis` (smooth scroll library)

**New files:**
- `src/pages/HomePage.jsx` (~800 lines) — full dark-theme marketing landing page. Seven sections: Nav, Hero, Features, HowItWorks, Pricing, CTABanner, Footer. All defined as named functions in a single file. Data arrays (`NAV_LINKS`, `FEATURES`, `STEPS`, `PLANS`) defined as `const` at file top for easy future edits.

**Files modified:**
- `index.html` — Google Fonts link extended to include DM Serif Display (regular + italic) and Outfit Bold (for logo)
- `src/App.jsx` — `/` route changed from `<Navigate to="/login">` to `<HomePage />`; catch-all `*` route changed from `/login` to `/`; `HomePage` import added

**Design tokens (raw hex — no `brand-*` Tailwind tokens used on homepage):**
- bg `#0a0a0a`, surface `#111111`, primary `#29B5CC`, text `#f0f0f0`, text-muted `#888888`

**Key implementation decisions:**
- Logo: Option 1 (F1 Bar) — 3px teal bar + "Manual" white + "Rx" teal, Outfit Bold
- Hero headline: "Exercise prescription, made easy." (DM Serif Display, teal italic emphasis)
- Lenis stored in `useRef` so nav links can call `lenisRef.current.scrollTo(id)` — bare `href="#id"` anchors conflict with Lenis and are not used
- `useReducedMotion()` from Framer Motion called in each section; `fw()` (whileInView) and `fa()` (animate on mount) helpers return `{ initial: false }` when reduced motion is preferred
- `minHeight: '100dvh'` (not `100vh`) in Hero — iOS Safari `100vh` includes browser chrome
- Decorative elements have `aria-hidden="true"`; nav has `aria-label="Main"`
- Footer links use React Router `<Link to="...">` pointing to `/privacy`, `/terms`, `/contact` (previously placeholder `href="#"` with `preventDefault`)
- FEATURES data stores `Icon: ComponentReference` not `icon: <JSX />` — avoids hoisting fragility
- CTA banner copy: "Give your clients a better experience — starting today." (no false social proof)

**Pricing tiers (placeholders — confirm before launch):**
- Solo $29/mo: 1 therapist, unlimited clients, full exercise library, custom video uploads, PDF export
- Clinic $70/mo: up to 5 therapists, shared video library, full exercise library, PDF export
- Practice $120/mo: unlimited therapists, shared library, PDF export, priority support
- Analytics dashboard and white-label branding NOT listed (features don't exist yet)

**TODOs left in code:**
- `{/* TODO: confirm pricing before launch */}` on pricing figures
- `{/* TODO: replace mailto with confirmed address before launch */}` on CTA banner demo link

**Build verified:** `npm run build` exits 0. Chunk size warning is pre-existing (Framer Motion) — not an error.

Note for Claude — always tell me if I should switch models to something more powerful, or if a lighter model is okay.

---

### Session 31 — Dark sidebar + full app UI dark mode sweep

**Goal:** Replace the light-theme `TherapistNav` top bar with a dark fixed-left sidebar that matches the homepage's Linear-inspired aesthetic, then sweep all therapist pages to a cohesive dark theme.

---

**Phase 1 — New components**

**New dependency:** `lucide-react` (tree-shakeable icon library)

Icons used: `LayoutDashboard`, `Users`, `FileText`, `Dumbbell`, `Settings`, `ChevronUp`, `LogOut`, `KeyRound`

**`tailwind.config.js`** — added `dark.*` token set alongside existing `brand.*`:
```js
dark: {
  bg:          '#0a0a0a',   // page background
  surface:     '#111111',   // card / sidebar background
  elevated:    '#1a1a1a',   // hover / input fill
  border:      'rgba(255,255,255,0.06)',
  text:        '#f0f0f0',
  muted:       '#888888',
  subtle:      '#555555',
  accent:      '#29B5CC',   // teal — same as brand.primary
  'accent-bg': 'rgba(41,181,204,0.10)',
}
```

**`src/components/therapist/AppSidebar.jsx`** — fixed-left sidebar (240px, `z-40`):
- `Logo` — 3px teal bar + "Manual" white + "Rx" teal (Outfit Bold 17px — matches homepage)
- `NavItem` — active detection via `exact` flag or `activePrefixes[]`; 44px min touch target; `transition-colors duration-150`
  - Dashboard: exact match `/therapist`
  - Clients: activePrefixes `['/therapist/clients', '/therapist/prescribe']` — stays highlighted during session editing
  - Templates, Exercise Library, Settings
- `AccountSection` — bottom panel with `panelRef` on the **outer wrapper** (covers both trigger button and AnimatePresence panel — critical: if ref only covers the panel, outside-click handler conflicts with toggle onClick and panel never opens). Panel animates `{ opacity: 0, y: 8 } → { opacity: 1, y: 0 }` in 0.18s, respects `useReducedMotion`. Contains:
  - Change password: inline expand, calls `supabase.auth.updateUser({ password })` (no current password needed — live session)
  - Log out: two-step confirm before calling `signOut()`

**`src/components/therapist/SidebarLayout.jsx`** — layout wrapper used by all therapist pages:
```jsx
<div className="flex min-h-screen bg-dark-bg">
  <AppSidebar />
  <main className="flex-1 min-h-screen" style={{ marginLeft: '240px' }}>
    {children}
  </main>
</div>
```

---

**Phase 2 — Dark mode sweep (all therapist pages)**

All 11 therapist pages migrated from `TherapistNav` → `SidebarLayout` and fully dark-themed. Color mapping applied consistently across all files:

| Light class | Dark replacement |
|---|---|
| `bg-white`, `bg-gray-50` | `bg-dark-surface`, `bg-dark-elevated` |
| `border-gray-200`, `border-gray-100` | `border-dark-border` |
| `text-gray-900` | `text-dark-text` |
| `text-gray-500`, `text-gray-600`, `text-gray-700` | `text-dark-muted` |
| `text-gray-400` | `text-dark-subtle` |
| `hover:bg-gray-50` | `hover:bg-dark-elevated` |
| `border-brand-primary text-brand-primary hover:bg-brand-primary-light` | `border-dark-accent text-dark-accent hover:bg-dark-accent-bg` |
| `border-red-200 text-red-500 hover:bg-red-50` | `border-red-800/40 text-red-400 hover:bg-red-900/20` |
| `text-red-600` | `text-red-400` |
| Success banners | `bg-green-900/20 border-green-800/30 text-green-400` |
| Warning banners | `bg-amber-900/20 border-amber-800/30 text-amber-400` |
| Inactive badge `bg-gray-200 text-gray-600` | `bg-dark-elevated text-dark-muted` |

**Pages updated:** Dashboard, ExerciseLibrary, ExerciseDetail, Templates, TemplateEdit, SessionEdit, ExerciseUpload, Settings, Onboarding, Clients, Prescribe

Special cases:
- `Onboarding.jsx` — no TherapistNav was present (pre-login page); SidebarLayout not added; card and form darked only
- `App.jsx` — ProtectedRoute loading states: `text-gray-500` → `text-dark-muted bg-dark-bg`
- `TherapistNav.jsx` — **deleted** (no longer used)

**Components updated:**
- `ExercisePicker.jsx` — full dark sweep (card, search input, category list, configure view, all form inputs)
- `ApplyTemplateModal.jsx` — full dark sweep (overlay, card, search, category pills, template list, options step, customise step inputs)
- `ClientDataTab.jsx` — loading/error text updated
- `PrescriptionProgressSection.jsx` — card, hover, text, expand/collapse
- `CompletionStat.jsx` — text colors
- `PainChart.jsx`, `VolumeChart.jsx` — CartesianGrid stroke `#f0f0f0` → `rgba(255,255,255,0.06)`, tick labels `#9ca3af` → `#888888`

**UI polish:**
- Details button on Clients page: `border-dark-accent text-dark-accent hover:bg-dark-accent-bg` (teal border)
- Edit button on Prescribe page: same teal border treatment as Details

**Build verified:** `npm run build` exits 0. No new errors. Pre-existing chunk size warning from `@react-pdf/renderer` unchanged.

---

### Session 32 — Client + auth dark mode sweep + client BottomNav

**Goal:** Apply the dark theme (same `dark.*` token set established in Session 31) uniformly to all client pages, all auth pages, and the `/join/:code` page. Add a fixed bottom navigation bar to the client interface.

---

**Phase 1 — BottomNav component**

**New file:** `src/components/client/BottomNav.jsx`

Fixed bottom tab nav for the client interface. Three tabs: Sessions (→ `/client`), History (→ `/client/history`), Settings (→ `/client/settings`).

Key details:
- Sessions tab uses **exact** pathname match (`pathname === '/client'`) — prevents false-active highlight during SessionWizard at `/client/sessions/:id`
- `paddingBottom: 'env(safe-area-inset-bottom)'` as inline style (iOS home indicator clearance)
- `minHeight: 56px` per tab (exceeds 44px touch target requirement)
- `useReducedMotion` from framer-motion gates `transition-colors`
- `lucide-react` icons: `LayoutList`, `History`, `Settings`
- Active: `text-dark-accent`; inactive: `text-dark-muted hover:text-dark-text`
- `bg-dark-surface border-t border-dark-border z-40`

---

**Phase 2 — Client pages dark sweep**

Color mapping identical to Session 31 therapist sweep. Applied to all client pages.

**`src/pages/client/Dashboard.jsx`:**
- Full dark sweep
- Removed top-right History + Settings link buttons (BottomNav replaces them)
- Progress tab removed — moved to History page (see below)
- "Completed" badge: `bg-green-900/30 text-green-400` → `bg-dark-accent-bg text-dark-accent` (teal, matching brand accent)
- `<BottomNav />` added; `pb-20` for clearance

**`src/pages/client/ProgressTab.jsx`:**
- Loading/error text: `text-gray-500` → `text-dark-muted`, `text-red-600` → `text-red-400`

**`src/pages/client/MyExercises.jsx`:**
- Full rewrite of 9-line stub: dark theme + `<BottomNav />`

**`src/pages/client/SessionWizard.jsx`:**
- Full dark sweep across all 5 states: loading, error, done, intro, per-exercise step, summary
- **No BottomNav** — focused full-screen flow; retains its own sticky header
- Therapist note block: `bg-brand-note-bg border-brand-note-border text-brand-note-text` → `bg-dark-accent-bg border-dark-border text-dark-accent`
- Category badge: `bg-gray-100 text-gray-600` → `bg-dark-elevated text-dark-muted`
- Progress dots: past `bg-gray-400` → `bg-dark-subtle`, future `bg-gray-200` → `bg-dark-elevated`

**`src/pages/client/History.jsx`:**
- Full dark sweep
- Back link header removed (BottomNav replaces it)
- **Progress tab added** — History page now has a History / Progress tab switcher
  - Prescriptions fetched lazily on first switch to Progress tab (no overhead on initial load)
  - `clients.id` lookup → prescriptions fetch chain, same as Dashboard; only active prescriptions passed to `ProgressTab`
- `<BottomNav />` added; `pb-20`

**`src/pages/client/Settings.jsx`:**
- Full dark sweep
- Header simplified to title-only (removed back link and top-right logout button)
- Logout moved into page body as a standalone card section below the password card
- Logout uses **2-step confirmation** pattern: idle state shows "Log out" button → confirming state shows "Log out of ManualRx?" + red "Yes, log out" + "Cancel" — matches therapist sidebar's `AccountSection` pattern
- `<BottomNav />` added; `pb-20`

---

**Phase 3 — Auth + Join pages dark sweep**

All five pages follow the same dark pattern: full-screen `bg-dark-bg`, centred card `bg-dark-surface border border-dark-border rounded-xl`, teal `Logo` component (3px bar + "ManualRx" in Outfit 700 — same as homepage and sidebar), dark inputs, teal primary button text `text-[#0a0a0a]` (ensures contrast on teal bg).

Inline `Logo` function added to each file (not shared import — auth/join pages don't import therapist components):
```jsx
function Logo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '3px', height: '20px', background: '#29B5CC', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em', lineHeight: 1 }}>
        <span style={{ color: '#f0f0f0' }}>Manual</span>
        <span style={{ color: '#29B5CC' }}>Rx</span>
      </span>
    </div>
  )
}
```

**Pages updated:** `Login.jsx`, `Signup.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Join.jsx`

`ResetPassword.jsx` has three internal states (checking/invalid/form) — all three dark-themed.

`Join.jsx` has four states (loading/error/success/form) — all four dark-themed. Disabled email input uses `text-dark-subtle` to visually distinguish from editable fields.

---

**Phase 4 — Favicon**

**`index.html`** — SVG favicon added as data URI in `<head>`:
```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23111111'/><text x='4' y='23' font-family='Georgia,serif' font-weight='700' font-size='18' fill='%2329B5CC'>Rx</text></svg>" />
```
Georgia used instead of Outfit — custom fonts cannot be used in SVG data URIs rendered in browser chrome. Georgia serif gives a similar script quality for "Rx" at small sizes. `rx='6'` gives rounded corners matching iOS icon convention.

---

**Build verified:** `npm run build` exits 0. No new errors.

---

### Session 33 — Multi-category exercises

*(See summary block in "Completed" section above.)*

---

### Session 34 — iOS safe area fix + PDF branding

**iOS white safe area fix:**
- `src/index.css` — added `html, body { background-color: #0a0a0a; }` inside `@layer base`. Root cause: `viewport-fit=cover` extends content behind the iOS status bar but without an explicit body background the browser renders white in the safe area gap before React paints. The fix colours the body to match `dark.bg`.

**PDF branding update (`src/components/therapist/PrescriptionPDF.jsx`):**
- Fixed teal colour: `TEAL` constant `#3DBDB5` → `#29B5CC` (brand teal, matches app's `dark.accent`)
- Fixed light teal: `TEAL_LIGHT` `#E5F7F6` → `#E1F5FA` (matches brand light teal in `tailwind.config.js`)
- "EXERCISE PROGRAM" subtitle colour changed from `TEAL` → `GREY` (`#6B7280`)
- `notesBox` style — added `borderLeftWidth: 2, borderLeftColor: TEAL` (left accent border)
- **ManualRx logo added to header** — replaces plain clinic name text. Built from `@react-pdf/renderer` primitives only (no image file):
  - `logoRow` (flex row, `alignItems: center`)
  - `logoBar` (`View`, 3px wide, 20px tall, `#29B5CC`, `borderRadius: 2`)
  - `Text` with nested `Text`: "Manual" in `#1E2D3D` (logoManual) + "Rx" in `#29B5CC` (logoRx) — nested Text is the correct react-pdf pattern for inline colour changes within a single text node
- Subtitle updated to `EXERCISE PROGRAM — {clinicName}` so the clinic name appears beneath the logo
- `clinicName` prop retained in function signature and passed from `Prescribe.jsx` (via existing `useClinicName()` hook)
- Unused `clinicName` StyleSheet style removed

**Note on PDF colours:** The PDF document is intentionally white/print-friendly — not dark. The dark app theme does not carry into PDFs since clients print them.

---

### Session 35 — Safety disclaimers in session wizard

**Static red flag disclaimer (`src/pages/client/SessionWizard.jsx`):**
- Added a single line of muted text at the very bottom of the scrollable content area on every per-exercise step (inside the `typeof step === 'number'` branch, after all inputs and the Next button).
- Text: "Stop and seek medical advice if you experience sudden severe pain, chest pain, or dizziness."
- Styling: `text-xs text-dark-subtle text-center mt-4` — plain text only, no icon, border, or background.
- Does not appear on intro, summary, or done screens.

**High pain rating gate (`src/pages/client/SessionWizard.jsx`):**
- When `ex.painRating >= 7` (after all sets are done), an amber warning box appears between the ScaleSelector and the notes textarea:
  - Box: `rounded border border-amber-800/30 bg-amber-900/20 px-3 py-3` (matches existing amber pattern from `Clients.jsx`)
  - Copy: "Your pain rating is high. If this is new or severe, stop and seek medical advice."
  - Checkbox: "I understand, continue anyway" — standard checkbox pattern matching `ExerciseUpload.jsx`
- Next / "Review session →" button disabled (`disabled:opacity-50`) when `ex.painRating >= 7 && !painAcknowledged`.
- `painAcknowledged` is a component-level `useState(false)`, reset to `false` via `useEffect` on every `step` change — ensures each exercise requires its own acknowledgement and back-navigation clears a stale tick.
- No new files, no schema changes, no logic beyond the gate.

---

### Session 36 — AppSidebar refresh + ParticleBackground + Dashboard rebuild

**AppSidebar visual refresh (`src/components/therapist/AppSidebar.jsx`):**
- Background updated from teal-gradient to `#0e1117` (matches `dark.bg`)
- Active nav item: 2px teal left-border indicator + `rgba(41,181,204,0.08)` tinted background
- Section dividers: `rgba(41,181,204,0.12)` teal-tinted (was plain dark border)

**ParticleBackground component (`src/components/ParticleBackground.jsx`):**
- Reusable canvas 2D particle animation
- Props: `spawnFromTop` (bool — false = particles rise from bottom for dashboard full-page; true = particles fall from top for hero zones); `position` ('fixed' default vs 'absolute' for contained sections); `particleCount` (default 80)
- Respects `prefers-reduced-motion` — skips animation if user has reduced motion enabled
- Used on: Dashboard (full-page, fixed, spawnFromTop=false), HomePage hero (fixed), PageHero confined hero zones (absolute, spawnFromTop=true)

**Therapist Dashboard rebuilt (`src/pages/therapist/Dashboard.jsx`):**
- Full rewrite with glass card design
- **DashboardHeader**: time-of-day greeting, active client count — "N active clients" highlighted in `#29B5CC`
- **AdherenceCard**: 14-day dot grid per active client (done/missed/pending slots, adherence %); "See all" toggle with AnimatePresence; only shows clients with active repeating programs
- **NeedsAttentionCard**: overdue detection (≥2 consecutive missed slots), program-complete detection; dismiss-to-DB via `dashboard_dismissed_alerts` table upsert; AnimatePresence exit animation on dismiss
- **ActivityFeedCard**: last 10 sessions with RPE badge (≤6 teal/≥7 amber) and pain badge (0–4 teal/5–7 amber/8–10 red); click row → navigate to prescribe page
- Single prescriptions fetch shared by AdherenceCard and NeedsAttentionCard
- Full-page `<ParticleBackground spawnFromTop={false} />` (particles rise from bottom — this page is intentionally exempt from the hero-zone-only rule)

**New DB table:**
```sql
CREATE TABLE dashboard_dismissed_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('overdue', 'program_complete')),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (therapist_id, alert_type, prescription_id)
);
ALTER TABLE dashboard_dismissed_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapists manage own dismissed alerts" ON dashboard_dismissed_alerts
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());
```

---

### Session 37 — Full therapist UI redesign (glass card design language)

**Goal:** Bring all remaining therapist-side pages in line with the dashboard's design language.

**Global change:**
- `tailwind.config.js`: `dark.bg` updated `#0a0a0a` → `#0e1117` — eliminates visible contrast seam between sidebar and content area. Propagates via `bg-dark-bg` on `SidebarLayout`. Homepage still uses raw `#0a0a0a` hex.
- `src/index.css`: `html, body { background-color: #0e1117; }` updated to match

**New shared files:**
- `src/components/therapist/styles.js` — `CARD`, `SHIMMER`, `SECTION_LABEL` style constants (see Glass Card Design Language in Branding section above). Dashboard was also updated to import from here instead of local constants.
- `src/components/therapist/PageHero.jsx` — shared hero component used on every therapist page except Onboarding (see Branding section for spec)

**Pages redesigned:**

| Page | File | Notes |
|---|---|---|
| Clients | `Clients.jsx` | PageHero, glass card client list, staggered rows, avatar initials, status badges |
| Templates | `Templates.jsx` | PageHero, glass card template list, category filter pills |
| Exercise Library | `ExerciseLibrary.jsx` | PageHero, glass card exercise list, category filter pills |
| Exercise Upload | `ExerciseUpload.jsx` | PageHero, form in glass card, success state in glass card |
| Exercise Detail | `ExerciseDetail.jsx` | PageHero with exercise name, content in glass card |
| Prescribe | `Prescribe.jsx` | PageHero with client name + Export PDF noop + Apply Template; styled tabs with `AnimatePresence mode="wait"`; glass prescription cards |
| Session Edit | `SessionEdit.jsx` | PageHero with session name, form in glass card, exercise list in second glass card |
| Template Edit | `TemplateEdit.jsx` | PageHero with template name, same two-card pattern |
| Settings | `Settings.jsx` | PageHero "Settings / Clinic preferences and account"; motion.div form with section labels + dividers; no glass cards (form style page) |
| Onboarding | `Onboarding.jsx` | Standalone glass card (no PageHero, no SidebarLayout); shimmer top border; glass inputs and toggle buttons |

**ExercisePicker (`src/components/therapist/ExercisePicker.jsx`):**
- Full glass redesign: outer wrapper is now a glass card with shimmer top border
- All Tailwind classes replaced with inline styles using the glass design tokens
- Inputs use the standard dark glass input style
- Section header uses `SECTION_LABEL` style (uppercase, `#888888`)
- Hover states via `onMouseEnter`/`onMouseLeave` (no Tailwind needed)
- All logic unchanged

**Dashboard header fix:**
- "N active clients" text in `DashboardHeader` now uses `color: '#29B5CC'` in both the alerts-present and all-clear branches

**Key gotchas for this codebase (discovered during redesign):**
- `createTemplate()` navigates after DB insert — use `<button onClick={createTemplate}>` not `<Link to="/therapist/templates/new">` (that route doesn't exist)
- `deleteTemplate(id, name)` takes two args — always pass both
- `template_exercises?.length` not `template.exercises?.length` — the Supabase field is `template_exercises`
- ExerciseLibrary pagination is 0-indexed (`page === 0` = first page, `page >= totalPages - 1` = last)
- Delete guard for custom exercises: `ex.is_custom && ex.created_by === profile?.id` (not `ex.therapist_id`)
- `<ClientDataTab prescriptions={sessions} />` — takes `prescriptions` prop, not `clientId`
- `ApplyTemplateModal` has no `open` prop — use `{showApplyModal && <ApplyTemplateModal .../>}` conditional render

---

### Session 38 — Export all-sessions PDF

**Goal:** Wire the "Export PDF" hero button on the Prescribe page to generate a single PDF containing all active sessions for a client (not just one prescription at a time).

**New file:** `src/components/therapist/AllSessionsPDF.jsx`
- Named export `AllSessionsPDF({ clinicName, clientName, prescriptions[], weightUnit })`
- Props: `prescriptions` is an array of `{ name, frequencyLabel, exercises[] }` — each exercise is `{ name, sets, reps, weight, therapist_notes }`
- `frequencyLabel` is a pre-formatted string computed in `Prescribe.jsx` via the `frequencyLabel(frequency_days)` helper before passing to the PDF component
- Visually matches `PrescriptionPDF.jsx` (same NAVY/TEAL palette, Helvetica, en-AU date)
- One section per prescription, each exercise listed with sets×reps@weight or "Bodyweight"

**Changes to `src/pages/therapist/Prescribe.jsx`:**
- `downloadAllPDF()` async function: fetches `prescription_exercises` for all active sessions in one batch query (`.in('prescription_id', activeIds)`), builds the `prescriptions` array with `byId` map, generates blob, triggers download
- Filename: `sanitise(clientName)-all-sessions.pdf`
- Hero button wired: disabled if no active sessions, loading state with `allPdfLoading`, error state with `allPdfError`

**Test file:** `src/components/therapist/AllSessionsPDF.test.jsx` — 3 vitest tests covering: empty prescription list, prescriptions with no exercises, and prescriptions with exercises

---

### Session 39 — Pre-launch code audit

**Goal:** Remove duplicate code, fix React hook dependency bugs, and extract shared utilities before public launch.

**New files:**

| File | Purpose |
|------|---------|
| `src/components/VideoPlayer.jsx` | Shared video player component. Props: `url` (string), `className` (default `'w-full rounded'`). Handles YouTube URL normalisation (watch?v= and youtu.be/ formats) → iframe embed; native `<video>` fallback for non-YouTube URLs. Returns `null` when `url` is falsy. |
| `src/utils/frequencyUtils.js` | Two exports: `frequencyLabel(days)` (title-case: 'No repeat' / 'Daily' / 'Weekly' / 'Every N days') and `freqLabel(days)` (lowercase: 'daily' / 'weekly' / 'every N days'). `freqLabel` is for prose strings in therapist Dashboard alerts; `frequencyLabel` is for UI card labels everywhere else. |

**Modified files:**

| File | Change |
|------|--------|
| `src/pages/client/SessionWizard.jsx` | Removed inline `VideoPlayer` definition; imports shared component |
| `src/pages/client/SessionComplete.jsx` | Removed inline `VideoPlayer` definition; imports shared component |
| `src/pages/therapist/SessionEdit.jsx` | Removed inline `VideoPlayer` definition; imports shared component with `className="w-full rounded mt-2"` |
| `src/pages/therapist/TemplateEdit.jsx` | Removed inline `VideoPlayer` definition; imports shared component with `className="w-full rounded mt-2"` |
| `src/pages/therapist/Prescribe.jsx` | Removed local `frequencyLabel()`; imports from `frequencyUtils` |
| `src/pages/client/Dashboard.jsx` | Removed local `frequencyLabel()`; imports from `frequencyUtils` |
| `src/pages/therapist/Dashboard.jsx` | Removed local `freqLabel()`; imports from `frequencyUtils` |
| `src/utils/pdfUtils.js` | Added `formatPdfDate(date)` — `date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })` |
| `src/components/therapist/PrescriptionPDF.jsx` | Removed local `formatDate()`; imports `formatPdfDate` from pdfUtils |
| `src/components/therapist/AllSessionsPDF.jsx` | Removed local `formatDate()`; imports `formatPdfDate` from pdfUtils |
| `src/hooks/useWeightUnit.js` | `useEffect` deps changed from `[user, profile]` → `[user?.id, profile?.role]` (objects fail reference equality; primitives prevent redundant Supabase calls) |
| `src/hooks/useClinicName.js` | Same dep fix as above |

**Not touched:** `src/pages/therapist/ExerciseDetail.jsx` keeps its own `VideoPlayer` — its null-case renders a "No video available" placeholder div instead of returning `null`, which is intentional and different from the shared component.

**Verification:** `npm run build` exits 0 (3114 modules); `npm test` — 33/33 tests pass across pdfUtils, progressUtils, AllSessionsPDF test files.

---

### Session 40 — Create PDF dropdown: download or email to client

**Goal:** Replace the single "Export PDF" button on the Prescribe page with a "Create PDF ▾" dropdown offering two actions — download (existing) or email the PDF directly to the client.

**UX flow:** Button click → dropdown with "⬇ Download PDF" and "✉ Email to client" → email option opens a confirmation modal showing the client's email → Send button generates PDF and emails it → success toast. Cancel resets error state. Error shown inside modal so therapist can retry without reopening.

**Changes to `src/pages/therapist/Prescribe.jsx`:**
- `useRef` added to imports; `pdfBtnRef` ref added to the "Create PDF" button
- New state: `showPdfMenu`, `menuPos`, `showEmailConfirm`, `emailLoading`, `emailError`, `emailSuccess`
- Click-outside `useEffect` (named handler, not inline — same reference for add/remove)
- Dropdown uses `position: fixed` with coordinates from `getBoundingClientRect()` on click — avoids clipping by `PageHero`'s `overflow: hidden`
- `emailPDF()` function: duplicates the PDF blob-generation core from `downloadAllPDF` (deliberate — avoids shared abstraction), base64-encodes via `ArrayBuffer → Uint8Array → btoa`, invokes `send-prescription-email` edge function
- Attachment filename uses `sanitise(client.name)` — same as download convention
- `therapistFirstName`: `profile.name?.split(' ')[0]`; `clinicName ?? ''` fallback
- Confirmation modal + success toast rendered as fixed-position overlays inside SidebarLayout

**New Supabase Edge Function: `supabase/functions/send-prescription-email/index.ts`**
- Modelled exactly on `send-invite-email/index.ts` (same CORS headers, JWT auth, Resend call pattern)
- Required fields validated: `to, clientName, therapistFirstName, clinicName, attachmentFilename, pdfBase64` — `clinicName` allows empty string (checked `== null`, not falsy)
- Email subject: `"[therapistFirstName] has sent you your exercise program"`
- Email body: branded dark HTML template matching `send-invite-email` style; `senderLine` is `"[first] from [clinic]"` or just `"[first]"` if no clinic
- Resend attachment: `{ filename: attachmentFilename, content: pdfBase64 }`
- Uses existing `RESEND_API_KEY` — no new secrets needed
- Deployed via `supabase functions deploy send-prescription-email`

**Design notes:**
- Dropdown background: `rgba(13,17,23,0.95)` + `backdropFilter: blur(12px)` + `border: 1px solid rgba(41,181,204,0.15)` — matches glass card theme
- Menu items: `#94a3b8` text + `hover:bg-white/5` Tailwind hover class
- Divider: `rgba(41,181,204,0.1)` teal tint (vs plain white in earlier iteration)
- Fixed-position dropdown avoids `overflow: hidden` on `PageHero` — must use `getBoundingClientRect()` on button open; `right` computed as `window.innerWidth - rect.right`

