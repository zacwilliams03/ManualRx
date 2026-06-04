# Exercise Measurement Type & Bilateral Flag

**Date:** 2026-06-03  
**Status:** Draft

---

## Why This Change

Currently all exercises are logged in sets × reps. Some exercises (e.g. planks, wall sits, isometric holds) are naturally measured in seconds, not repetitions. There is also no way to instruct a client to perform a unilateral exercise (one that targets a single side of the body) on both sides — the therapist has no mechanism to communicate this, and the client has no reminder.

This change adds two new attributes to the exercise system:

1. **Measurement type** — whether an exercise's working unit is "reps" or "seconds"
2. **Bilateral flag** — whether the client should be reminded to perform the exercise on both sides

---

## What's Changing

### For the Therapist (Prescribing)

When a therapist adds an exercise to a session, the configuration panel (where they set sets, reps, weight, and notes) will gain two new controls:

- **Measurement type toggle:** Switches between "Reps" and "Seconds". Replaces the reps input with a seconds input when set to Seconds. Defaults to whatever the exercise library says, but the therapist can change it freely.
- **"Both sides" checkbox:** Ticks to mark this exercise as bilateral. Defaults to the library default, but can be overridden. When ticked, the client will see a reminder to complete the exercise on both sides.

When creating a custom exercise in the Exercise Upload page, therapists will also be able to set the default measurement type and bilateral flag for that exercise.

### For the Client (Completing a Session)

In the session wizard:

- **Time-based exercises:** The target shown changes from "3 sets × 10 reps" to "3 sets × 30 seconds". The per-set input fields ask for seconds achieved instead of reps achieved (e.g. "How many seconds did you hold?"). Weight input remains unchanged.
- **Bilateral exercises:** A visible reminder appears on the exercise card (e.g. "Complete on both sides"). No change to the number of inputs — the client logs the same sets as normal.

### For the PDF Export

The exported PDF adapts to show:
- "30 sec" instead of "10 reps" for timed exercises
- A "Both sides" label for bilateral exercises

---

## Database Changes

Two new columns are added to the **exercises** table (the exercise library):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_timed` | boolean | false | Library-level default: is this exercise measured in seconds? |
| `is_bilateral` | boolean | false | Library-level default: should this exercise be done on both sides? |

Two new columns are added to the **prescription_exercises** table (the per-prescription exercise record):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `measurement_type` | text ('reps' or 'seconds') | 'reps' | Per-prescription measurement unit (copied from library default, overridable) |
| `bilateral` | boolean | false | Per-prescription bilateral flag (copied from library default, overridable) |

The per-set data that clients log (stored as a flexible JSON field) will store `seconds` instead of `reps` for time-based exercises. No schema change is needed for this — the field is already flexible.

---

## Files That Will Change

| File | What changes |
|------|-------------|
| `supabase/migrations/` | New migration adding the 4 columns above |
| `src/components/therapist/ExercisePicker.jsx` | Config panel: add measurement type toggle + bilateral checkbox |
| `src/pages/therapist/ExerciseUpload.jsx` | Add default measurement type + bilateral toggle when creating custom exercises |
| `src/pages/client/SessionWizard.jsx` | Show seconds target/inputs for timed exercises; show bilateral reminder |
| `src/components/therapist/PrescriptionPDF.jsx` | Show "sec" units and bilateral label in PDF output |

---

## What Does Not Change

- The number of sets/inputs the client sees is unchanged for bilateral exercises — it is a reminder only, not a structural change to how they log their work.
- Weight input remains available for both rep-based and time-based exercises.
- All existing exercises default to rep-based and non-bilateral, so no data migration is needed for existing prescriptions.

---

## Verification

- Prescribe a new exercise with measurement type set to "Seconds" and confirm the client session wizard shows seconds inputs and the correct target label.
- Prescribe a bilateral exercise and confirm the client sees the "both sides" reminder but the input structure is unchanged.
- Export a PDF containing both types and confirm the PDF reflects the correct units and bilateral labels.
- Create a custom exercise with `is_timed = true` and `is_bilateral = true`, prescribe it, and confirm the ExercisePicker defaults match.
- Confirm existing prescriptions (rep-based, non-bilateral) are unaffected.
