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
Colour palette undecided — awaiting outside feedback. Three options shortlisted after eight rounds of exploration. Typography and logo not yet explored.

### Design Direction
- **Feel:** Clinical without being cold. Professional enough for health practitioners, not so sterile it feels like a hospital system.
- **Audience split:** Therapist interface — used at a desk, needs to feel like a professional tool. Client interface — used on mobile at home, needs to feel approachable and simple.
- **Reference point:** A well-designed allied health clinic, not a gym app or a consumer wellness product.
- **Key principle:** Restraint. Whitespace, tight typography, and neutral backgrounds do the heavy lifting. Colour is used intentionally, not decoratively.

---

### Shortlisted Palettes (decision pending)

All three options use the same UI preview layout for comparison: dark nav bar, white card content area, two session cards (one with a Completed badge), a therapist note box, and a primary/secondary button pair.

---

#### Option 1 — Ocean Slate
**Tag:** Bookmarked — Round 1
**Verdict:** Strongest overall. Safe choice that doesn't feel safe.
**Description:** Professional, clinical, distinctive. Health without hospital coldness. The teal-green in the slate separates it from pure blue — more health-coded, less finance.

| Role | Hex |
|---|---|
| Nav | `#1A2F36` |
| Primary | `#2E6B7A` |
| Primary Dark | `#1F4E5A` |
| Primary Light | `#E5F1F4` |
| Mid (for gradients/swatches) | `#5A9BAA` |
| Background | `#F7F8F8` |
| Border | `#D6E4E8` |
| Badge background | `#E5F1F4` |
| Badge text | `#1F4E5A` |

**Nav active link colour:** `#5BBDCE` (lighter teal, readable on dark nav)
**Note box:** Background `#E5F1F4`, border `#D6E4E8`, text `#1F4E5A`

---

#### Option 2 — Mint Primary
**Tag:** Bookmarked — Round 2
**Verdict:** Most distinctive. Higher risk, higher reward.
**Description:** Carbon nav gives the mint enough weight to feel professional rather than soft. The contrast is sharp and memorable. Sits at the health/fitness crossover more than Option 1.

| Role | Hex |
|---|---|
| Nav | `#1C1C1C` |
| Primary | `#4DB896` |
| Primary Dark | `#2A8A6A` |
| Primary Light | `#E8F8F3` |
| Mid (for gradients/swatches) | `#8ED4BC` |
| Background | `#F7F8F8` |
| Border | `#D4EAE3` |
| Badge background | `#E8F8F3` |
| Badge text | `#2A8A6A` |

**Nav active link colour:** `#4DB896` (mint directly on carbon nav)
**Note box:** Background `#E8F8F3`, border `#D4EAE3`, text `#2A8A6A`

---

#### Option 3 — Monochrome + Ocean Slate
**Tag:** Standout — Round 8
**Verdict:** Most refined. Colour used with maximum intentionality.
**Description:** Pure black nav, white content, grey borders — Ocean Slate appears only on interactive elements (buttons, active links, focus rings, badges). The single colour hit carries all brand meaning. Most influenced by Linear/Notion aesthetic applied to health.

| Role | Hex |
|---|---|
| Nav | `#111111` |
| Primary | `#2E6B7A` |
| Primary Dark | `#1F4E5A` |
| Primary Light | `#E5F1F4` |
| Text | `#1A1A1A` |
| Background | `#FAFAFA` |
| Border | `#E0E0E0` |
| Badge background | `#E5F1F4` |
| Badge text | `#1F4E5A` |

**Nav active link colour:** `#2E6B7A` (Ocean Slate on black nav)
**Note box:** Background `#E5F1F4`, border `#E0E0E0`, text `#1F4E5A`

---

### UI Preview Spec
To recreate the comparison artifact exactly:

- **Layout:** Three equal columns, each containing: label block (name, tag, description) → UI preview card → swatch strip (4 colours, equal width) → verdict box → hex reference list
- **Nav bar:** Dark background (`nav` colour), white bold logo left, nav links right (40% opacity white for inactive, primary colour + underline for active "Account" link)
- **Content area:** White background, 20px padding. Subheading label in primary colour uppercase monospace, page title in `text` colour. Two session cards stacked vertically with border, name + optional Completed badge + subtitle. Start button in primary colour. Therapist note box below cards. Primary + secondary button row at bottom.
- **Swatch strip:** 4 swatches equal width, 20px height, 4px border radius, subtle inset shadow
- **Verdict box:** White background, italic text, light border
- **Hex block:** Monospace, small, muted grey, 4 rows (Nav / Primary / Dark / Light)
- **Page background:** `#F4F4F2`
- **Font:** Georgia serif throughout


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

### Next steps (in priority order)

**You (manual steps before next Claude session):**
1. Register manualrx.app — do this first; also check manualrx.com (Cloudflare Registrar or Namecheap)
2. Rename GitHub repo — github.com/zacwilliams03/prescriptr → Settings → General → rename to `manualrx`
3. Rename Supabase project — Project Settings → General → name → ManualRx (cosmetic only)
4. Rename Vercel project — Settings → General → Project Name → manualrx; then Domains → add manualrx.app
5. Update Supabase Auth URLs — Authentication → URL Configuration → Site URL: https://manualrx.app; Redirect URLs: add https://manualrx.app/reset-password, remove any prescriptr references

**Claude (codebase rename — paste this into the next session):**

> We are renaming the app from PrescriptR to ManualRx. Please search the entire codebase for every reference to "PrescriptR", "prescriptr", "Prescriptr" and "PRESCRIPTR" (case-insensitive) and replace appropriately with "ManualRx" or "manualrx" depending on context. Specifically:
> - `index.html` — update the `<title>` tag and any meta/og tags
> - `src/components/therapist/TherapistNav.jsx` — update the logo/brand name in the nav bar
> - `src/pages/client/Dashboard.jsx` — update any brand name visible to clients
> - `src/pages/auth/Login.jsx` — update any brand name in headings or copy
> - `src/pages/auth/ForgotPassword.jsx` — update any brand name in UI copy
> - `src/pages/auth/ResetPassword.jsx` — update any brand name in UI copy
> - `src/pages/Account.jsx` — update any brand name in UI copy
> - `package.json` — update the name field to manualrx
> - `vite.config.js` — check for any hardcoded app name references
> - Run a global search across all of `src/` for any remaining references and replace them
>
> After making changes, confirm every file that was modified and show me the specific lines that changed.

**After name change:**
1. Video content decision for built-in library
2. Stripe integration



Note for Claude- always tell me if I should switch models to something more powerful, or if a lighter model is okay.

