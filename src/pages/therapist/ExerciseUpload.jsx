import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'

const CATEGORIES = ['Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Hip', 'Knee', 'Ankle / Foot', 'General']

export default function ExerciseUpload() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [defaultSets, setDefaultSets] = useState('')
  const [defaultReps, setDefaultReps] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [uploadedId, setUploadedId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Name is required.'); return }
    if (!category) { setError('Category is required.'); return }
    if (!videoFile) { setError('A video file is required.'); return }

    setUploading(true)

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

    const { data: { publicUrl } } = supabase.storage
      .from('exercise-videos')
      .getPublicUrl(path)

    const { data, error: insertError } = await supabase
      .from('exercises')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        category,
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
    setCategory('')
    setDefaultSets('')
    setDefaultReps('')
    setVideoFile(null)
    setError(null)
    setUploadedId(null)
    setUploadProgress(0)
  }

  const inputClass = 'mt-1 block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none'

  if (uploadedId) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <div className="max-w-md w-full bg-dark-surface rounded-lg border border-dark-border p-8 text-center">
            <h2 className="text-xl font-semibold text-dark-text">Exercise added</h2>
            <p className="mt-2 text-sm text-dark-muted">Your custom exercise has been saved to the library.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to={`/therapist/exercises/${uploadedId}`}
                className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark"
              >
                View exercise
              </Link>
              <button
                onClick={resetForm}
                className="rounded border border-dark-border px-4 py-2 text-sm text-dark-muted hover:bg-dark-elevated hover:text-dark-text cursor-pointer transition-colors duration-150"
              >
                Add another
              </button>
            </div>
          </div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link to="/therapist/exercises" className="text-sm text-dark-muted hover:text-dark-text">
          ← Back to library
        </Link>

        <div className="mt-4 max-w-lg bg-dark-surface rounded-lg border border-dark-border p-6">
          <h1 className="text-xl font-semibold text-dark-text">Add custom exercise</h1>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-text">Exercise name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text">
                Description{' '}
                <span className="font-normal text-dark-subtle">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-dark-text">Default sets</label>
                <input
                  type="number"
                  min="1"
                  value={defaultSets}
                  onChange={e => setDefaultSets(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-dark-text">Default reps</label>
                <input
                  type="number"
                  min="1"
                  value={defaultReps}
                  onChange={e => setDefaultReps(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text">Video file</label>
              <input
                type="file"
                accept="video/*"
                onChange={e => setVideoFile(e.target.files[0] ?? null)}
                className="mt-1 block w-full text-sm text-dark-muted file:mr-3 file:rounded file:border-0 file:bg-dark-elevated file:px-3 file:py-1 file:text-sm file:font-medium file:text-dark-text cursor-pointer"
              />
              <p className="mt-1 text-xs text-dark-subtle">MP4, MOV, or WebM recommended</p>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={uploading}
              className="w-full rounded bg-brand-primary py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
            >
              {uploading ? `Uploading… ${uploadProgress}%` : 'Save exercise'}
            </button>

            {uploading && (
              <div>
                <div className="w-full rounded-full bg-dark-elevated h-2">
                  <div
                    className="h-2 rounded-full bg-brand-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </SidebarLayout>
  )
}
