import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useClinicName } from '../../hooks/useClinicName'
import { ProgressTab } from './ProgressTab'

function frequencyLabel(days) {
  if (!days) return 'No repeat'
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  return `Every ${days} days`
}

function isRecentlyCompleted(session) {
  const logs = (session.session_logs ?? []).filter(l => l.completed_at)
  if (logs.length === 0) return false
  const lastMs = Math.max(...logs.map(l => new Date(l.completed_at).getTime()))
  if (!session.frequency_days) return true
  const daysSince = (Date.now() - lastMs) / (1000 * 60 * 60 * 24)
  return daysSince < session.frequency_days
}

function isActive(prescription) {
  const { start_date, duration_weeks } = prescription
  if (!start_date || !duration_weeks) return true
  const expiry = new Date(start_date)
  expiry.setDate(expiry.getDate() + duration_weeks * 7 + 7) // +7 grace period
  return expiry >= new Date()
}

export default function ClientDashboard() {
  const { profile } = useAuth()
  const clinicName = useClinicName()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('sessions')

  useEffect(() => {
    if (profile?.id) fetchSessions()
  }, [profile?.id])

  async function fetchSessions() {
    const { data: clientRecord, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (clientError || !clientRecord) {
      setError('Could not load your profile. Please contact your therapist.')
      setLoading(false)
      return
    }

    const { data, error: sessionsError } = await supabase
      .from('prescriptions')
      .select('id, name, frequency_days, start_date, duration_weeks, therapist_id, prescription_exercises(count), session_logs(completed_at)')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: true })

    if (sessionsError) setError('Failed to load sessions.')
    else setSessions(data ?? [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Sessions</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {profile?.name}{clinicName ? ` · ${clinicName}` : ''}
          </p>
        </div>
        <Link
          to="/client/history"
          className="rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          History
        </Link>
        <Link
          to="/client/settings"
          className="rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Settings
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="max-w-lg flex gap-6 border-b border-gray-200 mb-6">
        {[['sessions', 'Sessions'], ['progress', 'Progress']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-brand-primary text-brand-primary'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {activeTab === 'sessions' && !loading && !error && sessions.filter(isActive).length === 0 && (
        <p className="text-sm text-gray-500">Your therapist hasn't added any sessions yet.</p>
      )}

      {activeTab === 'sessions' && (
      <div className="space-y-3 max-w-lg">
        {sessions.filter(isActive).map(s => {
          const completions = s.session_logs ?? []
          const lastDone =
            completions.length > 0
              ? new Date(
                  Math.max(...completions.map(l => new Date(l.completed_at).getTime()))
                ).toLocaleDateString()
              : null

          return (
            <div
              key={s.id}
              className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  {isRecentlyCompleted(s) && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Completed
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {s.prescription_exercises[0]?.count ?? 0} exercises · {frequencyLabel(s.frequency_days)}
                </p>
                {lastDone && (
                  <p className="mt-0.5 text-xs text-gray-400">Last completed: {lastDone}</p>
                )}
              </div>
              <Link
                to={`/client/sessions/${s.id}`}
                className="shrink-0 rounded bg-brand-primary px-4 py-2.5 text-sm text-white hover:bg-brand-primary-dark"
              >
                Start
              </Link>
            </div>
          )
        })}
      </div>
      )}

      {activeTab === 'progress' && !loading && !error && (
        <ProgressTab prescriptions={sessions.filter(isActive)} />
      )}
    </div>
  )
}
