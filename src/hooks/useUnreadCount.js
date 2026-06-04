import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function useUnreadCount() {
  const [count, setCount] = useState(0)
  const { profile } = useAuth()

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function run() {
      if (profile.role === 'therapist') {
        const { count: c } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('therapist_id', profile.id)
          .eq('sender_role', 'client')
          .is('read_at', null)
        if (!cancelled) setCount(c ?? 0)
      } else {
        // Two-step: auth.uid() != clients.id, so resolve first
        const { data: clientRow } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', profile.id)
          .single()
        if (!clientRow || cancelled) return
        const { count: c } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientRow.id)
          .eq('sender_role', 'therapist')
          .is('read_at', null)
        if (!cancelled) setCount(c ?? 0)
      }
    }

    run()
    return () => { cancelled = true }
  }, [profile])

  return count
}
