import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { weightDisplay, formatPdfDate } from '../../utils/pdfUtils'

const NAVY = '#1E2D3D'
const TEAL = '#29B5CC'
const TEAL_LIGHT = '#E1F5FA'
const GREY = '#6B7280'
const BORDER = '#D4E8E8'
const WEEK_BG = '#F0FAFB'

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
  programTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    color: NAVY,
    marginBottom: 16,
  },
  weekBlock: {
    marginBottom: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WEEK_BG,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderRadius: 2,
  },
  weekLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: TEAL,
  },
  sessionBlock: {
    marginBottom: 10,
    paddingLeft: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  sessionName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: NAVY,
    marginRight: 6,
  },
  sessionFreq: {
    fontSize: 9,
    color: TEAL,
  },
  exerciseBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  exerciseTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: NAVY,
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: 10,
    color: GREY,
    marginBottom: 3,
  },
  notesBox: {
    backgroundColor: TEAL_LIGHT,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    padding: 5,
    marginTop: 3,
  },
  notesText: {
    fontSize: 9,
    color: NAVY,
  },
  sessionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 10,
    marginTop: 4,
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

function freqLabel(days) {
  if (!days) return ''
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  return `Every ${days} days`
}

export function ProgramPDF({ clinicName, clientName, programName, startDate, weeks, weightUnit }) {
  const today = formatPdfDate(new Date())

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

        <Text style={styles.programTitle}>{programName}</Text>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekBlock}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>Week {week.weekNumber}</Text>
            </View>

            {week.sessions.map((session, si) => (
              <View key={si} style={styles.sessionBlock}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionName}>{session.name}</Text>
                  {session.frequencyDays ? (
                    <Text style={styles.sessionFreq}>{freqLabel(session.frequencyDays)}</Text>
                  ) : null}
                </View>

                {session.exercises.map((ex, ei) => (
                  <View key={ei} style={styles.exerciseBlock}>
                    <Text style={styles.exerciseTitle}>{ei + 1}. {ex.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {ex.sets} sets × {ex.reps} {ex.measurement_type === 'seconds' ? 'sec' : 'reps'}
                      {ex.weight ? ` @ ${weightDisplay(ex.weight, weightUnit)}` : ' — Bodyweight'}
                      {ex.bilateral ? ' — Both sides' : ''}
                    </Text>
                    {ex.therapist_notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>{ex.therapist_notes}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}

                {si < week.sessions.length - 1 && <View style={styles.sessionDivider} />}
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>Generated by ManualRx</Text>
      </Page>
    </Document>
  )
}
