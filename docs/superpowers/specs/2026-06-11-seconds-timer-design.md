# Seconds Exercise Timer — Design Spec

**Date:** 2026-06-11  
**Status:** Approved

---

## Overview

When a therapist prescribes an exercise with `measurement_type = 'seconds'`, the client's SessionWizard currently shows a plain text input labelled "Seconds". This spec adds a countdown timer so the client has an in-app tool to time each set without leaving the screen.

---

## 1. Component — `SetTimer`

**File:** `src/components/client/SetTimer.jsx`

Self-contained countdown timer with an SVG progress ring. No Supabase dependency.

### Props

| Prop | Type | Description |
|---|---|---|
| `targetSeconds` | `number` | The prescribed duration (from `ex.reps` when `measurement_type === 'seconds'`) |
| `onComplete` | `(seconds: number) => void` | Called when countdown reaches 0; receives `targetSeconds` so caller can auto-fill the reps field |
| `onReset` | `() => void` | Called when user taps Reset; caller clears the reps field |

### State

| Field | Values | Description |
|---|---|---|
| `timeLeft` | `number` | Seconds remaining; initialised to `targetSeconds` |
| `phase` | `'idle' \| 'running' \| 'paused' \| 'done'` | Controls tick, button labels, and ring colour |

### Phase transitions

```
idle  ──[Start]──▶  running  ──[Pause]──▶  paused  ──[Resume]──▶  running
                       │                      │
                  [timeLeft=0]             [Reset]
                       │                      │
                       ▼                      ▼
                      done                   idle
```

Any phase → `idle` via Reset (also calls `onReset`).

### Tick mechanism

`useEffect` with `setInterval(1000)` while `phase === 'running'`. Returns cleanup function. Does not over-tick — interval is cleared immediately when phase leaves `running`.

### Visual

- SVG ring: 96×96 px, track circle + progress arc
- `stroke-dasharray` = circumference of the arc (`2π × r`)
- `stroke-dashoffset` = circumference × `(timeLeft / targetSeconds)` — fills as time elapses
- Centre: large `timeLeft` number in bold monospace; sub-label "of Xs"
- Ring colour: `#29B5CC` while running/paused, `rgba(74,222,128,0.8)` (success green) when done
- Controls below the ring:
  - `idle`: "▶ Start Timer" button (full-width, tinted border)
  - `running`: "⏸ Pause" + small "↺ Reset" text button
  - `paused`: "▶ Resume" + small "↺ Reset" text button
  - `done`: muted "Done ✓" label — no controls

### Completion feedback

`navigator.vibrate(200)` on done, wrapped in a try/catch so it silently no-ops on desktop and unsupported browsers. No audio — avoids permission prompts.

---

## 2. Integration — standalone exercises

**File:** `src/pages/client/SessionWizard.jsx`

**Condition:** `ex.measurement_type === 'seconds'` and `!allSetsDone`

**Location:** Inside the per-set inputs section, replace the "Seconds" text input with `SetTimer`. The weight input column is unchanged. A manual override input remains below the ring (standard `<input>` for the `reps` field, pre-filled by the timer but still editable).

```jsx
<div>
  <label ...>{ex.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}</label>
  {ex.measurement_type === 'seconds' ? (
    <>
      <SetTimer
        key={currentSet}
        targetSeconds={Number(ex.reps) || 0}
        onComplete={secs => updateSetField(exIdx, currentSet, 'reps', String(secs))}
        onReset={() => updateSetField(exIdx, currentSet, 'reps', '')}
      />
      {/* manual override — always visible below the ring */}
      <input
        type="text" inputMode="numeric"
        value={currentSetData.reps}
        onChange={e => updateSetField(exIdx, currentSet, 'reps', e.target.value)}
        placeholder={ex.reps ? String(ex.reps) : '—'}
        style={/* existing input styles */}
      />
    </>
  ) : (
    <input /* existing reps input */ />
  )}
</div>
```

`key={currentSet}` causes React to fully remount `SetTimer` on each new set, giving a fresh `idle` state automatically. The override input is always editable — the timer pre-fills it on completion, but the client can correct it (e.g. they only managed 20 of 30 seconds).

The "Complete Set →" button's existing `disabled={!currentSetData.reps}` guard is satisfied once `onComplete` fires and fills the `reps` field. The client still taps the button manually to advance.

---

## 3. Integration — superset rounds

**File:** `src/pages/client/SessionWizard.jsx`

**Condition:** `pe.measurement_type === 'seconds'` (per exercise inside the superset card)

**Location:** Inside each superset exercise card's left-column input (the "Seconds/Reps" field in the 2-column grid).

```jsx
<div>
  <label ...>{pe.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}</label>
  {pe.measurement_type === 'seconds' ? (
    <>
      <SetTimer
        key={currentRound}
        targetSeconds={Number(pe.reps) || 0}
        onComplete={secs => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', String(secs))}
        onReset={() => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', '')}
      />
      {/* manual override */}
      <input
        type="text" inputMode="numeric"
        value={roundData.reps}
        onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', e.target.value)}
        placeholder={pe.reps ? String(pe.reps) : '—'}
        style={/* existing input styles */}
      />
    </>
  ) : (
    <input /* existing reps input */ />
  )}
</div>
```

`key={currentRound}` resets the timer on each new superset round.

---

## 4. Manual override

The override input rendered below the ring (in both standalone and superset contexts) is always visible and editable. The timer pre-fills it when the countdown completes, but the client can correct it — e.g. they only held for 20 of 30 prescribed seconds. Styling matches the existing reps input (`var(--color-elevated)` background, `var(--color-border)` border).

---

## 5. Edge cases

- **`targetSeconds` is 0 or falsy:** Show a disabled "Start Timer" button with no ring visible. Client must type manually. (`ex.reps` should never be 0 in a valid prescription, but guard defensively.)
- **Component unmounts mid-countdown:** `useEffect` cleanup clears the interval — no memory leak, no state update on unmounted component.
- **Multiple timers on screen at once (supersets):** Each `SetTimer` instance is independent — separate state, separate interval. Running one does not affect others.
- **Client navigates back mid-set:** The timer is remounted when they return (via `key={currentSet}`), resetting to `idle`. Any auto-filled `reps` value persists in the parent's `setsData` state.

---

## 6. Data flow

```
prescription_exercises.measurement_type = 'seconds'
  └─▶ SessionWizard detects seconds exercise
        └─▶ Renders SetTimer instead of reps input
              └─▶ Client taps Start → countdown runs
                    └─▶ Reaches 0 → onComplete(targetSeconds)
                          └─▶ updateSetField fills setsData[currentSet].reps
                                └─▶ "Complete Set" button enabled
                                      └─▶ Client taps → completeSet() advances
                                            └─▶ setsData logged to exercise_logs as normal
```

No changes to the logging schema — `setsData[i].reps` already stores the seconds value as a string, same as reps-based exercises.
