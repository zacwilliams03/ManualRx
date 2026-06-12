# Weekly Program Progress — Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Goal

Add weekly-aggregated pain and volume charts to the client progress section, sitting alongside the existing per-session charts. Clients and therapists can see how average pain and total volume trend week-over-week across a prescription.

---

## Architecture

Three targeted changes, no new dependencies:

| Action | File | What changes |
|---|---|---|
| Modify | `src/utils/progressUtils.js` | Add `computeWeeklyData()` |
| Create | `src/components/progress/WeeklyProgressCard.jsx` | New component — two stacked line charts |
| Modify | `src/components/progress/PrescriptionProgressSection.jsx` | Import and render `WeeklyProgressCard` |

---

## Data Layer

### `computeWeeklyData(sessionLogs, weightUnit, startDate)`

Added to `progressUtils.js` alongside the existing compute functions.

**Week assignment:**
```js
week = Math.floor((new Date(session.completed_at) - new Date(startDate)) / (7 * 86400000)) + 1
```

**Per-week aggregations:**
- `avgPain` — average of all non-null `pain_rating` values across every `exercise_log` in that week's sessions. `null` if no ratings were recorded that week.
- `volume` — sum of `computeExerciseVolume()` for every exercise_log in that week's sessions, converted to `weightUnit`. `null` if no weighted exercises existed that week.

**Return shape:**
```js
[
  { week: 1, label: 'Wk 1', avgPain: 4.2, volume: 1240 },
  { week: 2, label: 'Wk 2', avgPain: null, volume: 980 },
  ...
]
```

Weeks with no sessions are omitted. Weeks where avgPain or volume is null still appear in the array — each chart filters its own metric before rendering.

**Input:** `sessionLogs` is already filtered to a single prescription's sessions before being passed in (same as existing utilities).

---

## Component: `WeeklyProgressCard`

**File:** `src/components/progress/WeeklyProgressCard.jsx`

**Props:** `data` (from `computeWeeklyData`), `weightUnit`

Two Recharts `LineChart`s stacked vertically in a plain `div` (no card border — sits inside `PrescriptionProgressSection`'s existing card).

### Pain chart (top)
- Label: "Average Pain per Week (0–10)"
- y-axis domain: `[0, 10]`
- Line stroke: `#29B5CC`
- Height: 180px
- Data: `data` filtered to entries where `avgPain !== null`
- Minimum to render: 2 entries with pain data

### Volume chart (bottom)
- Label: "Total Volume per Week ({weightUnit})"
- y-axis domain: auto
- Line stroke: `#29B5CC`
- Height: 180px
- Data: `data` filtered to entries where `volume !== null`
- Minimum to render: 2 entries with volume data

If neither chart has enough data to render, the component returns `null` (silent skip — same behaviour as `PainChart`/`VolumeChart`).

Charts are otherwise styled identically to `PainChart` and `VolumeChart` (same `CartesianGrid`, `Tooltip`, `ResponsiveContainer` patterns).

---

## Integration: `PrescriptionProgressSection`

**Additions to existing component:**

1. Import `WeeklyProgressCard` and `computeWeeklyData`
2. Derive weekly data:
   ```js
   const weeklyData = computeWeeklyData(prescriptionSessions, weightUnit, prescription.start_date)
   ```
3. Render `WeeklyProgressCard` after the existing "Total Volume per Session" section. Because `WeeklyProgressCard` manages its own section labels internally, it is rendered as a single element (no outer label `<p>` in the parent):

```jsx
<WeeklyProgressCard data={weeklyData} weightUnit={weightUnit} />
```

Resulting visual order in the expanded accordion:
```
Completion                        ← existing
Average Pain per Session (0–10)   ← existing
Total Volume per Session (kg/lb)  ← existing
Average Pain per Week (0–10)      ← new (label inside WeeklyProgressCard)
Total Volume per Week (kg/lb)     ← new (label inside WeeklyProgressCard)
```

`WeeklyProgressCard` handles all null/sparse-data logic internally — no guard logic needed in the parent.

---

## Edge Cases

- **No `start_date` on prescription:** `computeWeeklyData` returns `[]` — no weekly charts render. In practice all prescriptions have `start_date` so this is a safety guard only.
- **Only 1 week of data:** Each chart silently skips (requires ≥2 data points), consistent with existing charts.
- **Sessions on same day as `start_date`:** Week 1 (floor = 0, +1 = 1). Correct.
- **Sparse weeks (client missed a week):** That week simply has no entry. The line chart connects available points with no gap artefacts.

---

## Out of Scope

- Week labels showing actual date ranges (e.g. "Jun 1–7") — plain "Wk N" is sufficient
- Therapist-side weekly view — this surfaces in the existing client ProgressTab only
- Interactive week drill-down
