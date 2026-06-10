import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import useIsMobile from '../../hooks/useIsMobile'
import VideoPlayer from '../../components/VideoPlayer'

const CATEGORIES = ['Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle', 'Core', 'General']

function extractYouTubeId(url) {
  try {
    if (url.includes('youtube.com/watch')) {
      return new URL(url).searchParams.get('v') || null
    }
    if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1]?.split('?')[0] || null
    }
    if (url.includes('youtube.com/shorts/')) {
      return url.split('youtube.com/shorts/')[1]?.split('?')[0] || null
    }
    return null
  } catch {
    return null
  }
}

function isValidYouTubeUrl(url) {
  return Boolean(extractYouTubeId(url))
}

export default function ExerciseUpload() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState([])
  const [defaultSets, setDefaultSets] = useState('')
  const [defaultReps, setDefaultReps] = useState('')
  const [isTimed, setIsTimed] = useState(false)
  const [isBilateral, setIsBilateral] = useState(false)
  const [videoFile, setVideoFile] = useState(null)
  const [videoTab, setVideoTab] = useState('file')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [uploadedId, setUploadedId] = useState(null)

  function toggleCategory(cat) {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setUploadProgress(0)

    if (!name.trim()) { setError('Name is required.'); return }
    if (categories.length === 0) { setError('Select at least one category.'); return }

    setUploading(true)

    let publicUrl = null

    if (videoTab === 'youtube') {
      if (youtubeUrl) {
        if (!isValidYouTubeUrl(youtubeUrl)) {
          setError('Please enter a valid YouTube URL.')
          setUploading(false)
          return
        }
        publicUrl = youtubeUrl
      }
    } else if (videoFile) {
      const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
      if (!allowedMimeTypes.includes(videoFile.type)) {
        setError('Invalid file type. Please upload an MP4, WebM, or MOV video.')
        setUploading(false)
        return
      }
      if (videoFile.size > 200 * 1024 * 1024) {
        setError('Video must be under 200 MB.')
        setUploading(false)
        return
      }
      const ext = videoFile.name.split('.').pop()
      const filename = `${Date.now()}.${ext}`
      const path = `therapist-videos/${profile.id}/${filename}`

      const { error: uploadError } = await supabase.storage
        .from('exercise-videos')
        .upload(path, videoFile, {
          onUploadProgress: (event) => {
            setUploadProgress(Math.round((event.loaded / event.total) * 100))
          },
        })

      if (uploadError) {
        setError('Video upload failed: ' + uploadError.message)
        setUploading(false)
        return
      }

      const { data: { publicUrl: url } } = supabase.storage
        .from('exercise-videos')
        .getPublicUrl(path)

      publicUrl = url
    }

    const { data, error: insertError } = await supabase
      .from('exercises')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        category: categories[0],
        categories,
        video_url: publicUrl,
        is_custom: true,
        created_by: profile.id,
        default_sets: defaultSets ? parseInt(defaultSets) : null,
        default_reps: defaultReps ? parseInt(defaultReps) : null,
        is_timed: isTimed,
        is_bilateral: isBilateral,
      })
      .select('id')
      .single()

    if (insertError) {
      setError('Failed to save exercise: ' + insertError.message)
      setUploading(false)
      return
    }

    setUploading(false)
    setUploadedId(data.id)
  }

  function resetForm() {
    setName('')
    setDescription('')
    setCategories([])
    setDefaultSets('')
    setDefaultReps('')
    setIsTimed(false)
    setIsBilateral(false)
    setVideoFile(null)
    setVideoTab('file')
    setYoutubeUrl('')
    setError(null)
    setUploadedId(null)
    setUploadProgress(0)
  }

  if (uploadedId) {
    return (
      <SidebarLayout>
        <PageHero
          title="Exercise Saved"
          back={{ label: 'Exercise Library', to: '/therapist/exercises' }}
        />
        <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '600px' }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{ ...CARD }}
          >
            <ShimmerLine />
            <p style={{ fontSize: '14px', color: 'var(--color-text)', marginBottom: '6px', fontWeight: 500 }}>Exercise added successfully.</p>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px' }}>Your custom exercise has been saved to the library.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                to={`/therapist/exercises/${uploadedId}`}
                style={{ padding: '8px 16px', background: '#29B5CC', color: '#000', borderRadius: '7px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
              >
                View exercise
              </Link>
              <button
                onClick={resetForm}
                style={{ padding: '8px 16px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', fontSize: '13px', color: 'var(--color-muted)', cursor: 'pointer' }}
              >
                Add another
              </button>
            </div>
          </motion.div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <PageHero
        title="New Exercise"
        back={{ label: 'Exercise Library', to: '/therapist/exercises' }}
        actions={
          <button
            type="submit"
            form="exercise-upload-form"
            disabled={uploading}
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: uploading ? 'default' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? (videoTab === 'file' ? `Saving… ${uploadProgress}%` : 'Saving…') : 'Save Exercise'}
          </button>
        }
      />

      <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '600px' }}>
        <div style={{ ...CARD }}>
          <ShimmerLine />
          <form id="exercise-upload-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Name */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Exercise name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Categories */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>Categories <span style={{ color: 'var(--color-subtle)' }}>(select all that apply)</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {CATEGORIES.map(c => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={categories.includes(c)}
                      onChange={() => toggleCategory(c)}
                      style={{ accentColor: '#29B5CC' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Description <span style={{ color: 'var(--color-subtle)' }}>(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Measurement type + bilateral */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                  Default measurement
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ value: false, label: 'Reps' }, { value: true, label: 'Seconds' }].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setIsTimed(opt.value)}
                      style={{
                        flex: 1, padding: '8px', fontSize: '12px', fontWeight: 500,
                        borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s',
                        border: isTimed === opt.value ? '1px solid #29B5CC' : '1px solid var(--color-border)',
                        background: isTimed === opt.value ? '#29B5CC' : 'var(--color-elevated)',
                        color: isTimed === opt.value ? '#000' : 'var(--color-muted)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isBilateral}
                  onChange={e => setIsBilateral(e.target.checked)}
                  style={{ accentColor: '#29B5CC' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>Bilateral by default (complete on both sides)</span>
              </label>
            </div>

            {/* Sets / Reps */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>Default sets</label>
                <input
                  type="number"
                  min="1"
                  value={defaultSets}
                  onChange={e => setDefaultSets(e.target.value)}
                  style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>
                  {isTimed ? 'Default seconds' : 'Default reps'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={defaultReps}
                  onChange={e => setDefaultReps(e.target.value)}
                  style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Video */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>
                Video <span style={{ color: 'var(--color-subtle)' }}>(optional)</span>
              </label>

              {/* Tab switcher */}
              <div style={{ display: 'flex', marginBottom: '10px', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                {[{ value: 'file', label: 'Upload file' }, { value: 'youtube', label: 'YouTube link' }].map(tab => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setVideoTab(tab.value)
                      if (tab.value === 'file') setYoutubeUrl('')
                      if (tab.value === 'youtube') setVideoFile(null)
                    }}
                    style={{
                      flex: 1, padding: '7px 12px', fontSize: '12px', fontWeight: 500,
                      cursor: 'pointer', border: 'none',
                      background: videoTab === tab.value ? '#29B5CC' : 'var(--color-elevated)',
                      color: videoTab === tab.value ? '#000' : 'var(--color-muted)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {videoTab === 'file' ? (
                <>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={e => setVideoFile(e.target.files[0] ?? null)}
                    style={{ fontSize: '13px', color: 'var(--color-muted)', width: '100%' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '4px' }}>MP4, MOV, or WebM recommended</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {youtubeUrl && !isValidYouTubeUrl(youtubeUrl) && (
                    <p style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '4px' }}>Please enter a valid YouTube URL</p>
                  )}
                  {isValidYouTubeUrl(youtubeUrl) && (
                    <div style={{ marginTop: '10px', borderRadius: '7px', overflow: 'hidden' }}>
                      <VideoPlayer url={youtubeUrl} />
                    </div>
                  )}
                </>
              )}
            </div>

            {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)' }}>{error}</p>}

            {uploading && videoTab === 'file' && (
              <div style={{ height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#29B5CC', width: `${uploadProgress}%`, transition: 'width 0.2s ease', borderRadius: '2px' }} />
              </div>
            )}

          </form>
        </div>
      </div>
    </SidebarLayout>
  )
}
