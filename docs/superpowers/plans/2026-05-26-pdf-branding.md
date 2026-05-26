# PDF Branding Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `PrescriptionPDF.jsx` to use the correct brand teal colour and add the ManualRx logo to the PDF header.

**Architecture:** Single-file change — all colour constants and JSX live in `src/components/therapist/PrescriptionPDF.jsx`. No logic changes, no new files, no call-site changes. Note: `@react-pdf/renderer` components don't render to the DOM so there are no unit tests to write — verification is visual (download a PDF and inspect it).

**Tech Stack:** `@react-pdf/renderer` v4, React JSX

---

### Task 1: Fix colour constants and notesBox border

**Files:**
- Modify: `src/components/therapist/PrescriptionPDF.jsx`

- [ ] **Step 1: Update the two colour constants and subtitle style, add notesBox left border**

  Open `src/components/therapist/PrescriptionPDF.jsx` and make the following changes:

  **Lines 4–8** — change `TEAL` and `TEAL_LIGHT`:
  ```js
  const NAVY = '#1E2D3D'
  const TEAL = '#29B5CC'
  const TEAL_LIGHT = '#E1F5FA'
  const GREY = '#6B7280'
  const BORDER = '#D4E8E8'
  ```

  **`subtitle` style** — change `color: TEAL` to `color: GREY` so "EXERCISE PROGRAM" is grey, not teal:
  ```js
  subtitle: {
    fontSize: 9,
    color: GREY,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  ```

  **`notesBox` style** — add a left border:
  ```js
  notesBox: {
    backgroundColor: TEAL_LIGHT,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    padding: 6,
    marginTop: 4,
  },
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/therapist/PrescriptionPDF.jsx
  git commit -m "fix: align PDF colours to brand teal and add notes left border"
  ```

---

### Task 2: Replace clinic name text with ManualRx logo

**Files:**
- Modify: `src/components/therapist/PrescriptionPDF.jsx`

- [ ] **Step 1: Add logo styles to the StyleSheet**

  Add these three new styles inside the `StyleSheet.create({...})` call, after the `subtitle` style:

  ```js
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
  ```

- [ ] **Step 2: Replace the header JSX**

  Find the `<View style={styles.header}>` block (lines 93–96) and replace it with:

  ```jsx
  <View style={styles.header}>
    <View style={styles.logoRow}>
      <View style={styles.logoBar} />
      <Text style={styles.logoManual}>Manual<Text style={styles.logoRx}>Rx</Text></Text>
    </View>
    <Text style={styles.subtitle}>EXERCISE PROGRAM</Text>
  </View>
  ```

  Note: `@react-pdf/renderer` supports nested `<Text>` for inline colour changes — `Manual` inherits `logoManual` (dark) and the inner `<Text style={styles.logoRx}>Rx</Text>` overrides to teal.

- [ ] **Step 3: Remove the now-unused `clinicName` style from StyleSheet**

  Delete the `clinicName` style block (it was only used in the old header):

  ```js
  // DELETE this entire block:
  clinicName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
  },
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/therapist/PrescriptionPDF.jsx
  git commit -m "feat: add ManualRx logo to PDF header"
  ```

---

### Task 3: Clean up temp file and push

**Files:**
- Delete: `pdf-preview.html` (temp mockup from brainstorming, not part of the app)

- [ ] **Step 1: Delete the temp mockup file**

  ```bash
  rm pdf-preview.html
  ```

- [ ] **Step 2: Verify the final state of `PrescriptionPDF.jsx`**

  The complete file should look like this:

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
    subtitle: {
      fontSize: 9,
      color: GREY,
      letterSpacing: 1.5,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      fontSize: 10,
      color: GREY,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      marginBottom: 16,
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

  export function PrescriptionPDF({ clinicName, clientName, prescriptionName, exercises, weightUnit }) {
    const today = formatDate(new Date())

    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoBar} />
              <Text style={styles.logoManual}>Manual<Text style={styles.logoRx}>Rx</Text></Text>
            </View>
            <Text style={styles.subtitle}>EXERCISE PROGRAM</Text>
          </View>

          <View style={styles.metaRow}>
            <Text>Client: {clientName}</Text>
            <Text>Program: {prescriptionName}</Text>
            <Text>Date: {today}</Text>
          </View>

          <View style={styles.divider} />

          {exercises.map((ex, i) => (
            <View key={i} style={styles.exerciseBlock}>
              <Text style={styles.exerciseTitle}>{i + 1}. {ex.name}</Text>
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

          <Text style={styles.footer}>Generated by ManualRx</Text>
        </Page>
      </Document>
    )
  }
  ```

- [ ] **Step 3: Commit and push**

  ```bash
  git add -A
  git commit -m "chore: remove pdf-preview.html temp file"
  git push
  ```

---

### Verification

1. Open the app locally (`npm run dev`)
2. Log in as a therapist, navigate to Prescribe, select a client + prescription that has exercises with therapist notes
3. Click "Download PDF" and open the downloaded file
4. Confirm:
   - Logo appears top-left: teal vertical bar + "Manual" in dark + "Rx" in teal
   - "EXERCISE PROGRAM" subtitle is grey (not teal)
   - Header bottom border is bright teal `#29B5CC`
   - Therapist notes box has a light teal background and a teal left border
   - Page is white, prints cleanly
