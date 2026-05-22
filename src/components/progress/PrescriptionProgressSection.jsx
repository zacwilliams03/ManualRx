import { CompletionStat } from './CompletionStat'
import { PainChart } from './PainChart'
import { VolumeChart } from './VolumeChart'
import { computeCompletionStats, computePainData, computeVolumeData } from '../../utils/progressUtils'

export function PrescriptionProgressSection({ prescription, sessionLogs, weightUnit }) {
  const prescriptionSessions = (sessionLogs ?? []).filter(l => l.prescription_id === prescription.id)
  const completion = computeCompletionStats(prescription, sessionLogs ?? [])
  const painData = computePainData(prescriptionSessions)
  const volumeData = computeVolumeData(prescriptionSessions, weightUnit)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-5">
      <h3 className="text-sm font-semibold text-gray-900">{prescription.name}</h3>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Completion</p>
        <CompletionStat completed={completion.completed} expected={completion.expected} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Average Pain per Session (0–10)</p>
        <PainChart data={painData} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Total Volume per Session ({weightUnit})</p>
        <VolumeChart data={volumeData} weightUnit={weightUnit} />
      </div>
    </div>
  )
}
