import { useState } from 'react'
import { CompletionStat } from './CompletionStat'
import { PainChart } from './PainChart'
import { VolumeChart } from './VolumeChart'
import { computeCompletionStats, computePainData, computeVolumeData } from '../../utils/progressUtils'
import { CARD } from '../therapist/styles'
import ShimmerLine from '../shared/ShimmerLine'

export function PrescriptionProgressSection({ prescription, sessionLogs, weightUnit }) {
  const [expanded, setExpanded] = useState(false)

  const prescriptionSessions = (sessionLogs ?? []).filter(l => l.prescription_id === prescription.id)
  const completion = computeCompletionStats(prescription, sessionLogs ?? [])
  const painData = computePainData(prescriptionSessions)
  const volumeData = computeVolumeData(prescriptionSessions, weightUnit)

  const completionSummary = completion.expected !== null
    ? `${completion.completed} of ${completion.expected} sessions completed`
    : `${completion.completed} session${completion.completed !== 1 ? 's' : ''} completed`

  return (
    <div style={{ ...CARD, padding: 0, overflow: 'hidden', position: 'relative' }}>
      <ShimmerLine />
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{prescription.name}</p>
          <p style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-muted)', margin: '2px 0 0' }}>{completionSummary}</p>
        </div>
        <span style={{ marginLeft: '16px', flexShrink: 0, fontSize: '11px', color: 'var(--color-subtle)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '4px' }}>Completion</p>
            <CompletionStat completed={completion.completed} expected={completion.expected} />
          </div>

          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>Average Pain per Session (0–10)</p>
            <PainChart data={painData} />
          </div>

          <div>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '8px' }}>Total Volume per Session ({weightUnit})</p>
            <VolumeChart data={volumeData} weightUnit={weightUnit} />
          </div>
        </div>
      )}
    </div>
  )
}
