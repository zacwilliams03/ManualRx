import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import ExercisePicker from '../../components/therapist/ExercisePicker'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { formatWeight } from '../../utils/weightUtils'
import { motion } from 'framer-motion'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
import VideoPlayer from '../../components/VideoPlayer'

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

  return (
    <SidebarLayout>
      <PageHero
        title={name || 'Edit Template'}
        back={{ label: 'Templates', to: '/therapist/templates' }}
        actions={
          <button
            onClick={saveMeta}
            disabled={saving || !name.trim()}
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: (saving || !name.trim()) ? 'default' : 'pointer',
              opacity: (saving || !name.trim()) ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />

      <div style={{ padding: '24px 32px', maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Template details glass card */}
        <div style={{ ...CARD }}>
          <div style={SHIMMER} />
          <div style={{ marginBottom: '16px' }}>
            <span style={SECTION_LABEL}>Template Details</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                Name <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Category */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                Category <span style={{ color: '#555' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Rotator Cuff"
                list="template-categories"
                style={{ width: '100%', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
              <datalist id="template-categories">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Duration pills — keep Tailwind classes for pills */}
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '8px' }}>
                Duration <span style={{ color: '#555' }}>(optional default)</span>
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
          </div>
        </div>

        {/* Exercise list glass card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          style={{ ...CARD, padding: 0 }}
        >
          <div style={SHIMMER} />
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={SECTION_LABEL}>Exercises {exercises.length > 0 ? `(${exercises.length})` : ''}</span>
          </div>
          {exercises.length === 0 ? (
            <p style={{ padding: '16px 20px', fontSize: '13px', color: '#666' }}>No exercises added yet.</p>
          ) : (
            exercises.map((te, i) => (
              <div
                key={te.id}
                style={{ padding: '12px 20px', borderBottom: i < exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e8edf5' }}>{te.exercises?.name}</div>
                    <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                      {te.sets} sets × {te.reps} reps{te.weight ? ` · ${formatWeight(te.weight, weightUnit)}` : ''}
                    </div>
                    {te.therapist_notes && (
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', fontStyle: 'italic' }}>{te.therapist_notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeExercise(te.id)}
                    style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
                {te.exercises?.video_url && <VideoPlayer url={te.exercises.video_url} className="w-full rounded mt-2" />}
              </div>
            ))
          )}
        </motion.div>

        {/* ExercisePicker — unchanged */}
        <ExercisePicker onAdd={handleAddExercise} weightUnit={weightUnit} confirmLabel="Add to template" />
      </div>
    </SidebarLayout>
  )
}
