import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function VideoPlayer({ url }) {
  if (!url) return null

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')

  if (isYouTube) {
    let embedUrl = url
    if (url.includes('watch?v=')) {
      const videoId = new URL(url).searchParams.get('v')
      embedUrl = `https://www.youtube.com/embed/${videoId}`
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0]
      embedUrl = `https://www.youtube.com/embed/${videoId}`
    }
    return (
      <iframe
        src={embedUrl}
        className="w-full rounded"
        style={{ aspectRatio: '16/9' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Exercise video"
      />
    )
  }

  return (
    <video
      src={url}
      controls
      className="w-full rounded"
      style={{ aspectRatio: '16/9' }}
    />
  )
}

export default function SessionComplete() {
  const { sessionId } = useParams()
  const { profile } = useAuth()

  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [logs, setLogs] = useState({})
  const [sessionRpe, setSessionRpe] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const [sessionRes, exercisesRes] = await Promise.all([
        supabase.from('prescriptions').select('id, name').eq('id', sessionId).single(),
        supabase
          .from('prescription_exercises')
          .select('id, sets, reps, therapist_notes, exercises(id, name, category, video_url)')
          .eq('prescription_id', sessionId)
          .order('order', { ascending: true }),
      ])

      if (sessionRes.error || !sessionRes.data) {
        setError('Session not found.')
        setLoading(false)
        return
      }
      setSession(sessionRes.data)

      const exList = exercisesRes.data ?? []
      setExercises(exList)

      const initialLogs = {}
      exList.forEach(pe => {
        initialLogs[pe.id] = {
          sets: String(pe.sets ?? ''),
          reps: String(pe.reps ?? ''),
          weight: '',
          pain: '',
          notes: '',
        }
      })
      setLogs(initialLogs)
      setLoading(false)
    }
    fetchData()
  }, [sessionId])

  function updateLog(peId, field, value) {
    setLogs(prev => ({ ...prev, [peId]: { ...prev[peId], [field]: value } }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)

    const { data: sessionLog, error: slError } = await supabase
      .from('session_logs')
      .insert({
        prescription_id: sessionId,
        client_id: profile.id,
        session_rpe: sessionRpe !== '' ? parseInt(sessionRpe) : null,
        session_notes: sessionNotes.trim() || null,
      })
      .select('id')
      .single()

    if (slError) {
      setError('Failed to save session. Please try again.')
      setSubmitting(false)
      return
    }

    const exerciseLogs = exercises.map(pe => ({
      prescription_exercise_id: pe.id,
      client_id: profile.id,
      session_log_id: sessionLog.id,
      sets_completed: logs[pe.id]?.sets ? parseInt(logs[pe.id].sets) : null,
      reps_completed: logs[pe.id]?.reps ? parseInt(logs[pe.id].reps) : null,
      weight_completed: logs[pe.id]?.weight ? parseFloat(logs[pe.id].weight) : null,
      pain_rating: logs[pe.id]?.pain !== '' && logs[pe.id]?.pain !== undefined
        ? parseInt(logs[pe.id].pain)
        : null,
      client_notes: logs[pe.id]?.notes?.trim() || null,
      completed_at: new Date().toISOString(),
    }))

    const { error: elError } = await supabase.from('exercise_logs').insert(exerciseLogs)
    if (elError) {
      setError('Session saved but exercise logs failed. Please try again.')
      setSubmitting(false)
      return
    }

    setDone(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Session complete!</h2>
          <p className="mt-2 text-sm text-gray-500">Great work. Your session has been logged.</p>
          <Link
            to="/client"
            className="mt-6 inline-block rounded bg-gray-800 px-4 py-2 text-sm text-white"
          >
            Back to sessions
          </Link>
        </div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/client" className="mt-2 inline-block text-sm text-brand-primary hover:underline">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Link to="/client" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to sessions
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">{session?.name}</h1>

      <div className="mt-6 max-w-lg space-y-5">
        {exercises.map(pe => (
          <div key={pe.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-base font-semibold text-gray-900">{pe.exercises.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{pe.exercises.category}</p>

            {pe.exercises.video_url && (
              <div className="mt-3">
                <VideoPlayer url={pe.exercises.video_url} />
              </div>
            )}

            {pe.therapist_notes && (
              <p className="mt-3 rounded bg-brand-note-bg border border-brand-note-border px-3 py-2 text-sm text-brand-note-text">
                {pe.therapist_notes}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">Sets completed</label>
                <input
                  type="number"
                  min="0"
                  value={logs[pe.id]?.sets ?? ''}
                  onChange={e => updateLog(pe.id, 'sets', e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Reps completed</label>
                <input
                  type="number"
                  min="0"
                  value={logs[pe.id]?.reps ?? ''}
                  onChange={e => updateLog(pe.id, 'reps', e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">
                  Weight <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={logs[pe.id]?.weight ?? ''}
                  onChange={e => updateLog(pe.id, 'weight', e.target.value)}
                  placeholder="kg"
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Pain (0–10 NPRS)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={logs[pe.id]?.pain ?? ''}
                  onChange={e => updateLog(pe.id, 'pain', e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600">
                Notes <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={logs[pe.id]?.notes ?? ''}
                onChange={e => updateLog(pe.id, 'notes', e.target.value)}
                placeholder="e.g. felt discomfort on rep 3"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Session summary</h3>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600">
              Session effort (0–10 Borg CR-10)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={sessionRpe}
              onChange={e => setSessionRpe(e.target.value)}
              className="mt-1 block w-28 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600">
              Session notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={sessionNotes}
              onChange={e => setSessionNotes(e.target.value)}
              rows={2}
              placeholder="How did the session feel overall?"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded bg-gray-800 py-2.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Complete session'}
        </button>
      </div>
    </div>
  )
}
