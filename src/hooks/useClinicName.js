import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function useClinicName() {
  const { user, profile } = useAuth()
  const [clinicName, setClinicName] = useState(null)

  useEffect(() => {
    if (!user || !profile) return
    if (profile.role === 'therapist') {
      supabase
        .from('therapist_profiles')
        .select('clinic_name')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => { if (data?.clinic_name) setClinicName(data.clinic_name) })
    } else {
      // clients.therapist_id and therapist_profiles.user_id both hold the therapist's
      // auth UID — the naming differs but the values are the same, so the join is valid.
      supabase
        .from('clients')
        .select('therapist_id')
        .eq('user_id', user.id)
        .single()
        .then(({ data: clientData }) => {
          if (!clientData?.therapist_id) return
          supabase
            .from('therapist_profiles')
            .select('clinic_name')
            .eq('user_id', clientData.therapist_id)
            .maybeSingle()
            .then(({ data }) => { if (data?.clinic_name) setClinicName(data.clinic_name) })
        })
    }
  }, [user, profile])

  return clinicName
}
