import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER } from '../../components/therapist/styles'
import useIsMobile from '../../hooks/useIsMobile'

const CATEGORIES = ['Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General']

export default function ExerciseUpload() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState([])
  const [defaultSets, setDefaultSets] = useState('')
  const [defaultReps, setDefaultReps] = useState('')
  const [videoFile, setVideoFile] = useState(null)
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

    if (!name.trim()) { setError('Name is required.'); return }
    if (categories.length === 0) { setError('Select at least one category.'); return }

    setUploading(true)

    let publicUrl = null

    if (videoFile) {
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
    setVideoFile(null)
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
            <div style={SHIMMER} />
            <p style={{ fontSize: '14px', color: '#e8edf5', marginBottom: '6px', fontWeight: 500 }}>Exercise added successfully.</p>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Your custom exercise has been saved to the library.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                to={`/therapist/exercises/${uploadedId}`}
                style={{ padding: '8px 16px', background: '#29B5CC', color: '#000', borderRadius: '7px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
              >
                View exercise
              </Link>
              <button
                onClick={resetForm}
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', fontSize: '13px', color: '#888', cursor: 'pointer' }}
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
            {uploading ? `Saving… ${uploadProgress}%` : 'Save Exercise'}
          </button>
        }
      />

      <div style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '600px' }}>
        <div style={{ ...CARD }}>
          <div style={SHIMMER} />
          <form id="exercise-upload-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Name */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Exercise name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Categories */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '8px' }}>Categories <span style={{ color: '#555' }}>(select all that apply)</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {CATEGORIES.map(c => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={categories.includes(c)}
                      onChange={() => toggleCategory(c)}
                      style={{ accentColor: '#29B5CC' }}
                    />
                    <span style={{ fontSize: '13px', color: '#e8edf5' }}>{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Description <span style={{ color: '#555' }}>(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Sets / Reps */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Default sets</label>
                <input
                  type="number"
                  min="1"
                  value={defaultSets}
                  onChange={e => setDefaultSets(e.target.value)}
                  style={{ width: '100%', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Default reps</label>
                <input
                  type="number"
                  min="1"
                  value={defaultReps}
                  onChange={e => setDefaultReps(e.target.value)}
                  style={{ width: '100%', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Video */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Video file</label>
              <input
                type="file"
                accept="video/*"
                onChange={e => setVideoFile(e.target.files[0] ?? null)}
                style={{ fontSize: '13px', color: '#888', width: '100%' }}
              />
              <p style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>MP4, MOV, or WebM recommended</p>
            </div>

            {error && <p style={{ fontSize: '13px', color: '#f87171' }}>{error}</p>}

            {uploading && (
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#29B5CC', width: `${uploadProgress}%`, transition: 'width 0.2s ease', borderRadius: '2px' }} />
              </div>
            )}

          </form>
        </div>
      </div>
    </SidebarLayout>
  )
}
