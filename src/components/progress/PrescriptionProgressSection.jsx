import { useState } from 'react'
import { CompletionStat } from './CompletionStat'
import { PainChart } from './PainChart'
import { VolumeChart } from './VolumeChart'
import { computeCompletionStats, computePainData, computeVolumeData } from '../../utils/progressUtils'

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
    <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated transition-colors cursor-pointer"
      >
        <div>
          <p className="text-sm font-semibold text-dark-text">{prescription.name}</p>
          <p className="mt-0.5 text-xs text-dark-muted">{completionSummary}</p>
        </div>
        <span className="ml-4 shrink-0 text-xs text-dark-subtle">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-dark-border px-4 py-4 space-y-5">
          <div>
            <p className="text-xs font-medium text-dark-muted mb-1">Completion</p>
            <CompletionStat completed={completion.completed} expected={completion.expected} />
          </div>

          <div>
            <p className="text-xs font-medium text-dark-muted mb-2">Average Pain per Session (0–10)</p>
            <PainChart data={painData} />
          </div>

          <div>
            <p className="text-xs font-medium text-dark-muted mb-2">Total Volume per Session ({weightUnit})</p>
            <VolumeChart data={volumeData} weightUnit={weightUnit} />
          </div>
        </div>
      )}
    </div>
  )
}
