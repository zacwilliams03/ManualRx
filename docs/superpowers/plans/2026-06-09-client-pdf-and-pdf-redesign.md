# Client PDF Download + PDF Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all three PDF components with a polished tabular layout, and add per-card + download-all PDF buttons to the client Dashboard.

**Architecture:** Extract shared `ExerciseTablePDF` component (react-pdf Views) used by all three PDFs. Each PDF component handles its own header/meta/footer; all route exercise rendering through `ExerciseTablePDF`. Dashboard fetches exercises on-demand at click time and renders existing PDF components.

**Tech Stack:** React (Vite), @react-pdf/renderer, Supabase JS client, Vitest.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/components/therapist/ExerciseTablePDF.jsx` |
| Modify | `src/components/therapist/PrescriptionPDF.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.jsx` |
| Modify | `src/components/therapist/ProgramPDF.jsx` |
| Modify | `src/components/therapist/AllSessionsPDF.test.jsx` |
| Create | `src/components/therapist/PrescriptionPDF.test.jsx` |
| Modify | `src/pages/client/Dashboard.jsx` |

---

## Task 1: Complete the AllSessionsPDF test suite

**Files:**
- Modify: `src/components/therapist/AllSessionsPDF.test.jsx`

The current test file is missing the **per-set + tempo combined** case. Add it. Everything else is already covered.

- [ ] **Step 1: Add the missing test case**

Open `src/components/therapist/AllSessionsPDF.test.jsx`. After the last test, append:

```js
test('renders per-set exercise with tempo without crashing', async () => {
  const props = {
    ...BASE_PROPS,
    prescriptions: [
      {
        name: 'Pyramid + Tempo Session',
        frequencyLabel: 'Daily',
        exercises: [
          {
            name: 'Romanian Deadlift',
            sets: 3, reps: null, weight: null,
            therapist_notes: 'Keep back flat.',
            measurement_type: 'reps', bilateral: false,
            tempo_eccentric: 3, tempo_bottom_pause: 1, tempo_concentric: 2, tempo_top_pause: 0,
            prescription_exercise_sets: [
              { set_number: 1, reps: 10, weight: 40 },
              { set_number: 2, reps: 8,  weight: 55 },
              { set_number: 3, reps: 6,  weight: 70 },
            ],
          },
        ],
      },
    ],
  }
  const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to confirm all existing tests still pass**

```bash
npm test AllSessionsPDF
```

Expected: all tests pass (the new test passes because the current component handles unknown props gracefully).

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/AllSessionsPDF.test.jsx
git commit -m "test: add per-set + tempo combined test to AllSessionsPDF"
```

---

## Task 2: Create `ExerciseTablePDF.jsx`

**Files:**
- Create: `src/components/therapist/ExerciseTablePDF.jsx`

This is a react-pdf component (imports from `@react-pdf/renderer`) — it renders a `<View>` (not a DOM element). It is the only file that knows how to render the exercise table rows; the three PDF components import and use it.

Props: `{ exercises, weightUnit }`

`exercises` shape per item:
```
{
  name: string
  sets: number | null
  reps: number | null
  weight: number | null          (canonical kg)
  therapist_notes: string | null
  measurement_type: 'reps' | 'seconds'
  bilateral: boolean
  tempo_eccentric: number | null
  tempo_bottom_pause: number | null
  tempo_concentric: number | null
  tempo_top_pause: number | null
  prescription_exercise_sets?: { set_number: number, reps: number, weight: number | null }[]
}
```

- [ ] **Step 1: Create the file**

Create `src/components/therapist/ExerciseTablePDF.jsx` with the following content:

```jsx
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { formatTempo } from '../../utils/formatTempo'
import { formatWeight } from '../../utils/weightUtils'

const NAVY = '#1E2D3D'
const TEAL = '#29B5CC'
const TEAL_LIGHT = '#E8F9FC'
const TEAL_BORDER = '#A8E6F0'
const GREY = '#6B7280'
const WHITE = '#FFFFFF'

// Column widths (pt). EXERCISE uses flex:1, so these must not overflow a standard A4 page
// with 48pt horizontal padding on each side (usable width ≈ 499pt).
const WN = 22    // #
const WS = 30    // SETS
const WR = 40    // REPS / SEC
const WW = 48    // WEIGHT
const WT = 52    // TEMPO

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', backgroundColor: TEAL },
  thCell: { paddingVertical: 5, paddingHorizontal: 5, color: WHITE, fontSize: 7, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: TEAL_BORDER, paddingVertical: 5 },
  rowAlt: { backgroundColor: '#FAFEFF' },
  perSetNameRow: { flexDirection: 'row', backgroundColor: '#F0FDFF', paddingVertical: 4 },
  subHeaderRow: { flexDirection: 'row', backgroundColor: '#F0FDFF', paddingVertical: 2 },
  setRow: { flexDirection: 'row', backgroundColor: '#F0FDFF', paddingVertical: 2 },
  setRowLast: { borderBottomWidth: 1, borderBottomColor: TEAL_BORDER },
  notesRow: { flexDirection: 'row', backgroundColor: '#F0FDFF', paddingBottom: 6 },
  cellNum: { width: WN, paddingHorizontal: 5, alignItems: 'center' },
  cellExercise: { flex: 1, paddingHorizontal: 5 },
  cellSets: { width: WS, paddingHorizontal: 4, alignItems: 'center' },
  cellReps: { width: WR, paddingHorizontal: 4, alignItems: 'center' },
  cellWeight: { width: WW, paddingHorizontal: 4, alignItems: 'center' },
  cellTempo: { width: WT, paddingHorizontal: 4, alignItems: 'center' },
  exNum: { color: TEAL, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  exName: { color: NAVY, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  numVal: { color: NAVY, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  unitSuffix: { color: GREY, fontSize: 7 },
  wVal: { color: NAVY, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  wBW: { color: GREY, fontSize: 8.5 },
  tempoBadge: {
    backgroundColor: TEAL_LIGHT, borderWidth: 1, borderColor: TEAL_BORDER,
    borderRadius: 4, paddingVertical: 2, paddingHorizontal: 4,
  },
  tempoText: { color: TEAL, fontFamily: 'Courier-Bold', fontSize: 7.5 },
  tempoDash: { color: GREY, fontSize: 8 },
  perSetBadge: {
    backgroundColor: TEAL, borderRadius: 3, paddingVertical: 1, paddingHorizontal: 4, marginLeft: 5,
  },
  perSetBadgeText: { color: WHITE, fontSize: 6, fontFamily: 'Helvetica-Bold' },
  subLabel: { color: '#94A3B8', fontSize: 6.5, fontFamily: 'Helvetica-Bold' },
  setNum: { color: TEAL, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  setVal: { color: NAVY, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  setWtBW: { color: GREY, fontSize: 8 },
  notesBox: {
    borderLeftWidth: 2, borderLeftColor: TEAL, backgroundColor: TEAL_LIGHT,
    padding: 5, borderRadius: 3,
  },
  notesBoxText: { color: NAVY, fontSize: 8 },
})

// Note: `gap` is not used in StyleSheet — use marginRight on metaItem children instead
// (gap support in @react-pdf/renderer is version-dependent)

function TempoBadge({ ex }) {
  const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause)
  if (!t) return <Text style={s.tempoDash}>—</Text>
  return <View style={s.tempoBadge}><Text style={s.tempoText}>{t.compact}</Text></View>
}

function NormalRow({ ex, i, weightUnit }) {
  const unit = ex.measurement_type === 'seconds' ? 'sec' : 'reps'
  return (
    <View style={[s.row, i % 2 !== 0 && s.rowAlt]}>
      <View style={s.cellNum}><Text style={s.exNum}>{i + 1}</Text></View>
      <View style={s.cellExercise}>
        <Text style={s.exName}>{ex.name}</Text>
        {ex.therapist_notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesBoxText}>{ex.therapist_notes}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.cellSets}><Text style={s.numVal}>{ex.sets}</Text></View>
      <View style={s.cellReps}>
        <Text>
          <Text style={s.numVal}>{ex.reps}</Text>
          <Text style={s.unitSuffix}> {unit}</Text>
        </Text>
      </View>
      <View style={s.cellWeight}>
        {ex.weight != null
          ? <Text style={s.wVal}>{formatWeight(ex.weight, weightUnit)}</Text>
          : <Text style={s.wBW}>BW</Text>
        }
      </View>
      <View style={s.cellTempo}><TempoBadge ex={ex} /></View>
    </View>
  )
}

function PerSetRows({ ex, i, weightUnit }) {
  const sets = [...(ex.prescription_exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number)
  const t = formatTempo(ex.tempo_eccentric, ex.tempo_bottom_pause, ex.tempo_concentric, ex.tempo_top_pause)
  return (
    <>
      <View style={s.perSetNameRow}>
        <View style={s.cellNum}><Text style={s.exNum}>{i + 1}</Text></View>
        <View style={[s.cellExercise, { flexDirection: 'row', alignItems: 'center' }]}>
          <Text style={s.exName}>{ex.name}</Text>
          <View style={s.perSetBadge}><Text style={s.perSetBadgeText}>PER-SET</Text></View>
        </View>
        <View style={s.cellSets} />
        <View style={s.cellReps} />
        <View style={s.cellWeight} />
        <View style={s.cellTempo}>
          {t
            ? <View style={s.tempoBadge}><Text style={s.tempoText}>{t.compact}</Text></View>
            : <Text style={s.tempoDash}>—</Text>
          }
        </View>
      </View>
      <View style={s.subHeaderRow}>
        <View style={{ width: WN }} />
        <View style={[s.cellExercise, { paddingLeft: 14 }]}>
          <Text style={s.subLabel}>SET</Text>
        </View>
        <View style={s.cellSets} />
        <View style={s.cellReps}><Text style={s.subLabel}>REPS</Text></View>
        <View style={s.cellWeight}><Text style={s.subLabel}>WEIGHT</Text></View>
        <View style={{ width: WT }} />
      </View>
      {sets.map((set, si) => (
        <View key={si} style={[s.setRow, si === sets.length - 1 && s.setRowLast]}>
          <View style={{ width: WN }} />
          <View style={[s.cellExercise, { paddingLeft: 14 }]}>
            <Text style={s.setNum}>{set.set_number}</Text>
          </View>
          <View style={s.cellSets} />
          <View style={s.cellReps}><Text style={s.setVal}>{set.reps}</Text></View>
          <View style={s.cellWeight}>
            {set.weight != null
              ? <Text style={s.setVal}>{formatWeight(set.weight, weightUnit)}</Text>
              : <Text style={s.setWtBW}>BW</Text>
            }
          </View>
          <View style={{ width: WT }} />
        </View>
      ))}
      {ex.therapist_notes && (
        <View style={s.notesRow}>
          <View style={{ width: WN }} />
          <View style={s.cellExercise}>
            <View style={s.notesBox}>
              <Text style={s.notesBoxText}>{ex.therapist_notes}</Text>
            </View>
          </View>
          <View style={s.cellSets} />
          <View style={s.cellReps} />
          <View style={s.cellWeight} />
          <View style={{ width: WT }} />
        </View>
      )}
    </>
  )
}

export function ExerciseTablePDF({ exercises, weightUnit }) {
  return (
    <View>
      <View style={s.headerRow}>
        <View style={s.cellNum}><Text style={s.thCell}>#</Text></View>
        <View style={s.cellExercise}><Text style={s.thCell}>EXERCISE</Text></View>
        <View style={s.cellSets}><Text style={[s.thCell, { textAlign: 'center' }]}>SETS</Text></View>
        <View style={s.cellReps}><Text style={[s.thCell, { textAlign: 'center' }]}>REPS / SEC</Text></View>
        <View style={s.cellWeight}><Text style={[s.thCell, { textAlign: 'center' }]}>WEIGHT</Text></View>
        <View style={s.cellTempo}><Text style={[s.thCell, { textAlign: 'center' }]}>TEMPO</Text></View>
      </View>
      {exercises.map((ex, i) => {
        const perSet = ex.prescription_exercise_sets ?? []
        return perSet.length > 0
          ? <PerSetRows key={i} ex={ex} i={i} weightUnit={weightUnit} />
          : <NormalRow key={i} ex={ex} i={i} weightUnit={weightUnit} />
      })}
    </View>
  )
}
```

- [ ] **Step 2: Run existing tests to confirm nothing is broken**

```bash
npm test
```

Expected: all tests pass (ExerciseTablePDF is not yet used by any component, no impact).

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/ExerciseTablePDF.jsx
git commit -m "feat: add ExerciseTablePDF shared table component"
```

---

## Task 3: Redesign `PrescriptionPDF.jsx`

**Files:**
- Modify: `src/components/therapist/PrescriptionPDF.jsx`

New props (backwards-compatible): `{ clinicName, clientName, prescriptionName, exercises, weightUnit, frequencyLabel? }`. `frequencyLabel` is optional — if undefined the meta strip shows two items instead of three.

- [ ] **Step 1: Replace the entire file**

```jsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { formatPdfDate } from '../../utils/pdfUtils'
import { formatTempo } from '../../utils/formatTempo'
import { ExerciseTablePDF } from './ExerciseTablePDF'

const NAVY = '#1E2D3D'
const TEAL = '#29B5CC'
const TEAL_LIGHT = '#E8F9FC'
const TEAL_BORDER = '#A8E6F0'
const GREY = '#6B7280'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: NAVY,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2.5,
    borderBottomColor: TEAL,
    paddingBottom: 10,
    marginBottom: 12,
  },
  logoManual: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: NAVY },
  logoRx: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: TEAL },
  subtitle: { fontSize: 8, color: GREY, letterSpacing: 2, marginTop: 3 },
  headerRight: { textAlign: 'right' },
  headerClinic: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY },
  headerDate: { fontSize: 8, color: GREY, marginTop: 1 },
  metaStrip: {
    flexDirection: 'row',
    backgroundColor: TEAL_LIGHT,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
    borderRadius: 6,
    padding: 8,
    marginBottom: 14,
  },
  metaItem: { flexDirection: 'column', marginRight: 20 },
  metaLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: TEAL, marginBottom: 1 },
  metaValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NAVY },
  tempoNote: {
    fontSize: 8, color: GREY, marginTop: 16,
    borderTopWidth: 1, borderTopColor: TEAL_BORDER, paddingTop: 8,
  },
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: GREY },
})

export function PrescriptionPDF({ clinicName, clientName, prescriptionName, exercises, weightUnit, frequencyLabel }) {
  const today = formatPdfDate(new Date())
  const hasTempoEx = exercises.some(e => e.tempo_eccentric != null)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logoManual}>Manual<Text style={styles.logoRx}>Rx</Text></Text>
            <Text style={styles.subtitle}>EXERCISE PROGRAM</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerClinic}>{clinicName}</Text>
            <Text style={styles.headerDate}>{today}</Text>
          </View>
        </View>

        <View style={styles.metaStrip}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>CLIENT</Text>
            <Text style={styles.metaValue}>{clientName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>SESSION</Text>
            <Text style={styles.metaValue}>{prescriptionName}</Text>
          </View>
          {frequencyLabel ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>FREQUENCY</Text>
              <Text style={styles.metaValue}>{frequencyLabel}</Text>
            </View>
          ) : null}
        </View>

        <ExerciseTablePDF exercises={exercises} weightUnit={weightUnit} />

        {hasTempoEx && (
          <Text style={styles.tempoNote}>
            * Tempo (seconds): Eccentric — Bottom Pause — Concentric — Top Pause
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by ManualRx</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/PrescriptionPDF.jsx
git commit -m "feat: redesign PrescriptionPDF with tabular layout"
```

---

## Task 4: Redesign `AllSessionsPDF.jsx`

**Files:**
- Modify: `src/components/therapist/AllSessionsPDF.jsx`

Props unchanged: `{ clinicName, clientName, prescriptions, weightUnit }`. Each prescription: `{ name, frequencyLabel, exercises }`.

- [ ] **Step 1: Replace the entire file**

```jsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { formatPdfDate } from '../../utils/pdfUtils'
import { ExerciseTablePDF } from './ExerciseTablePDF'

const NAVY = '#1E2D3D'
const TEAL = '#29B5CC'
const TEAL_LIGHT = '#E8F9FC'
const TEAL_BORDER = '#A8E6F0'
const GREY = '#6B7280'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: NAVY,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2.5,
    borderBottomColor: TEAL,
    paddingBottom: 10,
    marginBottom: 12,
  },
  logoManual: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: NAVY },
  logoRx: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: TEAL },
  subtitle: { fontSize: 8, color: GREY, letterSpacing: 2, marginTop: 3 },
  headerRight: { textAlign: 'right' },
  headerClinic: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY },
  headerDate: { fontSize: 8, color: GREY, marginTop: 1 },
  metaStrip: {
    flexDirection: 'row',
    backgroundColor: TEAL_LIGHT,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
    borderRadius: 6,
    padding: 8,
    marginBottom: 18,
  },
  metaItem: { flexDirection: 'column', marginRight: 20 },
  metaLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: TEAL, marginBottom: 1 },
  metaValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NAVY },
  sectionBlock: { marginBottom: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionName: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: NAVY, marginRight: 8 },
  sectionFreq: { fontSize: 9, color: TEAL },
  tempoNote: {
    fontSize: 8, color: GREY, marginTop: 16,
    borderTopWidth: 1, borderTopColor: TEAL_BORDER, paddingTop: 8,
  },
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: GREY },
})

export function AllSessionsPDF({ clinicName, clientName, prescriptions, weightUnit }) {
  const today = formatPdfDate(new Date())
  const hasTempoEx = prescriptions.some(p =>
    p.exercises.some(e => e.tempo_eccentric != null)
  )

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logoManual}>Manual<Text style={styles.logoRx}>Rx</Text></Text>
            <Text style={styles.subtitle}>EXERCISE PROGRAM</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerClinic}>{clinicName}</Text>
            <Text style={styles.headerDate}>{today}</Text>
          </View>
        </View>

        <View style={styles.metaStrip}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>CLIENT</Text>
            <Text style={styles.metaValue}>{clientName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>DATE</Text>
            <Text style={styles.metaValue}>{today}</Text>
          </View>
        </View>

        {prescriptions.map((presc, pi) => (
          <View key={pi} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionName}>{presc.name}</Text>
              {presc.frequencyLabel ? <Text style={styles.sectionFreq}>{presc.frequencyLabel}</Text> : null}
            </View>
            <ExerciseTablePDF exercises={presc.exercises} weightUnit={weightUnit} />
          </View>
        ))}

        {hasTempoEx && (
          <Text style={styles.tempoNote}>
            * Tempo (seconds): Eccentric — Bottom Pause — Concentric — Top Pause
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by ManualRx</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test AllSessionsPDF
```

Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/AllSessionsPDF.jsx
git commit -m "feat: redesign AllSessionsPDF with tabular layout"
```

---

## Task 5: Redesign `ProgramPDF.jsx`

**Files:**
- Modify: `src/components/therapist/ProgramPDF.jsx`

Props unchanged: `{ clinicName, clientName, programName, startDate, weeks, weightUnit }`. Each week: `{ weekNumber, sessions[] }`. Each session: `{ name, frequencyDays, exercises[] }`.

- [ ] **Step 1: Replace the entire file**

```jsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { formatPdfDate } from '../../utils/pdfUtils'
import { frequencyLabel } from '../../utils/frequencyUtils'
import { ExerciseTablePDF } from './ExerciseTablePDF'

const NAVY = '#1E2D3D'
const TEAL = '#29B5CC'
const TEAL_LIGHT = '#E8F9FC'
const TEAL_BORDER = '#A8E6F0'
const GREY = '#6B7280'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: NAVY,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2.5,
    borderBottomColor: TEAL,
    paddingBottom: 10,
    marginBottom: 12,
  },
  logoManual: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: NAVY },
  logoRx: { fontFamily: 'Helvetica-Bold', fontSize: 18, color: TEAL },
  subtitle: { fontSize: 8, color: GREY, letterSpacing: 2, marginTop: 3 },
  headerRight: { textAlign: 'right' },
  headerClinic: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY },
  headerDate: { fontSize: 8, color: GREY, marginTop: 1 },
  programMeta: { marginBottom: 16 },
  programTitle: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: NAVY, marginBottom: 3 },
  programSubtitle: { fontSize: 8, color: GREY },
  weekBlock: { marginBottom: 18 },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  weekBadge: {
    backgroundColor: TEAL, borderRadius: 4,
    paddingVertical: 4, paddingHorizontal: 10,
    marginRight: 8,
  },
  weekBadgeText: { color: '#FFFFFF', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  weekRule: { flex: 1, height: 1, backgroundColor: TEAL_BORDER },
  sessionBlock: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  sessionName: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: NAVY, marginRight: 6 },
  sessionFreq: { fontSize: 7.5, color: TEAL },
  tempoNote: {
    fontSize: 8, color: GREY, marginTop: 16,
    borderTopWidth: 1, borderTopColor: TEAL_BORDER, paddingTop: 8,
  },
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: GREY },
})

// frequencyLabel imported from frequencyUtils — handles null → 'No repeat', 1 → 'Daily', 7 → 'Weekly'

export function ProgramPDF({ clinicName, clientName, programName, startDate, weeks, weightUnit }) {
  const today = formatPdfDate(new Date())
  const hasTempoEx = weeks.some(w =>
    w.sessions.some(s => s.exercises.some(e => e.tempo_eccentric != null))
  )

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logoManual}>Manual<Text style={styles.logoRx}>Rx</Text></Text>
            <Text style={styles.subtitle}>EXERCISE PROGRAM</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerClinic}>{clinicName}</Text>
            <Text style={styles.headerDate}>{today}</Text>
          </View>
        </View>

        <View style={styles.programMeta}>
          <Text style={styles.programTitle}>{programName}</Text>
          <Text style={styles.programSubtitle}>
            {`Client: ${clientName}`}
            {startDate ? ` · Start: ${formatPdfDate(new Date(startDate))}` : ''}
            {weeks.length > 0 ? ` · Duration: ${weeks.length} week${weeks.length !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekBlock}>
            <View style={styles.weekHeaderRow}>
              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeText}>WEEK {week.weekNumber}</Text>
              </View>
              <View style={styles.weekRule} />
            </View>

            {week.sessions.map((session, si) => (
              <View key={si} style={styles.sessionBlock}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionName}>{session.name}</Text>
                  {session.frequencyDays
                    ? <Text style={styles.sessionFreq}>{frequencyLabel(session.frequencyDays)}</Text>
                    : null
                  }
                </View>
                <ExerciseTablePDF exercises={session.exercises} weightUnit={weightUnit} />
              </View>
            ))}
          </View>
        ))}

        {hasTempoEx && (
          <Text style={styles.tempoNote}>
            * Tempo (seconds): Eccentric — Bottom Pause — Concentric — Top Pause
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by ManualRx</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/therapist/ProgramPDF.jsx
git commit -m "feat: redesign ProgramPDF with week/session/table layout"
```

---

## Task 6: Create `PrescriptionPDF.test.jsx`

**Files:**
- Create: `src/components/therapist/PrescriptionPDF.test.jsx`

Mirror AllSessionsPDF test coverage but for `PrescriptionPDF`. The `PrescriptionPDF` takes a flat `exercises` array (not wrapped in prescriptions).

- [ ] **Step 1: Create the test file**

```jsx
import { pdf } from '@react-pdf/renderer'
import { PrescriptionPDF } from './PrescriptionPDF'

const BASE_PROPS = {
  clinicName: 'Test Clinic',
  clientName: 'Jane Doe',
  prescriptionName: 'Session A',
  weightUnit: 'kg',
  exercises: [
    {
      name: 'Squat', sets: 3, reps: 10, weight: 50,
      therapist_notes: 'Keep back straight',
      measurement_type: 'reps', bilateral: false,
      tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
      prescription_exercise_sets: [],
    },
  ],
}

describe('PrescriptionPDF', () => {
  test('renders to a non-empty PDF blob', async () => {
    const blob = await pdf(<PrescriptionPDF {...BASE_PROPS} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders with optional frequencyLabel', async () => {
    const blob = await pdf(<PrescriptionPDF {...BASE_PROPS} frequencyLabel="Daily" />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders seconds exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Wall Sit', sets: 3, reps: 45, weight: null, therapist_notes: null,
          measurement_type: 'seconds', bilateral: false,
          tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
          prescription_exercise_sets: [] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders tempo exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Nordic Curl', sets: 4, reps: 6, weight: null, therapist_notes: null,
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: 3, tempo_bottom_pause: 1, tempo_concentric: 2, tempo_top_pause: 0,
          prescription_exercise_sets: [] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders per-set exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Romanian Deadlift', sets: 3, reps: null, weight: null, therapist_notes: null,
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
          prescription_exercise_sets: [
            { set_number: 1, reps: 10, weight: 40 },
            { set_number: 2, reps: 8,  weight: 55 },
            { set_number: 3, reps: 6,  weight: 70 },
          ] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders per-set exercise with tempo without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Romanian Deadlift', sets: 3, reps: null, weight: null, therapist_notes: 'Keep back flat.',
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: 3, tempo_bottom_pause: 1, tempo_concentric: 2, tempo_top_pause: 0,
          prescription_exercise_sets: [
            { set_number: 1, reps: 10, weight: 40 },
            { set_number: 2, reps: 8,  weight: 55 },
          ] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders bodyweight exercise without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      exercises: [
        { name: 'Push-up', sets: 3, reps: 15, weight: null, therapist_notes: null,
          measurement_type: 'reps', bilateral: false,
          tempo_eccentric: null, tempo_bottom_pause: null, tempo_concentric: null, tempo_top_pause: null,
          prescription_exercise_sets: [] },
      ],
    }
    const blob = await pdf(<PrescriptionPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('renders empty exercises array without crashing', async () => {
    const blob = await pdf(<PrescriptionPDF {...BASE_PROPS} exercises={[]} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the new tests**

```bash
npm test PrescriptionPDF
```

Expected: all 8 tests pass.

- [ ] **Step 3: Run the full suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/therapist/PrescriptionPDF.test.jsx
git commit -m "test: add PrescriptionPDF render test suite"
```

---

## Task 7: Client PDF download — `Dashboard.jsx`

**Files:**
- Modify: `src/pages/client/Dashboard.jsx`

Add `useWeightUnit` hook, two new state variables, two download functions, a download icon on each session card, and a "Download All" button. No new files.

- [ ] **Step 1: Add imports**

In `src/pages/client/Dashboard.jsx`, find the existing imports block and add:

```js
import { pdf } from '@react-pdf/renderer'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { PrescriptionPDF } from '../../components/therapist/PrescriptionPDF'
import { AllSessionsPDF } from '../../components/therapist/AllSessionsPDF'
```

- [ ] **Step 2: Add hook and state**

Inside `ClientDashboard`, after the existing `const clinicName = useClinicName()` line, add:

```js
// useWeightUnit() for a client reads clients.weight_unit — the client's own display preference.
// Prescription weights are stored in canonical kg; formatWeight converts on render.
// This is the same approach SessionWizard uses for the same client-facing exercise display.
const weightUnit = useWeightUnit()
const [downloadingId, setDownloadingId] = useState(null)
const [downloadError, setDownloadError] = useState(null)
```

- [ ] **Step 3: Add `downloadSession` function**

After the `fetchCheckIns` function and before the `activeSessions` line, add:

```js
async function downloadSession(session) {
  setDownloadingId(session.id)
  setDownloadError(null)
  try {
    const { data: exercises, error } = await supabase
      .from('prescription_exercises')
      .select('sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
      .eq('prescription_id', session.id)
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)

    const mapped = (exercises ?? []).map(pe => ({
      name: pe.exercises?.name ?? '',
      sets: pe.sets,
      reps: pe.reps,
      weight: pe.weight,
      therapist_notes: pe.therapist_notes,
      measurement_type: pe.measurement_type ?? 'reps',
      bilateral: pe.bilateral ?? false,
      tempo_eccentric: pe.tempo_eccentric ?? null,
      tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
      tempo_concentric: pe.tempo_concentric ?? null,
      tempo_top_pause: pe.tempo_top_pause ?? null,
      prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
    }))

    const blob = await pdf(
      <PrescriptionPDF
        clinicName={clinicName ?? ''}
        clientName={profile.name ?? profile.email ?? ''}
        prescriptionName={session.name}
        frequencyLabel={frequencyLabel(session.frequency_days)}
        exercises={mapped}
        weightUnit={weightUnit}
      />
    ).toBlob()

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.name.toLowerCase().replace(/\s+/g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    setDownloadError('Failed to download PDF.')
    setTimeout(() => setDownloadError(null), 5000)
  } finally {
    setDownloadingId(null)
  }
}
```

- [ ] **Step 4: Add `downloadAllSessions` function**

Directly after `downloadSession`, add:

```js
async function downloadAllSessions() {
  setDownloadingId('all')
  setDownloadError(null)
  try {
    const toDownload = sessions.filter(isActive)
    const activeIds = toDownload.map(s => s.id)

    // Single batched query — one round trip regardless of session count
    const { data: allExercises, error } = await supabase
      .from('prescription_exercises')
      .select('prescription_id, sets, reps, weight, therapist_notes, measurement_type, bilateral, tempo_eccentric, tempo_bottom_pause, tempo_concentric, tempo_top_pause, prescription_exercise_sets(set_number, reps, weight), exercises(name)')
      .in('prescription_id', activeIds)
      .order('prescription_id', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)

    // Group exercises by prescription_id
    const byId = {}
    for (const pe of allExercises ?? []) {
      ;(byId[pe.prescription_id] ??= []).push(pe)
    }

    const mapEx = pe => ({
      name: pe.exercises?.name ?? '',
      sets: pe.sets,
      reps: pe.reps,
      weight: pe.weight,
      therapist_notes: pe.therapist_notes,
      measurement_type: pe.measurement_type ?? 'reps',
      bilateral: pe.bilateral ?? false,
      tempo_eccentric: pe.tempo_eccentric ?? null,
      tempo_bottom_pause: pe.tempo_bottom_pause ?? null,
      tempo_concentric: pe.tempo_concentric ?? null,
      tempo_top_pause: pe.tempo_top_pause ?? null,
      prescription_exercise_sets: pe.prescription_exercise_sets ?? [],
    })

    const prescriptions = toDownload.map(session => ({
      name: session.name,
      frequencyLabel: frequencyLabel(session.frequency_days),
      exercises: (byId[session.id] ?? []).map(mapEx),
    }))

    const blob = await pdf(
      <AllSessionsPDF
        clinicName={clinicName ?? ''}
        clientName={profile.name ?? profile.email ?? ''}
        prescriptions={prescriptions}
        weightUnit={weightUnit}
      />
    ).toBlob()

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(profile.name ?? profile.email ?? 'sessions').toLowerCase().replace(/\s+/g, '-')}-all-sessions.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    setDownloadError('Failed to download PDF.')
    setTimeout(() => setDownloadError(null), 5000)
  } finally {
    setDownloadingId(null)
  }
}
```

- [ ] **Step 5: Add "Download All" button and error message**

Find this exact line in Dashboard.jsx (the opening of the session cards flex column):

```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '512px' }}>
```

Insert the Download All block **immediately before** that `<div>` — it sits outside the gap-10px cards column so it has its own spacing:

```jsx
{activeSessions.length > 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', maxWidth: '512px' }}>
    <button
      onClick={downloadAllSessions}
      disabled={downloadingId !== null}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'none', border: '1px solid var(--color-border)',
        borderRadius: '7px', padding: '8px 14px',
        fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)',
        cursor: downloadingId !== null ? 'default' : 'pointer',
        opacity: downloadingId === 'all' ? 0.6 : 1,
      }}
    >
      {downloadingId === 'all' ? (
        <svg style={{ width: '14px', height: '14px', animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2a10 10 0 1 0 10 10" />
        </svg>
      ) : (
        <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {downloadingId === 'all' ? 'Preparing PDF…' : 'Download all sessions'}
    </button>
    {downloadError && (
      <p style={{ fontSize: '11px', color: 'var(--color-danger)', margin: 0 }}>{downloadError}</p>
    )}
  </div>
)}
```

Also add the spin keyframe to the page. Find the opening `<div style={{ minHeight: '100vh', ...}}>` and add a `<style>` tag as the first child:

```jsx
<style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
```

- [ ] **Step 6: Add download icon to each session card**

Find the `<Link to={`/client/sessions/${s.id}`} ...>Start</Link>` button inside the `activeSessions.map`. Change the card's right-side area from just the Link to a small flex column with the download icon above the Start button:

```jsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
  <button
    type="button"
    onClick={() => downloadSession(s)}
    disabled={downloadingId !== null}
    title="Download PDF"
    style={{
      background: 'none', border: 'none', cursor: downloadingId !== null ? 'default' : 'pointer',
      padding: '4px', color: 'var(--color-subtle)',
      opacity: downloadingId === s.id ? 0.5 : 1,
    }}
  >
    {downloadingId === s.id ? (
      <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M12 2a10 10 0 1 0 10 10" />
      </svg>
    ) : (
      <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    )}
  </button>
  <Link
    to={`/client/sessions/${s.id}`}
    style={{
      background: '#29B5CC', color: '#000', borderRadius: '7px',
      padding: '7px 14px', fontSize: '12px', fontWeight: 600,
      textDecoration: 'none', display: 'inline-block',
    }}
  >
    Start
  </Link>
</div>
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/pages/client/Dashboard.jsx
git commit -m "feat: add per-card and download-all PDF buttons to client Dashboard"
```
