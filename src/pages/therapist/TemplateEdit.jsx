import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import TherapistNav from '../../components/therapist/TherapistNav'
import ExercisePicker from '../../components/therapist/ExercisePicker'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'

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
      <iframe src={embedUrl} className="w-full rounded mt-2" style={{ aspectRatio: '16/9' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen title="Exercise video" />
    )
  }
  return <video src={url} controls className="w-full rounded mt-2" style={{ aspectRatio: '16/9' }} />
}

export default function TemplateEdit() {
  const { templateId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const weightUnit = useWeightUnit()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exercises, setExercises] = useState([])

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingCategories, setExistingCategories] = useState([])

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [templateId, profile?.id])

  async function fetchData() {
    setLoading(true)
    const [templateRes, exercisesRes, allTemplatesRes] = await Promise.all([
      supabase.from('templates').select('id, name, category').eq('id', templateId).single(),
      supabase
        .from('template_exercises')
        .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
        .eq('template_id', templateId)
        .order('created_at', { ascending: true }),
      supabase
        .from('templates')
        .select('category')
        .eq('therapist_id', profile.id)
        .not('category', 'is', null),
    ])

    if (templateRes.error) { setError('Template not found.'); setLoading(false); return }
    setName(templateRes.data.name)
    setCategory(templateRes.data.category ?? '')

    if (exercisesRes.error) {
      setError('Failed to load exercises: ' + exercisesRes.error.message)
    } else {
      setExercises(exercisesRes.data ?? [])
    }

    const cats = [...new Set((allTemplatesRes.data ?? []).map(t => t.category).filter(Boolean))].sort()
    setExistingCategories(cats)

    setLoading(false)
  }

  async function saveMeta() {
    setSaving(true)
    await supabase
      .from('templates')
      .update({ name, category: category.trim() || null })
      .eq('id', templateId)
    setSaving(false)
    navigate('/therapist/templates')
  }

  async function handleAddExercise({ exerciseId, sets, reps, weight, notes }) {
    const { data, error: insertError } = await supabase
      .from('template_exercises')
      .insert({
        template_id: templateId,
        exercise_id: exerciseId,
        sets,
        reps,
        weight,
        therapist_notes: notes,
      })
      .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category, video_url)')
      .single()
    if (insertError) throw new Error(insertError.message)
    setExercises(prev => [...prev, data])
  }

  async function removeExercise(teId) {
    await supabase.from('template_exercises').delete().eq('id', teId)
    setExercises(prev => prev.filter(e => e.id !== teId))
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
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/therapist/templates" className="mt-2 inline-block text-sm text-brand-primary hover:underline">
            Back to templates
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TherapistNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/therapist/templates" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to templates
        </Link>

        {/* Template details */}
        <div className="mt-4 max-w-lg bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Template details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category <span className="font-normal text-gray-400">(optional — e.g. Rotator Cuff, Lumbar Rehab)</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Rotator Cuff"
                list="template-categories"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
              <datalist id="template-categories">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <button
              onClick={saveMeta}
              disabled={saving || !name.trim()}
              className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>

        <div className="mt-6 max-w-lg space-y-4">
          {/* Exercise list */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                Exercises
                {exercises.length > 0 && (
                  <span className="ml-1 font-normal text-gray-400">({exercises.length})</span>
                )}
              </h2>
            </div>
            {exercises.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">No exercises added yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {exercises.map(te => (
                  <div key={te.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{te.exercises?.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {te.sets} sets × {te.reps} reps
                          {te.weight ? ` · ${formatWeight(te.weight, weightUnit)}` : ''}
                        </p>
                        {te.therapist_notes && (
                          <p className="mt-0.5 text-xs text-gray-400 italic">{te.therapist_notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeExercise(te.id)}
                        className="shrink-0 text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    {te.exercises?.video_url && (
                      <VideoPlayer url={te.exercises.video_url} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ExercisePicker
            onAdd={handleAddExercise}
            weightUnit={weightUnit}
            confirmLabel="Add to template"
          />
        </div>
      </div>
    </div>
  )
}
