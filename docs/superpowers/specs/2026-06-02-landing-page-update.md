# Landing Page Update — Spec

**Date:** 2026-06-02  
**File:** `src/pages/HomePage.jsx`

## Summary

Three changes to the landing page:
1. Replace the draft `AppMockup` hero component with `DualViewMockup` — two overlapping browser windows showing the real therapist and client UI
2. Expand the features section from 3 cards to 6, covering video feedback, tracking, templates, branding, notes, and adherence
3. Add a one-sentence template mention to How It Works step 02

Pricing section is out of scope.

---

## 1. DualViewMockup (hero)

Two overlapping browser-chrome windows, static, hidden on mobile (`className="hidden md:block"`).

**Container:** `position: relative`, `width: 100%`, `height: 460px`

**Back window (client):** `right: 0`, `top: 40px`, `width: 55%`, `zIndex: 1`, subtle box-shadow
- URL bar: `manualrx.com/client`
- Content: "My Sessions" + 2 program cards (Start button / Done today badge)

**Front window (therapist):** `left: 0`, `top: 0`, `width: 62%`, `zIndex: 2`, teal glow shadow
- URL bar: `manualrx.com/therapist`
- Sidebar (40px): "Rx" logotype + 4 nav slots
- Main: greeting, adherence card (dot grid), needs-attention card (red/green badges)

**Framer Motion:** back window `delay: 0`, front window `delay: 0.15`, both `y: 24 → 0`, `opacity: 0 → 1`, `duration: 0.7`

**Tokens:** `#0e1117` bg, `rgba(13,17,23,0.85)` surface, `#29B5CC` accent, `rgba(100,160,255,0.08)` border

---

## 2. Features Section (6 cards)

Grid: 3 cols × 2 rows, same `gap: '1px'` separator pattern. No `featured` flag.

| Icon function | Title | Description |
|---|---|---|
| `FeedbackVideoIcon` | Video Feedback Loop | Attach demo videos to any exercise. Clients record their form and send it back — no WhatsApp needed. |
| `TrackingIcon` | Pain & Volume Tracking | Session-by-session charts visible to you and your client. Watch them improve in real time. |
| `TemplatesIcon` | Session Templates | Build a program once and prescribe it to any client instantly. Edit per-patient without touching the original. |
| `BrandingIcon` | Clinic Branding | Your logo sits at the top of every client session. Every rep reinforces your practice. |
| `NotesIcon` | Notes & Feedback | Leave cues on each exercise. Clients respond with notes and pain ratings — per set, not just per session. |
| `AdherenceIcon` | Adherence at a Glance | Dot-pattern compliance view across all clients. Know who's keeping up without opening a single chart. |

SVG paths: all `width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#29B5CC" strokeWidth="1.75"` — see plan file for exact element lists.

---

## 3. How It Works — Step 02

**Before:** `'Search the exercise library, configure reps and sets, add notes, and attach videos in minutes.'`

**After:** `'Search the exercise library, configure reps and sets, add notes, and attach videos. Or apply a template to populate a full program in seconds.'`
