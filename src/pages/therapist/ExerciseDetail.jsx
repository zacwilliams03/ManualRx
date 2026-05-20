import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import TherapistNav from '../../components/therapist/TherapistNav'

function VideoPlayer({ url }) {
  if (!url) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded bg-gray-100">
        <p className="text-sm text-gray-400">No video available</p>
      </div>
    )
  }

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

export default function ExerciseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchExercise() {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, description, category, video_url, thumbnail_url, is_custom, created_by, default_sets, default_reps')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Exercise not found.')
      } else {
        setExercise(data)
      }
      setLoading(false)
    }
    fetchExercise()
  }, [id])

  async function handleDelete() {
    if (!window.confirm(`Delete "${exercise.name}"? This cannot be undone.`)) return
    setDeleting(true)
    const { error } = await supabase.from('exercises').delete().eq('id', exercise.id)
    if (error) {
      alert('Failed to delete exercise.')
      setDeleting(false)
    } else {
      navigate('/therapist/exercises')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TherapistNav />
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TherapistNav />
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/therapist/exercises" className="mt-2 inline-block text-sm text-brand-primary hover:underline">
            Back to library
          </Link>
        </div>
      </div>
    )
  }

  const isOwn = exercise.is_custom && exercise.created_by === profile?.id

  return (
    <div className="min-h-screen bg-gray-50">
      <TherapistNav />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link to="/therapist/exercises" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to library
        </Link>

        <div className="mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{exercise.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600">
                  {exercise.category}
                </span>
                {exercise.is_custom && (
                  <span className="rounded-full bg-brand-primary-light px-3 py-0.5 text-xs text-brand-primary-dark">
                    Custom
                  </span>
                )}
              </div>
            </div>
            {isOwn && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>

          <div className="mt-6">
            <VideoPlayer url={exercise.video_url} />
          </div>

          {(exercise.default_sets || exercise.default_reps) && (
            <p className="mt-4 text-sm text-gray-600">
              <span className="font-medium">{exercise.default_sets} sets</span>
              {' × '}
              <span className="font-medium">{exercise.default_reps} reps</span>
            </p>
          )}

          {exercise.description && (
            <p className="mt-4 text-sm text-gray-700 leading-relaxed">{exercise.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
