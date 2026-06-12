# Weekly Program Progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly-aggregated pain and volume line charts to the client progress accordion, sitting after the existing per-session charts.

**Architecture:** A new `computeWeeklyData` utility aggregates session logs into per-week buckets (pain averaged per-session-first, volume summed). A new `WeeklyProgressCard` component renders two Recharts `LineChart`s stacked vertically with internal labels, styled identically to `PainChart`/`VolumeChart`. `PrescriptionProgressSection` derives weekly data and renders the card after the existing volume chart.

**Tech Stack:** React 18, Recharts (already installed), Vitest (utility tests only — component testing not set up)

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `src/utils/progressUtils.js` | Add `computeWeeklyData()` |
| Modify | `src/utils/progressUtils.test.js` | Add tests for `computeWeeklyData` |
| Create | `src/components/progress/WeeklyProgressCard.jsx` | New component — two stacked line charts |
| Modify | `src/components/progress/PrescriptionProgressSection.jsx` | Import and render `WeeklyProgressCard` |

---

## Task 1: Add `computeWeeklyData` utility

**Files:**
- Modify: `src/utils/progressUtils.js`
- Modify: `src/utils/progressUtils.test.js`

> **Note on testing:** The project's test suite covers pure utility functions with Vitest — no jsdom/testing-library. Component testing is not set up; manual dev-server verification is used for Tasks 2–3.

- [ ] **Step 1.1: Write the failing tests**

Open `src/utils/progressUtils.test.js`. Add the following block after the existing `computeVolumeData` describe block. Also add `computeWeeklyData` to the import at the top of the file.

Updated import line (line 1–7):
```js
import { describe, it, expect } from 'vitest'
import {
  computeCompletionStats,
  computeExerciseVolume,
  computePainData,
  computeVolumeData,
  computeWeeklyData,
} from './progressUtils'
```

New test block to append at the end of the file:
```js
describe('computeWeeklyData', () => {
  it('returns [] when startDate is null', () => {
    expect(computeWeeklyData([], 'kg', null)).toEqual([])
  })

  it('returns [] when sessionLogs is empty', () => {
    expect(computeWeeklyData([], 'kg', '2025-01-01')).toEqual([])
  })

  it('assigns a session on the start date to week 1', () => {
    const logs = [{ completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] }]
    const result = computeWeeklyData(logs, 'kg', '2025-01-01')
    expect(result[0].week).toBe(1)
    expect(result[0].label).toBe('Wk 1')
  })

  it('assigns sessions in different 7-day windows to different weeks', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] },
      { completed_at: '2025-01-08T10:00:00Z', exercise_logs: [] },
      { completed_at: '2025-01-15T10:00:00Z', exercise_logs: [] },
    ]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01').map(r => r.week)).toEqual([1, 2, 3])
  })

  it('averages per-session pain averages (not all exercise logs equally)', () => {
    // Session A: exercises with pain 2, 8 → session avg 5
    // Session B: exercise with pain 3 → session avg 3
    // Weekly avgPain = (5 + 3) / 2 = 4, NOT (2+8+3)/3 = 4.33
    const logs = [
      {
        completed_at: '2025-01-01T10:00:00Z',
        exercise_logs: [
          { pain_rating: 2, sets_data: null, weight_completed: null, reps_completed: null },
          { pain_rating: 8, sets_data: null, weight_completed: null, reps_completed: null },
        ],
      },
      {
        completed_at: '2025-01-03T10:00:00Z',
        exercise_logs: [
          { pain_rating: 3, sets_data: null, weight_completed: null, reps_completed: null },
        ],
      },
    ]
    const result = computeWeeklyData(logs, 'kg', '2025-01-01')
    expect(result).toHaveLength(1)
    expect(result[0].avgPain).toBe(4)
  })

  it('sets avgPain to null when no session in the week has pain data', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [{ pain_rating: null, sets_data: null, weight_completed: null, reps_completed: null }],
    }]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].avgPain).toBeNull()
  })

  it('sums volume across all sessions in a week', () => {
    const logs = [
      {
        completed_at: '2025-01-01T10:00:00Z',
        exercise_logs: [{ sets_data: [{ reps: 10, weight: 50 }], weight_completed: null, reps_completed: null }],
      },
      {
        completed_at: '2025-01-03T10:00:00Z',
        exercise_logs: [{ sets_data: [{ reps: 8, weight: 60 }], weight_completed: null, reps_completed: null }],
      },
    ]
    // 10*50=500, 8*60=480, total=980
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].volume).toBe(980)
  })

  it('sets volume to null when no weighted exercises in the week', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [{ sets_data: [{ reps: 10, weight: 0 }], weight_completed: null, reps_completed: null }],
    }]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].volume).toBeNull()
  })

  it('converts volume to lb when weightUnit is lb', () => {
    const logs = [{
      completed_at: '2025-01-01T10:00:00Z',
      exercise_logs: [{ sets_data: [{ reps: 1, weight: 100 }], weight_completed: null, reps_completed: null }],
    }]
    // Math.round(100 * 2.20462) = 220
    expect(computeWeeklyData(logs, 'lb', '2025-01-01')[0].volume).toBe(220)
  })

  it('omits weeks with no sessions (sparse gaps are fine)', () => {
    const logs = [
      { completed_at: '2025-01-01T10:00:00Z', exercise_logs: [] },
      { completed_at: '2025-01-15T10:00:00Z', exercise_logs: [] }, // week 3, week 2 absent
    ]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01').map(r => r.week)).toEqual([1, 3])
  })

  it('buckets sessions by UTC calendar date of completed_at (not local time)', () => {
    // Implementation slices completed_at to UTC date string — week assignment is based on
    // UTC calendar date, not the client's local date. This is consistent across all sessions
    // in a prescription, so relative week numbers are stable.
    // completed_at '2025-01-01T23:59:00Z' → UTC date '2025-01-01' → week 1
    const logs = [{ completed_at: '2025-01-01T23:59:00Z', exercise_logs: [] }]
    expect(computeWeeklyData(logs, 'kg', '2025-01-01')[0].week).toBe(1)
  })
})
```

- [ ] **Step 1.2: Run tests — expect failures**

```bash
npx vitest run src/utils/progressUtils.test.js
```

Expected: all new `computeWeeklyData` tests fail with `computeWeeklyData is not a function` (or similar). Existing tests should still pass.

- [ ] **Step 1.3: Implement `computeWeeklyData`**

Open `src/utils/progressUtils.js`. Append this function at the end of the file (after `computeVolumeData`). The `KG_TO_LB` constant and `computeExerciseVolume` are already defined in the same file — do not redefine them.

```js
export function computeWeeklyData(sessionLogs, weightUnit = 'kg', startDate) {
  if (!startDate || !sessionLogs.length) return []

  const anchorDay = new Date(startDate + 'T00:00:00Z')
  const weekMap = new Map()

  for (const log of sessionLogs) {
    const sessionDay = new Date(log.completed_at.slice(0, 10) + 'T00:00:00Z')
    const week = Math.floor((sessionDay - anchorDay) / (7 * 86400000)) + 1

    if (!weekMap.has(week)) {
      weekMap.set(week, { sessionPainAvgs: [], volumeKg: 0, hasVolume: false })
    }

    const entry = weekMap.get(week)

    // Per-session average pain first, then average those weekly
    const ratings = (log.exercise_logs ?? [])
      .map(el => el.pain_rating)
      .filter(r => r !== null && r !== undefined)
    if (ratings.length > 0) {
      entry.sessionPainAvgs.push(ratings.reduce((s, r) => s + r, 0) / ratings.length)
    }

    // Sum volume across all exercises in the session
    for (const el of (log.exercise_logs ?? [])) {
      const vol = computeExerciseVolume(el)
      if (vol !== null) {
        entry.volumeKg += vol
        entry.hasVolume = true
      }
    }
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, { sessionPainAvgs, volumeKg, hasVolume }]) => {
      const avgPain = sessionPainAvgs.length > 0
        ? Math.round((sessionPainAvgs.reduce((s, p) => s + p, 0) / sessionPainAvgs.length) * 10) / 10
        : null
      const volume = hasVolume
        ? (weightUnit === 'lb' ? Math.round(volumeKg * KG_TO_LB) : Math.round(volumeKg))
        : null
      return { week, label: `Wk ${week}`, avgPain, volume }
    })
}
```

- [ ] **Step 1.4: Run tests — expect all pass**

```bash
npx vitest run src/utils/progressUtils.test.js
```

Expected: all tests pass, including the pre-existing ones.

- [ ] **Step 1.5: Commit**

```bash
git add src/utils/progressUtils.js src/utils/progressUtils.test.js
git commit -m "feat: add computeWeeklyData utility with tests"
```

---

## Task 2: Create `WeeklyProgressCard` component

**Files:**
- Create: `src/components/progress/WeeklyProgressCard.jsx`

> Component testing is not set up. Verify manually in the dev server during Task 3.

- [ ] **Step 2.1: Create the file**

Create `src/components/progress/WeeklyProgressCard.jsx` with the following content:

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../context/ThemeContext'

export function WeeklyProgressCard({ data, weightUnit }) {
  const { theme } = useTheme()
  const chartColors = {
    accent: '#29B5CC',
    muted:  theme === 'dark' ? '#888888' : '#475569',
    grid:   theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
    text:   theme === 'dark' ? '#888888' : '#475569',
  }

  const painData   = (data ?? []).filter(d => d.avgPain !== null)
  const volumeData = (data ?? []).filter(d => d.volume !== null)
  const hasPain    = painData.length >= 2
  const hasVolume  = volumeData.length >= 2

  if (!hasPain && !hasVolume) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {hasPain && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>
            Average Pain per Week (0–10)
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={painData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: chartColors.text }} />
              <Tooltip
                formatter={v => [v, 'Avg pain (0–10)']}
                contentStyle={{ background: 'rgba(14,17,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '12px', color: '#f0f0f0' }}
                itemStyle={{ color: chartColors.accent }}
                labelStyle={{ color: chartColors.muted }}
              />
              <Line
                type="monotone"
                dataKey="avgPain"
                stroke={chartColors.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: chartColors.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasVolume && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>
            Total Volume per Week ({weightUnit})
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={volumeData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.text }} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.text }} />
              <Tooltip
                formatter={v => [`${v} ${weightUnit}`, 'Total volume']}
                contentStyle={{ background: 'rgba(14,17,23,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '12px', color: '#f0f0f0' }}
                itemStyle={{ color: chartColors.accent }}
                labelStyle={{ color: chartColors.muted }}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke={chartColors.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: chartColors.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/progress/WeeklyProgressCard.jsx
git commit -m "feat: add WeeklyProgressCard component"
```

---

## Task 3: Wire `WeeklyProgressCard` into `PrescriptionProgressSection`

**Files:**
- Modify: `src/components/progress/PrescriptionProgressSection.jsx`

- [ ] **Step 3.1: Add imports**

Open `src/components/progress/PrescriptionProgressSection.jsx`. The current import line for utilities (line 5) is:

```js
import { computeCompletionStats, computePainData, computeVolumeData } from '../../utils/progressUtils'
```

Replace with:

```js
import { computeCompletionStats, computePainData, computeVolumeData, computeWeeklyData } from '../../utils/progressUtils'
```

Also add the `WeeklyProgressCard` import after the existing `VolumeChart` import (currently line 4):

Find:
```js
import { VolumeChart } from './VolumeChart'
```

Replace with:
```js
import { VolumeChart } from './VolumeChart'
import { WeeklyProgressCard } from './WeeklyProgressCard'
```

- [ ] **Step 3.2: Derive weekly data and render the card**

In the component body (currently lines 12–15), the existing derivations are:

```js
  const prescriptionSessions = (sessionLogs ?? []).filter(l => l.prescription_id === prescription.id)
  const completion = computeCompletionStats(prescription, sessionLogs ?? [])
  const painData = computePainData(prescriptionSessions)
  const volumeData = computeVolumeData(prescriptionSessions, weightUnit)
```

Add `weeklyData` on the line after `volumeData`:

```js
  const prescriptionSessions = (sessionLogs ?? []).filter(l => l.prescription_id === prescription.id)
  const completion = computeCompletionStats(prescription, sessionLogs ?? [])
  const painData = computePainData(prescriptionSessions)
  const volumeData = computeVolumeData(prescriptionSessions, weightUnit)
  const weeklyData = computeWeeklyData(prescriptionSessions, weightUnit, prescription.start_date)
```

Then, in the expanded section, find the closing `</div>` after the VolumeChart section:

```jsx
          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>Total Volume per Session ({weightUnit})</p>
            <VolumeChart data={volumeData} weightUnit={weightUnit} />
          </div>
        </div>
```

Replace with:

```jsx
          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>Total Volume per Session ({weightUnit})</p>
            <VolumeChart data={volumeData} weightUnit={weightUnit} />
          </div>
          <WeeklyProgressCard data={weeklyData} weightUnit={weightUnit} />
        </div>
```

- [ ] **Step 3.3: Run the dev server and verify manually**

```bash
npm run dev
```

Open the app at `http://localhost:5173`. Log in as a client and go to the Progress tab. Expand a prescription accordion that has at least 2 weeks of sessions. Verify:

1. The existing "Average Pain per Session" and "Total Volume per Session" charts still appear and are unchanged
2. Below them, "Average Pain per Week (0–10)" appears with a line chart whose x-axis shows "Wk 1", "Wk 2", etc.
3. Below that, "Total Volume per Week (kg)" (or lb) appears similarly
4. Each dot on the weekly chart represents one week, not one session
5. A prescription with only 1 week of sessions shows neither weekly chart (silent skip)
6. Toggle to light mode — grid lines and axis text update correctly (no hardcoded dark-only colours)

Also verify on the **therapist side**: go to a client's data tab and expand the same prescription accordion. The weekly charts should appear there too (same component, shared path). `computeWeeklyData` returns `[]` silently if `prescription.start_date` is absent, so confirm the charts render — this validates that `start_date` is populated on the therapist path.

If no prescription has 2+ weeks of sessions, temporarily insert a second session log via Supabase Studio with `completed_at` at least 8 days after the first.

- [ ] **Step 3.4: Commit**

```bash
git add src/components/progress/PrescriptionProgressSection.jsx
git commit -m "feat: wire WeeklyProgressCard into progress accordion"
```
