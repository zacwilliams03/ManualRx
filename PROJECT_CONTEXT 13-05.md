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

### Name Decision Log

| Name | Status | Reason ruled out |
|---|---|---|
| **PrescriptRx** | ❌ ruled out | Redundant — "Prescript" + "Rx" both mean prescription |
| **PrescriptR** | ❌ ruled out | Established US company at prescriptr.com — brand conflict, drug connotation risk |
| **PrescribR** | ❌ ruled out | Dropped vowel styling dated; same brand conflict risk |
| **TherAlign** | ❌ ruled out | TherAlignHealth is a US drug prescription company |
| **MotionRx / KineticRx / RehabRx / Scriptly** | ❌ ruled out | All taken by existing operating businesses |
| **ManualRx** | ✅ **SELECTED** | No trademark registrations (USPTO/IP Australia), no conflicting business found, "manual therapy" is correct clinical term across massage/physio/OT, Rx reads as clinical shorthand not drug prescription in context |

**Trademark note:** File for registration in AU and US before any serious US expansion.

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
- **therapist_profiles** — user_id, clinic_name, logo_url, branding_color
- **clients** — id, therapist_id, user_id, name, email, created_at
- **client_invites** — id, therapist_id, code (unique), email, name, created_at, consumed_at (nullable), expires_at
- **exercises** — id, name, description, category, video_url, thumbnail_url, is_custom, created_by (null if built-in), default_sets, default_reps, fts (tsvector, generated), created_at
- **therapist_video_library** — id, therapist_id, exercise_id, video_url, label, created_at
- **prescriptions** — id, therapist_id, client_id, name, frequency_days (nullable integer), created_at, notes
- **prescription_exercises** — id, prescription_id, exercise_id, sets, reps, weight (nullable numeric), frequency, therapist_notes, order
- **session_logs** — id, prescription_id, client_id, completed_at, session_rpe (0–10), session_notes
- **exercise_logs** — id, prescription_exercise_id, client_id, session_log_id (FK to session_logs), completed_at, sets_completed, reps_completed (nullable — deprecated, null on new logs), weight_completed (nullable — deprecated, null on new logs), pain_rating (0–10), client_notes, video_url, sets_data (JSONB — array of `{reps, weight}` per set; use this for all new logs)

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
- [x] Therapist persistent nav — top bar with Clients + Exercises links, time-of-day greeting on dashboard, live client count
- [ ] Video content for built-in exercise library (decision pending)
- [ ] Stripe integration
- [x] Password reset / email flows
- [ ] Therapist mobile polish pass (separate, lower priority)
- [x] App deployed to Vercel at www.manualrx.com
- [x] Fix client login bug (disabled email confirmation in Supabase — Session 15)
- [x] Automatic invite email — Resend + Supabase Edge Function built and deployed (Session 15). ⚠️ Needs end-to-end test once Resend domain verification completes for manualrx.com
- [x] Therapist onboarding flow — one-time /onboarding page shown after signup (Session 16)
- [x] Therapist settings page — permanent /settings page accessible from nav (Session 16)

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


## Branding

### Status
Colour palette **decided** (Session 18). Typography **decided** (Session 18). Logo and favicon not yet done.

### Decisions locked

**Colour palette — Slate Navy + Bright Teal**

| Role | Hex | Tailwind token |
|---|---|---|
| Nav background | `#1E2D3D` | `bg-brand-nav` |
| Primary (buttons, links, active) | `#3DBDB5` | `bg-brand-primary` / `text-brand-primary` |
| Primary dark (hover, dark text) | `#2A8A86` | `bg-brand-primary-dark` |
| Primary light (badge bg, info panels) | `#E5F7F6` | `bg-brand-primary-light` |
| Page background | `#F7F8F9` | `bg-brand-bg` |
| Border | `#D4E8E8` | `border-brand-border` |
| Note box background | `#EEF6F6` | `bg-brand-note-bg` |
| Note box border | `#C8E8E6` | `border-brand-note-border` |
| Note box text | `#2A8A86` | `text-brand-note-text` |

All tokens are defined in `tailwind.config.js` under `theme.extend.colors.brand`. Badge bg = `brand-primary-light`, badge text = `brand-primary-dark`. Invite email template still uses old `#2E6B7A` — update when re-doing email templates.

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
- Marketing/home page — does not exist yet. Required before launch.
- Privacy policy page — required before launch (AU Privacy Act). Can live on the marketing site.
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

---

Note for Claude — always tell me if I should switch models to something more powerful, or if a lighter model is okay.

