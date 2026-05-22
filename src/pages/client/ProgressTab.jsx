import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useProgressData } from '../../hooks/useProgressData'
import { PrescriptionProgressSection } from '../../components/progress/PrescriptionProgressSection'

export function ProgressTab({ prescriptions }) {
  const [weightUnit, setWeightUnit] = useState('kg')

  useEffect(() => {
    if (!prescriptions || prescriptions.length === 0) return
    const therapistId = prescriptions[0].therapist_id
    if (!therapistId) return
    supabase
      .from('therapist_profiles')
      .select('weight_unit')
      .eq('user_id', therapistId)
      .single()
      .then(({ data }) => { if (data?.weight_unit) setWeightUnit(data.weight_unit) })
  }, [prescriptions])

  const prescriptionIds = (prescriptions ?? []).map(p => p.id)
  const { data: sessionLogs, loading, error } = useProgressData(prescriptionIds)

  if (loading) return <p className="text-sm text-gray-500">Loading progress…</p>
  if (error) return <p className="text-sm text-red-600">Failed to load progress data.</p>
  if (!prescriptions || prescriptions.length === 0) {
    return <p className="text-sm text-gray-500">No active prescriptions to show progress for.</p>
  }

  return (
    <div className="space-y-4 max-w-lg">
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
