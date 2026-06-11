# Seconds Exercise Timer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a countdown timer to the SessionWizard for exercises prescribed in seconds, so clients can time each set without leaving the screen.

**Architecture:** A new self-contained `SetTimer` component renders an SVG countdown ring with Start/Pause/Resume/Reset controls. SessionWizard imports it and swaps it in wherever `measurement_type === 'seconds'` — both in the standalone exercise set entry screen and inside superset round cards. The timer auto-fills the "Actual (sec)" input when the countdown completes; the client still taps "Complete Set" manually.

**Tech Stack:** React 18, Vite, Vitest (no new dependencies)

---

## File Map

| Action | File | What changes |
|---|---|---|
| Create | `src/components/client/SetTimer.jsx` | New component — SVG ring, phase state machine, tick |
| Modify | `src/pages/client/SessionWizard.jsx` | Import SetTimer; replace reps grid in standalone step; add SetTimer above superset grid |

---

## Task 1: Create `SetTimer` component

**Files:**
- Create: `src/components/client/SetTimer.jsx`

> **Note on testing:** This project's test suite covers pure utility functions (vitest, no jsdom / testing-library). Component testing infrastructure is not set up and adding it is out of scope. Manual verification in the dev server is the check for this task.

- [ ] **Step 1.1: Create the file**

Create `src/components/client/SetTimer.jsx` with the following content:

```jsx
import React, { useState, useEffect } from 'react'

const R = 40
const C = 2 * Math.PI * R  // ≈ 251.33

export default function SetTimer({ targetSeconds, onComplete, onReset }) {
  const [timeLeft, setTimeLeft] = useState(targetSeconds)
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'paused' | 'done'

  // Tick — decrements timeLeft every second while running
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // Transition to done when timeLeft hits 0 while running
  useEffect(() => {
    if (phase === 'running' && timeLeft === 0) {
      setPhase('done')
      try { navigator.vibrate(200) } catch (_) {}
      onComplete(targetSeconds)
    }
  }, [timeLeft, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  // ^ onComplete/targetSeconds omitted: component is always remounted via key= on set/round change

  function handleReset() {
    setTimeLeft(targetSeconds)
    setPhase('idle')
    onReset()
  }

  // Draining ring: starts fully drawn (offset=0), empties as time runs out (offset=C)
  const offset = targetSeconds > 0
    ? C * (1 - timeLeft / targetSeconds)
    : 0
  const ringColor = phase === 'done' ? 'var(--color-success)' : '#29B5CC'

  const btnBase = {
    border: 'none', borderRadius: '7px', padding: '8px 14px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }
  const primaryBtn = { ...btnBase, background: 'rgba(41,181,204,0.12)', border: '1px solid rgba(41,181,204,0.3)', color: '#29B5CC' }
  const resetLink = { background: 'none', border: 'none', fontSize: '12px', color: 'var(--color-muted)', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {targetSeconds > 0 ? (
        <>
          <svg width="96" height="96" viewBox="0 0 96 96">
            {/* Track */}
            <circle cx="48" cy="48" r={R} fill="none" stroke="var(--color-elevated)" strokeWidth="8" />
            {/* Progress arc — starts at 12 o'clock */}
            <circle
              cx="48" cy="48" r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeDasharray={C}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
              style={{ transition: phase === 'running' ? 'stroke-dashoffset 1s linear' : 'none' }}
            />
            <text x="48" y="45" textAnchor="middle" fill="var(--color-text)" fontSize="22" fontWeight="700" fontFamily="system-ui">
              {timeLeft}
            </text>
            <text x="48" y="61" textAnchor="middle" fill="var(--color-muted)" fontSize="10" fontFamily="system-ui">
              of {targetSeconds}s
            </text>
          </svg>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {phase === 'idle' && (
              <button type="button" onClick={() => setPhase('running')} style={{ ...primaryBtn, padding: '8px 20px' }}>
                ▶ Start Timer
              </button>
            )}
            {phase === 'running' && (
              <>
                <button type="button" onClick={() => setPhase('paused')} style={{ ...primaryBtn }}>⏸ Pause</button>
                <button type="button" onClick={handleReset} style={resetLink}>↺ Reset</button>
              </>
            )}
            {phase === 'paused' && (
              <>
                <button type="button" onClick={() => setPhase('running')} style={{ ...primaryBtn }}>▶ Resume</button>
                <button type="button" onClick={handleReset} style={resetLink}>↺ Reset</button>
              </>
            )}
            {phase === 'done' && (
              <span style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 600 }}>Done ✓</span>
            )}
          </div>
        </>
      ) : (
        // targetSeconds is 0/falsy — no ring; disable Start; client must type manually
        <button type="button" disabled style={{ ...primaryBtn, opacity: 0.4, cursor: 'not-allowed', padding: '8px 20px' }}>
          ▶ Start Timer
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 1.2: Verify the file exists**

Run:
```bash
ls src/components/client/
```
Expected: `SetTimer.jsx` is present in the output (other files may also be listed).

- [ ] **Step 1.3: Commit**

```bash
git add src/components/client/SetTimer.jsx
git commit -m "feat: add SetTimer countdown ring component"
```

---

## Task 2: Wire SetTimer into the standalone exercise step

**Files:**
- Modify: `src/pages/client/SessionWizard.jsx` (~lines 1 and 837–866)

The standalone exercise step currently renders a `1fr 1fr` grid with `[Reps/Seconds input] | [Weight input]`. For seconds exercises, this task replaces the grid with a vertical stack: SetTimer (full width) then the same 2-col grid with the left column relabelled "Actual (sec)".

- [ ] **Step 2.1: Add SetTimer import**

Open `src/pages/client/SessionWizard.jsx`. At the top, the existing imports end around line 13. Add the import after `VideoPlayer`:

Find:
```js
import VideoPlayer from '../../components/VideoPlayer'
```

Replace with:
```js
import VideoPlayer from '../../components/VideoPlayer'
import SetTimer from '../../components/client/SetTimer'
```

- [ ] **Step 2.2: Replace the per-set inputs grid**

Find the 2-column grid at ~line 837 (inside the `{!allSetsDone ? (` branch). The block to replace is:

```jsx
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                    {ex.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentSetData.reps}
                    onChange={e => updateSetField(exIdx, currentSet, 'reps', e.target.value)}
                    placeholder={ex.reps ? String(ex.reps) : '—'}
                    style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                    Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={currentSetData.weight}
                    onChange={e => updateSetField(exIdx, currentSet, 'weight', e.target.value)}
                    placeholder={ex.weight ? String(parseFloat(fromCanonical(ex.weight, weightUnit).toFixed(1))) : '—'}
                    style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
```

Replace with:

```jsx
              {ex.measurement_type === 'seconds' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SetTimer
                    key={currentSet}
                    targetSeconds={Number(ex.reps) || 0}
                    onComplete={secs => updateSetField(exIdx, currentSet, 'reps', String(secs))}
                    onReset={() => updateSetField(exIdx, currentSet, 'reps', '')}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                        Actual (sec)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentSetData.reps}
                        onChange={e => updateSetField(exIdx, currentSet, 'reps', e.target.value)}
                        placeholder={ex.reps ? String(ex.reps) : '—'}
                        style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                        Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.]*"
                        value={currentSetData.weight}
                        onChange={e => updateSetField(exIdx, currentSet, 'weight', e.target.value)}
                        placeholder={ex.weight ? String(parseFloat(fromCanonical(ex.weight, weightUnit).toFixed(1))) : '—'}
                        style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                      Reps
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={currentSetData.reps}
                      onChange={e => updateSetField(exIdx, currentSet, 'reps', e.target.value)}
                      placeholder={ex.reps ? String(ex.reps) : '—'}
                      style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                      Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      value={currentSetData.weight}
                      onChange={e => updateSetField(exIdx, currentSet, 'weight', e.target.value)}
                      placeholder={ex.weight ? String(parseFloat(fromCanonical(ex.weight, weightUnit).toFixed(1))) : '—'}
                      style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
```

> **Auto-fill semantics:** `onComplete` fires only when the countdown reaches 0 (full completion) and writes the *prescribed* target seconds — not elapsed time. Partial holds (client pauses or resets early) are entered manually via the always-visible "Actual (sec)" input. Do not attempt to capture elapsed time in `onComplete`.

- [ ] **Step 2.3: Run the dev server and verify manually**

```bash
npm run dev
```

Open the app at `http://localhost:5173`. Log in as a client and navigate to a session that contains an exercise with `measurement_type = 'seconds'`. Verify:
1. The SVG ring appears above the "Actual (sec)" + Weight inputs
2. Tapping "▶ Start Timer" starts the countdown
3. The ring visually drains (arc shrinks from full to empty)
4. At 0: ring turns green, "Done ✓" label appears, the "Actual (sec)" input is auto-filled with the prescribed value
5. The "Complete Set →" button becomes enabled
6. Tapping "↺ Reset" mid-count clears the "Actual (sec)" field and re-disables "Complete Set →"
7. A reps-based exercise on the same session shows the original `1fr 1fr` grid unchanged

If no seconds-based exercise exists, temporarily change a `prescription_exercises.measurement_type` value to `'seconds'` in Supabase Studio to test.

- [ ] **Step 2.4: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: wire SetTimer into standalone exercise set step"
```

---

## Task 3: Wire SetTimer into superset round cards

**Files:**
- Modify: `src/pages/client/SessionWizard.jsx` (~lines 614–639)

The superset round screen renders each exercise in a card with `padding: '12px 14px'` and a `1fr 1fr` grid. For seconds exercises the timer goes full-width above the grid; the grid left column label changes to "Actual (sec)".

- [ ] **Step 3.1: Replace the superset exercise card input section**

Find the block at ~line 614 (the `<div style={{ padding: '12px 14px', display: 'grid', ...` inside the superset exercise `.map`):

```jsx
                    <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                          {pe.measurement_type === 'seconds' ? 'Seconds' : 'Reps'}
                        </label>
                        <input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={roundData.reps}
                          onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', e.target.value)}
                          placeholder={pe.reps ? String(pe.reps) : '—'}
                          style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                          Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                        </label>
                        <input
                          type="text" inputMode="decimal"
                          value={roundData.weight}
                          onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'weight', e.target.value)}
                          placeholder="—"
                          style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
```

Replace with:

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
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                            {pe.measurement_type === 'seconds' ? 'Actual (sec)' : 'Reps'}
                          </label>
                          <input
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            value={roundData.reps}
                            onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'reps', e.target.value)}
                            placeholder={pe.reps ? String(pe.reps) : '—'}
                            style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>
                            Weight <span style={{ fontWeight: 400 }}>({weightUnit}, optional)</span>
                          </label>
                          <input
                            type="text" inputMode="decimal"
                            value={roundData.weight}
                            onChange={e => updateSupersetSetField(step.itemIndex, exIdx, currentRound, 'weight', e.target.value)}
                            placeholder="—"
                            style={{ width: '100%', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', padding: '9px 12px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
```

- [ ] **Step 3.2: Run the dev server and verify manually**

```bash
npm run dev
```

Navigate to a session containing a superset where at least one exercise has `measurement_type = 'seconds'`. Verify:
1. The SetTimer ring appears inside the superset exercise card, full-width above the input grid
2. The left input column is labelled "Actual (sec)" for that exercise and "Reps" for any co-exercises that are reps-based
3. The timer auto-fills the "Actual (sec)" input on completion
4. On advancing to the next round (`key={currentRound}` remount), the timer resets to idle

- [ ] **Step 3.3: Commit**

```bash
git add src/pages/client/SessionWizard.jsx
git commit -m "feat: wire SetTimer into superset round exercise cards"
```
