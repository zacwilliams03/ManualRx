import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import { useClinicName } from '../../hooks/useClinicName'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function TherapistDashboard() {
  const { profile } = useAuth()
  const [clientCount, setClientCount] = useState(null)
  const clinicName = useClinicName()
  const firstName = profile?.name?.split(' ')[0] ?? ''

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', profile.id)
      .then(({ count }) => setClientCount(count ?? 0))
  }, [profile?.id])

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-dark-text">
          {greeting()}, {firstName}!
        </h1>
        {clientCount !== null && (
          <p className="mt-1 text-sm text-dark-muted">
            {clinicName ? `${clinicName} · ` : ''}{clientCount} active {clientCount === 1 ? 'client' : 'clients'}
          </p>
        )}
      </div>
    </SidebarLayout>
  )
}
