import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { formatTempo } from '../../utils/formatTempo'
import { formatWeight } from '../../utils/weightUtils'
import { formatRest } from '../../utils/formatRest'

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
        {ex.rest_seconds > 0
          ? <Text style={{ color: GREY, fontSize: 7.5, marginTop: 2 }}>Rest: {formatRest(ex.rest_seconds)} between sets</Text>
          : null
        }
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
        <View style={s.cellExercise}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.exName}>{ex.name}</Text>
            <View style={s.perSetBadge}><Text style={s.perSetBadgeText}>PER-SET</Text></View>
          </View>
          {ex.rest_seconds > 0
            ? <Text style={{ color: GREY, fontSize: 7.5, marginTop: 2 }}>Rest: {formatRest(ex.rest_seconds)} between sets</Text>
            : null
          }
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
