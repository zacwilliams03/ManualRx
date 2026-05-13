# Project Context — PrescriptR
> Paste this file into every new Claude/Claude Code session before asking for help.
> Keep it updated as the project evolves.

---

## App Name

**Status: Undecided — intentionally sitting on this**
- Working placeholder: PrescriptR
- Final decision pending customer research
- All domain options (.app) are available at reasonable prices across the shortlist

### Name Shortlist (decision pending — sitting on this intentionally)

| Name | Domain | Pros | Cons |
|---|---|---|---|
| **PrescriptR** | prescriptr.app | Modern SaaS feel, stylised R hints at Rx, unique spelling aids trademark | Dropped vowel styling feeling dated, Rx connection subtle enough to be missed, pronunciation ambiguous |
| **PrescriptRx** | prescriptrx.app | Rx unmistakable to health professionals, reads cleanly | Redundant — "Prescript" + "Rx" both mean prescription, feels silly once noticed ❌ ruled out |
| **PrescribR** | prescribr.app | Verb form feels active, stylised R completes the word naturally | Same dropped vowel dating issue, slightly awkward to say |
| **TherAlign** | theralign.app / theralign.fit | Premium and clinical, "Thera+Align" resonates with manual therapy, easy to say, no redundancy | "Thera" prefix shared with some competitors, less obvious it's a SaaS tool |
| **ManualRx** | manualrx.app | Direct, any manual/massage therapist immediately knows it's for them, Rx works cleanly here | "Manual" is a common word so harder to trademark, slightly blunt as a brand |

**Key notes:**
- PrescriptRx effectively ruled out — redundant naming once you see it
- ManualRx is the strongest Rx option — "Manual" and "Rx" are genuinely different words
- TherAlign remains strongest for clinic/professional positioning
- PrescriptR and PrescribR suit individual therapist positioning better

**Decision driver:** Revisit after first customer research conversations. Individual therapists → PrescriptR or ManualRx. Clinic owners → TherAlign.

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

## Database Structure (planned)

### Tables
- **users** — id, email, role (therapist / client), name, created_at
- **therapist_profiles** — user_id, clinic_name, logo_url, branding_color
- **clients** — id, therapist_id, user_id, name, email, created_at
- **exercises** — id, name, description, category, video_url, thumbnail_url, is_custom, created_by (null if built-in), created_at
- **therapist_video_library** — id, therapist_id, exercise_id, video_url, label, created_at
- **prescriptions** — id, therapist_id, client_id, created_at, notes
- **prescription_exercises** — id, prescription_id, exercise_id, sets, reps, frequency, therapist_notes, order
- **exercise_logs** — id, prescription_exercise_id, client_id, completed_at, sets_completed, reps_completed, client_notes

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
| Solo | $19/month | 1 therapist, unlimited clients |
| Clinic | $49/month | Up to 5 therapists, shared custom library |
| Practice | $99/month | Unlimited therapists, analytics, white-label |

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
- [x] App name decided: PrescriptR
- [x] Project context document created
- [ ] Repo created on GitHub
- [ ] Supabase project created
- [ ] Base React app scaffolded
- [ ] Auth (login/signup) working
- [ ] Exercise library (basic)
- [ ] Prescription flow
- [ ] Client portal
- [ ] Video upload
- [ ] Stripe integration

---

## How to Use This File

**At the start of every Claude Code or Claude.ai session**, paste this file and say:
> "Here is my project context. I'd like to [what you want to do today]."

This gives Claude full context without you having to re-explain the project every time.

**Keep this file updated** as you build — check off completed items, add new decisions, update the database structure when it changes.

---

## Open Questions / Decisions To Make

- ~~What to name the app~~ → Working name: PrescriptR, TherAlign bookmarked
- **Primary customer:** Individual therapists vs clinic owners — needs more research before marketing decisions
- Where to source the initial built-in exercise video library
- Whether to build native mobile apps later or stick with a mobile-responsive web app
- HIPAA/privacy compliance requirements (important for selling to US clinics)
- Trademark search needed for PrescriptR (check IP Australia + USPTO)

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
