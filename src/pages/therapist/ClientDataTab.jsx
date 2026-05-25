import { useProgressData } from '../../hooks/useProgressData'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { PrescriptionProgressSection } from '../../components/progress/PrescriptionProgressSection'

export function ClientDataTab({ prescriptions }) {
  const weightUnit = useWeightUnit()
  const prescriptionIds = (prescriptions ?? []).map(p => p.id)
  const { data: sessionLogs, loading, error } = useProgressData(prescriptionIds)

  if (loading) return <p className="mt-4 text-sm text-dark-muted">Loading client data…</p>
  if (error) return <p className="mt-4 text-sm text-red-400">Failed to load client data.</p>
  if (!prescriptions || prescriptions.length === 0) {
    return <p className="mt-4 text-sm text-dark-muted">No prescriptions found for this client.</p>
  }

  return (
    <div className="mt-6 max-w-2xl space-y-4">
      {prescriptions.map(p => (
        <PrescriptionProgressSection
          key={p.id}
          prescription={p}
          sessionLogs={sessionLogs ?? []}
          weightUnit={weightUnit}
        />
      ))}
    </div>
  )
}
