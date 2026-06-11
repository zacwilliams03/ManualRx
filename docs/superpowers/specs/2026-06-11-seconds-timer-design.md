# Seconds Exercise Timer — Design Spec

**Date:** 2026-06-11  
**Status:** Approved (post-review revision 1)

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

`useEffect` with `setInterval(1000)` while `phase === 'running'`. Returns cleanup function. Interval is cleared immediately on phase change to prevent over-ticking.

**Known limitation:** `setInterval(1000)` accumulates drift and pauses when the browser tab/app is backgrounded. For 30–60s physio holds this is acceptable in v1. A timestamp-based approach (`Date.now()` delta) should replace this in a future iteration if clients report incorrect times.

### Visual

- SVG ring: 96×96 px, centred, track circle + progress arc
- Arc starts at 12 o'clock: `transform="rotate(-90 48 48)"` on the progress circle
- **Draining ring** (starts full, empties as time runs out):
  - `stroke-dasharray` = circumference (`2π × r`, e.g. `251` for r=40)
  - `stroke-dashoffset` = `circumference × (1 - timeLeft / targetSeconds)`
  - At start (timeLeft = targetSeconds): offset = 0, arc fully drawn
  - At end (timeLeft = 0): offset = circumference, arc empty
- Centre text: large `timeLeft` number in bold monospace; sub-label `"of {targetSeconds}s"`
- Ring colour: `#29B5CC` while idle/running/paused, `var(--color-success)` when done
- Controls below the ring:
  - `idle`: "▶ Start Timer" button (full-width, `#29B5CC` tinted border style)
  - `running`: "⏸ Pause" button + small "↺ Reset" text link
  - `paused`: "▶ Resume" button + small "↺ Reset" text link
  - `done`: muted "Done ✓" label — no controls
- **`targetSeconds` is 0 or falsy:** render no ring; show a disabled "▶ Start Timer" button; the override input (§4) is still rendered so the client can type manually

### Completion feedback

`navigator.vibrate(200)` called on transition to `done`, wrapped in try/catch. Silently no-ops on desktop and unsupported browsers. Note: because this fires on timer completion rather than a direct user gesture, some mobile browsers may ignore it — treat it as best-effort.

### Reset and the "Complete Set" guard

When the client taps Reset, `onReset` fires (clearing `reps` to `''`) and phase returns to `idle`. This re-disables the "Complete Set" button. The client must either run the timer to completion again, or type a value into the override input. This is intentional — Reset is a "start over" action, not a "skip" action.

---

## 2. Integration — standalone exercises

**File:** `src/pages/client/SessionWizard.jsx`

**Condition:** `ex.measurement_type === 'seconds'` and `!allSetsDone`

**Layout:** The existing 2-column grid (`[Seconds/Reps input] | [Weight input]`) is replaced with a vertical stack when the exercise is seconds-based:

1. `SetTimer` (full width, centred)
2. 2-column grid: `[Actual (sec) input] | [Weight input]`

The "Actual (sec)" label replaces the existing "Seconds" label on the override input (see §4) to make clear it is an editable result, not a target.

```jsx
{ex.measurement_type === 'seconds' ? (
  <>
    <SetTimer
      key={currentSet}
      targetSeconds={Number(ex.reps) || 0}
      onComplete={secs => updateSetField(exIdx, currentSet, 'reps', String(secs))}
      onReset={() => updateSetField(exIdx, currentSet, 'reps', '')}
    />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <div>
        <label style={labelStyle}>Actual (sec)</label>
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={currentSetData.reps}
          onChange={e => updateSetField(exIdx, currentSet, 'reps', e.target.value)}
          placeholder={ex.reps ? String(ex.reps) : '—'}
          style={inputStyle}
        />
      </div>
      <div>
        {/* existing weight input — unchanged */}
      </div>
    </div>
  </>
) : (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
    {/* existing reps + weight inputs unchanged */}
  </div>
)}
```

`key={currentSet}` causes React to fully remount `SetTimer` on each new set, giving a fresh `idle` state automatically.

**Auto-fill semantics:** `onComplete` fills `reps` with `targetSeconds` (the prescribed target) as the default logged value. The client edits this down in the override input if they held for less than the full duration. The timer does not track actual elapsed time — it simply stamps the prescription.

The "Complete Set →" button's existing `disabled={!currentSetData.reps}` guard is satisfied once `onComplete` fires. The client still taps the button manually to advance.

---

## 3. Integration — superset rounds

**File:** `src/pages/client/SessionWizard.jsx`

**Condition:** `pe.measurement_type === 'seconds'` (per exercise inside the superset card)

**Layout:** Unlike standalone exercises, superset exercise cards currently use a compact 2-column grid inside a card that stacks multiple exercises. Placing a 96×96 ring in one grid cell would unbalance the layout. Instead, when `pe.measurement_type === 'seconds'`:

1. `SetTimer` renders **full-width** above the 2-column grid (spanning the card)
2. 2-column grid below: `[Actual (sec) input] | [Weight input]`

```jsx
<div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
  {pe.measurement_type === 'seconds' && (
    <SetTimer
      key={currentRound}
      targetSeconds={Number(pe.reps) || 0}
      onComplete={secs => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', String(secs))}
      onReset={() => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', '')}
    />
  )}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
    <div>
      <label style={labelStyle}>
        {pe.measurement_type === 'seconds' ? 'Actual (sec)' : 'Reps'}
      </label>
      <input
        type="text" inputMode="numeric" pattern="[0-9]*"
        value={roundData.reps}
        onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', e.target.value)}
        placeholder={pe.reps ? String(pe.reps) : '—'}
        style={inputStyle}
      />
    </div>
    <div>
      {/* existing weight input — unchanged */}
    </div>
  </div>
</div>
```

`key={currentRound}` resets the timer on each new superset round.

---

## 4. Manual override

The "Actual (sec)" input is always rendered regardless of `targetSeconds` value (including 0). This ensures the client always has a manual entry path. When `targetSeconds = 0` the timer renders no ring and a disabled Start button — the override input is the only way to log a value.

The timer pre-fills the override on completion with `targetSeconds` (the prescribed target). The client edits down if they held for less. Styling matches existing inputs: `var(--color-elevated)` background, `var(--color-border)` border.

---

## 5. Edge cases

- **`targetSeconds` is 0 or falsy:** No ring rendered; Start button disabled; override input always visible for manual entry.
- **Reset mid-countdown:** `reps` cleared → "Complete Set" disabled. Client must complete timer or type manually. Intentional.
- **Component unmounts mid-countdown:** `useEffect` cleanup clears interval — no leak, no setState on unmounted component.
- **Multiple timers on screen (supersets):** Each `SetTimer` instance is independent. Running one does not affect others.
- **Client backgrounds the app mid-hold:** `setInterval` pauses in backgrounded tabs on some mobile browsers — timer will appear frozen then jump on return. Acceptable in v1; timestamp-based ticking is the fix for v2.
- **Client navigates back mid-set:** Timer remounts via `key={currentSet}` on return, resetting to `idle`. Any auto-filled `reps` value persists in parent `setsData`.

---

## 6. Data flow

```
prescription_exercises.measurement_type = 'seconds'
  └─▶ SessionWizard detects seconds exercise
        └─▶ Renders SetTimer (full-width) + "Actual (sec)" override input
              └─▶ Client taps Start → draining ring counts down
                    └─▶ Reaches 0 → onComplete(targetSeconds) → vibrate(200)
                          └─▶ updateSetField fills setsData[currentSet].reps with targetSeconds
                                └─▶ Client edits override if needed, then taps "Complete Set"
                                      └─▶ completeSet() advances to next set
                                            └─▶ setsData logged to exercise_logs as normal
```

No changes to the logging schema — `setsData[i].reps` already stores the seconds value as a string, identical to reps-based exercises.
