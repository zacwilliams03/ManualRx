import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useProgressData(prescriptionIds) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const key = prescriptionIds ? prescriptionIds.join(',') : ''

  useEffect(() => {
    if (!key) {
      setData([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    supabase
      .from('session_logs')
      .select('id, completed_at, prescription_id, exercise_logs(pain_rating, sets_data, sets_completed, reps_completed, weight_completed)')
      .in('prescription_id', prescriptionIds)
      .order('completed_at', { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setData(rows ?? [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [key])

  return { data, loading, error }
}
