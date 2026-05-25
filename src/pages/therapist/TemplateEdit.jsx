import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
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
  const [durationWeeks, setDurationWeeks] = useState(null)
  const [customWeeks, setCustomWeeks] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingCategories, setExistingCategories] = useState([])

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [templateId, profile?.id])

  async function fetchData() {
    setLoading(true)
    const [templateRes, exercisesRes, allTemplatesRes] = await Promise.all([
      supabase.from('templates').select('id, name, category, duration_weeks').eq('id', templateId).single(),
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
    const data = templateRes.data
    setName(data.name)
    setCategory(data.category ?? '')

    const dw = data.duration_weeks
    if (dw == null) {
      setDurationWeeks(null)
    } else if ([1, 2, 4, 6, 8, 12].includes(dw)) {
      setDurationWeeks(dw)
    } else {
      setDurationWeeks('custom')
      setCustomWeeks(String(dw))
    }

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
    const dw = durationWeeks === 'custom' ? parseInt(customWeeks) || null : durationWeeks
    await supabase
      .from('templates')
      .update({ name, category: category.trim() || null, duration_weeks: dw })
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
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-red-400">{error}</p>
          <Link to="/therapist/templates" className="mt-2 inline-block text-sm text-dark-accent hover:underline">
            Back to templates
          </Link>
        </div>
      </SidebarLayout>
    )
  }

  const inputClass = 'mt-1 block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none'

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/therapist/templates" className="text-sm text-dark-muted hover:text-dark-text">
          ← Back to templates
        </Link>

        {/* Template details */}
        <div className="mt-4 max-w-lg bg-dark-surface rounded-lg border border-dark-border p-5">
          <h2 className="text-sm font-medium text-dark-text mb-3">Template details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-text">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text">
                Category <span className="font-normal text-dark-subtle">(optional — e.g. Rotator Cuff, Lumbar Rehab)</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Rotator Cuff"
                list="template-categories"
                className={inputClass}
              />
              <datalist id="template-categories">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">
                Duration <span className="font-normal text-dark-subtle">(optional default — applied when template is used)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'None (ongoing)', value: null },
                  { label: '1 week', value: 1 },
                  { label: '2 weeks', value: 2 },
                  { label: '4 weeks', value: 4 },
                  { label: '6 weeks', value: 6 },
                  { label: '8 weeks', value: 8 },
                  { label: '12 weeks', value: 12 },
                  { label: 'Custom', value: 'custom' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setDurationWeeks(opt.value)}
                    className={`rounded-full px-3 py-1 text-sm cursor-pointer transition-colors duration-150 ${
                      durationWeeks === opt.value
                        ? 'bg-brand-primary text-white'
                        : 'bg-dark-elevated border border-dark-border text-dark-muted hover:text-dark-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {durationWeeks === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min="1" value={customWeeks}
                    onChange={e => setCustomWeeks(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-20 rounded border border-dark-border bg-dark-elevated px-3 py-1.5 text-sm text-dark-text focus:border-dark-accent focus:outline-none"
                  />
                  <span className="text-sm text-dark-muted">weeks</span>
                </div>
              )}
            </div>
            <button
              onClick={saveMeta}
              disabled={saving || !name.trim()}
              className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save Template & Exit'}
            </button>
          </div>
        </div>

        <div className="mt-6 max-w-lg space-y-4">
          {/* Exercise list */}
          <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-border">
              <h2 className="text-sm font-semibold text-dark-text">
                Exercises
                {exercises.length > 0 && (
                  <span className="ml-1 font-normal text-dark-subtle">({exercises.length})</span>
                )}
              </h2>
            </div>
            {exercises.length === 0 ? (
              <p className="px-4 py-4 text-sm text-dark-subtle">No exercises added yet.</p>
            ) : (
              <div className="divide-y divide-dark-border">
                {exercises.map(te => (
                  <div key={te.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-dark-text">{te.exercises?.name}</p>
                        <p className="mt-0.5 text-xs text-dark-muted">
                          {te.sets} sets × {te.reps} reps
                          {te.weight ? ` · ${formatWeight(te.weight, weightUnit)}` : ''}
                        </p>
                        {te.therapist_notes && (
                          <p className="mt-0.5 text-xs text-dark-subtle italic">{te.therapist_notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeExercise(te.id)}
                        className="shrink-0 text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors duration-150"
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
    </SidebarLayout>
  )
}
