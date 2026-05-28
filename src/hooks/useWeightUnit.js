import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function useWeightUnit() {
  const { user, profile } = useAuth()
  const [weightUnit, setWeightUnit] = useState('kg')

  useEffect(() => {
    if (!user || !profile) return
    const table = profile.role === 'therapist' ? 'therapist_profiles' : 'clients'
    supabase
      .from(table)
      .select('weight_unit')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data?.weight_unit) setWeightUnit(data.weight_unit) })
  }, [user?.id, profile?.role])

  return weightUnit
}
