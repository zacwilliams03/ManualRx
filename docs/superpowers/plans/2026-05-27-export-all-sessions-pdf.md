# Export All Sessions PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the "Export PDF" hero button on the Prescribe page to generate and download a single PDF containing all active prescribed sessions for the current client.

**Architecture:** A new `AllSessionsPDF` React-PDF component renders all active prescriptions continuously on a single A4 page. `Prescribe.jsx` gets a `downloadAllPDF` async function that fetches all exercises for active prescriptions in one Supabase query, builds the props, and triggers a blob download. The existing per-prescription `downloadPDF` function and `PrescriptionPDF` component are untouched.

**Tech Stack:** `@react-pdf/renderer` v4.5.1, React 18, Supabase JS client, Vitest (globals: true)

---

## Files

| File | Change |
|------|--------|
| `src/components/therapist/AllSessionsPDF.jsx` | Create — multi-session PDF component |
| `src/components/therapist/AllSessionsPDF.test.jsx` | Create — smoke tests |
| `src/pages/therapist/Prescribe.jsx` | Modify — import, 2 state vars, `downloadAllPDF`, button JSX |

---

## Task 1: Create AllSessionsPDF component (TDD)

**Files:**
- Create: `src/components/therapist/AllSessionsPDF.jsx`
- Create: `src/components/therapist/AllSessionsPDF.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/therapist/AllSessionsPDF.test.jsx`:

```jsx
import { pdf } from '@react-pdf/renderer'
import { AllSessionsPDF } from './AllSessionsPDF'

const BASE_PROPS = {
  clinicName: 'Test Clinic',
  clientName: 'Jane Doe',
  weightUnit: 'kg',
  prescriptions: [
    {
      name: 'Session 1',
      frequencyLabel: 'Daily',
      exercises: [
        { name: 'Squat', sets: 3, reps: 10, weight: 50, therapist_notes: 'Keep back straight' },
      ],
    },
  ],
}

describe('AllSessionsPDF', () => {
  test('renders to a non-empty PDF blob', async () => {
    const blob = await pdf(<AllSessionsPDF {...BASE_PROPS} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  test('handles empty exercises list without crashing', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [{ name: 'Empty Session', frequencyLabel: 'Weekly', exercises: [] }],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
  })

  test('renders multiple prescriptions with a divider between them', async () => {
    const props = {
      ...BASE_PROPS,
      prescriptions: [
        { name: 'Session A', frequencyLabel: 'Daily', exercises: [{ name: 'Squat', sets: 3, reps: 10, weight: 40, therapist_notes: null }] },
        { name: 'Session B', frequencyLabel: 'Weekly', exercises: [{ name: 'Lunge', sets: 2, reps: 12, weight: null, therapist_notes: null }] },
      ],
    }
    const blob = await pdf(<AllSessionsPDF {...props} />).toBlob()
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```
npm test
```

Expected output includes: `Cannot find module './AllSessionsPDF'`

- [ ] **Step 3: Create AllSessionsPDF component**

Create `src/components/therapist/AllSessionsPDF.jsx`:

```jsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { weightDisplay } from '../../utils/pdfUtils'

const NAVY = '#1E2D3D'
const TEAL = '#29B5CC'
const TEAL_LIGHT = '#E1F5FA'
const GREY = '#6B7280'
const BORDER = '#D4E8E8'

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
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    paddingBottom: 12,
  },
  subtitle: {
    fontSize: 9,
    color: GREY,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logoBar: {
    width: 3,
    height: 20,
    backgroundColor: TEAL,
    borderRadius: 2,
    marginRight: 8,
  },
  logoManual: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: NAVY,
  },
  logoRx: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: TEAL,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    fontSize: 10,
    color: GREY,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: NAVY,
    marginRight: 8,
  },
  sectionFreq: {
    fontSize: 9,
    color: TEAL,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 16,
    marginTop: 8,
  },
  exerciseBlock: {
    marginBottom: 14,
  },
  exerciseTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: NAVY,
    marginBottom: 3,
  },
  exerciseMeta: {
    fontSize: 10,
    color: GREY,
    marginBottom: 4,
  },
  notesBox: {
    backgroundColor: TEAL_LIGHT,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    padding: 6,
    marginTop: 4,
  },
  notesText: {
    fontSize: 10,
    color: NAVY,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: 'center',
    fontSize: 8,
    color: GREY,
  },
})

function formatDate(date) {
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function AllSessionsPDF({ clinicName, clientName, prescriptions, weightUnit }) {
  const today = formatDate(new Date())

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBar} />
            <Text style={styles.logoManual}>
              Manual<Text style={styles.logoRx}>Rx</Text>
            </Text>
          </View>
          <Text style={styles.subtitle}>EXERCISE PROGRAM — {clinicName}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text>Client: {clientName}</Text>
          <Text>Date: {today}</Text>
        </View>

        {prescriptions.map((presc, pi) => (
          <View key={pi}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionName}>{presc.name}</Text>
              <Text style={styles.sectionFreq}>{presc.frequencyLabel}</Text>
            </View>
            {presc.exercises.map((ex, ei) => (
              <View key={ei} style={styles.exerciseBlock}>
                <Text style={styles.exerciseTitle}>{ei + 1}. {ex.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {ex.sets} sets × {ex.reps} reps
                  {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
                </Text>
                {ex.therapist_notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>{ex.therapist_notes}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {pi < prescriptions.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <Text style={styles.footer}>Generated by ManualRx</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
npm test
```

Expected: all 3 `AllSessionsPDF` tests pass alongside existing `pdfUtils` tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/therapist/AllSessionsPDF.jsx src/components/therapist/AllSessionsPDF.test.jsx
git commit -m "feat: add AllSessionsPDF component for all-active-sessions export"
```

---

## Task 2: Wire downloadAllPDF and button in Prescribe.jsx

**Files:**
- Modify: `src/pages/therapist/Prescribe.jsx`

### 2a — Add import

- [ ] **Step 1: Add AllSessionsPDF import**

In `src/pages/therapist/Prescribe.jsx`, find the existing import block at the top (around line 12):

```js
import { PrescriptionPDF } from '../../components/therapist/PrescriptionPDF'
```

Add immediately after it:

```js
import { AllSessionsPDF } from '../../components/therapist/AllSessionsPDF'
```

### 2b — Add state

- [ ] **Step 2: Add allPdfLoading and allPdfError state**

In `Prescribe.jsx`, find the existing PDF state vars (around lines 141–142):

```js
const [pdfLoadingId, setPdfLoadingId] = useState(null)
const [pdfError, setPdfError] = useState(null)
```

Add two lines immediately after:

```js
const [allPdfLoading, setAllPdfLoading] = useState(false)
const [allPdfError, setAllPdfError] = useState(false)
```

### 2c — Add downloadAllPDF function

- [ ] **Step 3: Add downloadAllPDF after sortedSessions**

In `Prescribe.jsx`, find `sortedSessions` (around line 318):

```js
const sortedSessions = [...sessions].sort((a, b) => {
  const aActive = isActive(a), bActive = isActive(b)
  if (aActive !== bActive) return aActive ? -1 : 1
  return new Date(a.created_at) - new Date(b.created_at)
})
```

Add the following immediately after the `sortedSessions` declaration (before the `if (loading)` early return):

```js
async function downloadAllPDF() {
  const activeSessions = sortedSessions.filter(isActive)
  if (activeSessions.length === 0) return

  setAllPdfLoading(true)
  setAllPdfError(false)
  try {
    const activeIds = activeSessions.map(s => s.id)
    const { data: peData, error: peError } = await supabase
      .from('prescription_exercises')
      .select('prescription_id, sets, reps, weight, therapist_notes, exercises(name)')
      .in('prescription_id', activeIds)
      .order('created_at', { ascending: true })
    if (peError) throw peError

    const byId = {}
    for (const row of peData) {
      if (!byId[row.prescription_id]) byId[row.prescription_id] = []
      byId[row.prescription_id].push({
        name: row.exercises?.name ?? 'Exercise',
        sets: row.sets,
        reps: row.reps,
        weight: row.weight,
        therapist_notes: row.therapist_notes,
      })
    }

    const prescriptions = activeSessions.map(s => ({
      name: s.name,
      frequencyLabel: frequencyLabel(s.frequency_days),
      exercises: byId[s.id] ?? [],
    }))

    const blob = await pdf(
      <AllSessionsPDF
        clinicName={clinicName}
        clientName={client?.name ?? 'Client'}
        prescriptions={prescriptions}
        weightUnit={weightUnit}
      />
    ).toBlob()

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitise(client?.name ?? 'client')}-all-sessions.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('PDF generation failed:', err)
    setAllPdfError(true)
  } finally {
    setAllPdfLoading(false)
  }
}
```

### 2d — Wire the button

- [ ] **Step 4: Replace the placeholder Export PDF button**

In `Prescribe.jsx`, find the placeholder button in the `actions` prop of `<PageHero>` (around lines 343–349):

```jsx
{/* Global Export PDF — placeholder for future "print all sessions" feature */}
<button
  onClick={() => {}}
  style={{ padding: '8px 14px', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}
>
  Export PDF
</button>
```

Replace with:

```jsx
{sortedSessions.some(isActive) && (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
    <button
      onClick={downloadAllPDF}
      disabled={allPdfLoading}
      style={{ padding: '8px 14px', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: allPdfLoading ? 'default' : 'pointer', opacity: allPdfLoading ? 0.6 : 1 }}
    >
      {allPdfLoading ? 'Exporting…' : 'Export PDF'}
    </button>
    {allPdfError && (
      <span style={{ fontSize: '11px', color: '#f87171' }}>Export failed</span>
    )}
  </div>
)}
```

- [ ] **Step 5: Run tests**

```
npm test
```

Expected: all tests pass (no regressions).

- [ ] **Step 6: Manual smoke test**

Start the dev server:

```
npm run dev
```

Navigate to a client with at least one active prescription. Verify:
- "Export PDF" button is visible.
- Clicking it shows "Exporting…" briefly then triggers a download.
- Downloaded file is named `{clientName}-all-sessions.pdf`.
- PDF contains only active sessions: each with heading, frequency label, and exercise list.
- Navigate to a client with only inactive prescriptions — button is hidden.

- [ ] **Step 7: Commit**

```bash
git add src/pages/therapist/Prescribe.jsx
git commit -m "feat: wire Export PDF button to generate all-active-sessions PDF"
```
