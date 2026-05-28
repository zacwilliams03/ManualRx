import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'

function VideoPlayer({ url }) {
  if (!url) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded bg-dark-elevated">
        <p className="text-sm text-dark-subtle">No video available</p>
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
        .select('id, name, description, category, categories, video_url, thumbnail_url, is_custom, created_by, default_sets, default_reps')
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
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-dark-muted">Loading…</p>
        </div>
      </SidebarLayout>
    )
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-sm text-red-400">{error}</p>
          <Link to="/therapist/exercises" className="mt-2 inline-block text-sm text-dark-accent hover:underline">
            Back to library
          </Link>
        </div>
      </SidebarLayout>
    )
  }

  const isOwn = exercise.is_custom && exercise.created_by === profile?.id

  return (
    <SidebarLayout>
      <PageHero
        title={exercise.name}
        back={{ label: 'Exercise Library', to: '/therapist/exercises' }}
        actions={
          isOwn ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '9px 18px',
                background: 'transparent',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: deleting ? 'default' : 'pointer',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null
        }
      />

      <div style={{ padding: '24px 32px', maxWidth: '600px' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{ ...CARD }}
        >
          <div style={SHIMMER} />

          {/* Category badges */}
          {(exercise.categories?.length ? exercise.categories : [exercise.category]).filter(Boolean).length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {(exercise.categories?.length ? exercise.categories : [exercise.category]).filter(Boolean).map(cat => (
                <span key={cat} style={{ fontSize: '11px', padding: '3px 9px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>
                  {cat}
                </span>
              ))}
              {exercise.is_custom && (
                <span style={{ fontSize: '11px', padding: '3px 9px', background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                  Custom
                </span>
              )}
            </div>
          )}

          {/* Video player */}
          <div style={{ marginBottom: exercise.description || (exercise.default_sets || exercise.default_reps) ? '20px' : 0 }}>
            <VideoPlayer url={exercise.video_url} />
          </div>

          {/* Sets / reps */}
          {(exercise.default_sets || exercise.default_reps) && (
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, color: '#e8edf5' }}>{exercise.default_sets} sets</span>
              {' × '}
              <span style={{ fontWeight: 600, color: '#e8edf5' }}>{exercise.default_reps} reps</span>
            </p>
          )}

          {/* Description */}
          {exercise.description && (
            <p style={{ fontSize: '14px', color: '#aaa', lineHeight: 1.6 }}>{exercise.description}</p>
          )}
        </motion.div>
      </div>
    </SidebarLayout>
  )
}
