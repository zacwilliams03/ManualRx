import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { fromCanonical, toCanonical } from '../../utils/weightUtils'

// Props:
// - therapistId: string (auth.uid())
// - clientId: string (clients.id)
// - defaultFrequencyDays: number|null
// - onClose: () => void
// - onApplied: () => void — called after successful apply; parent calls fetchData() to refresh sessions list
export default function ApplyTemplateModal({ therapistId, clientId, defaultFrequencyDays, onClose, onApplied }) {
  const weightUnit = useWeightUnit()

  // step: 'pick' | 'options' | 'customise'
  const [step, setStep] = useState('pick')
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState(null)

  // customise state: array of { id, exerciseId, name, sets, reps, weight (display unit string), notes }
  const [customExercises, setCustomExercises] = useState([])

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    setLoadingTemplates(true)
    const { data } = await supabase
      .from('templates')
      .select(`
        id, name, category,
        template_exercises(id, exercise_id, sets, reps, weight, therapist_notes, exercises(name))
      `)
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
    setLoadingTemplates(false)
  }

  function selectTemplate(template) {
    setSelectedTemplate(template)
    setStep('options')
  }

  function startCustomise() {
    const initial = (selectedTemplate.template_exercises ?? []).map(te => ({
      id: te.id,
      exerciseId: te.exercise_id,
      name: te.exercises?.name ?? 'Exercise',
      sets: String(te.sets ?? ''),
      reps: String(te.reps ?? ''),
      weight: te.weight != null ? String(fromCanonical(te.weight, weightUnit)) : '',
      notes: te.therapist_notes ?? '',
    }))
    setCustomExercises(initial)
    setStep('customise')
  }

  async function createPrescription() {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        therapist_id: therapistId,
        client_id: clientId,
        name: selectedTemplate.name,
        frequency_days: defaultFrequencyDays,
      })
      .select('id, name, frequency_days, created_at')
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async function applyAsIs() {
    setApplying(true)
    setApplyError(null)
    try {
      const prescription = await createPrescription()
      const exerciseRows = (selectedTemplate.template_exercises ?? []).map(te => ({
        prescription_id: prescription.id,
        exercise_id: te.exercise_id,
        sets: te.sets,
        reps: te.reps,
        weight: te.weight,
        therapist_notes: te.therapist_notes,
      }))
      if (exerciseRows.length > 0) {
        const { error } = await supabase.from('prescription_exercises').insert(exerciseRows)
        if (error) throw new Error(error.message)
      }
      onApplied()
    } catch (e) {
      setApplyError(e.message || 'Failed to apply template.')
    } finally {
      setApplying(false)
    }
  }

  async function applyCustomised() {
    setApplying(true)
    setApplyError(null)
    try {
      const prescription = await createPrescription()
      const exerciseRows = customExercises.map(ex => ({
        prescription_id: prescription.id,
        exercise_id: ex.exerciseId,
        sets: parseInt(ex.sets) || null,
        reps: parseInt(ex.reps) || null,
        weight: ex.weight ? toCanonical(parseFloat(ex.weight), weightUnit) : null,
        therapist_notes: ex.notes.trim() || null,
      }))
      if (exerciseRows.length > 0) {
        const { error } = await supabase.from('prescription_exercises').insert(exerciseRows)
        if (error) throw new Error(error.message)
      }
      onApplied()
    } catch (e) {
      setApplyError(e.message || 'Failed to apply template.')
    } finally {
      setApplying(false)
    }
  }

  function updateCustomExercise(index, field, value) {
    setCustomExercises(prev =>
      prev.map((ex, i) => i === index ? { ...ex, [field]: value } : ex)
    )
  }

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))].sort()

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = search.trim() === '' ||
      t.name.toLowerCase().includes(search.trim().toLowerCase())
    const matchesCategory = selectedCategory === null || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            {step === 'customise' ? 'Customise Template' : 'Apply Template'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        {/* Step 1: Pick a template */}
        {step === 'pick' && (
          <div className="flex flex-col">
            {loadingTemplates && <p className="px-5 py-4 text-sm text-gray-500">Loading templates…</p>}

            {!loadingTemplates && templates.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-500">No templates yet. Create one from the Templates tab.</p>
            )}

            {!loadingTemplates && templates.length > 0 && (
              <>
                {/* Search bar */}
                <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search templates…"
                    className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>

                {/* Category filter pills — only shown if any templates have a category */}
                {categories.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-gray-100">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedCategory === null
                          ? 'bg-brand-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selectedCategory === cat
                            ? 'bg-brand-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Template list */}
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {filteredTemplates.length === 0 && (
                    <p className="px-5 py-4 text-sm text-gray-400">No templates match.</p>
                  )}
                  {filteredTemplates.map(t => {
                    const count = t.template_exercises?.length ?? 0
                    return (
                      <button
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {t.category ? `${t.category} · ` : ''}{count} exercise{count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="text-gray-400 ml-3">›</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Apply as-is or customise */}
        {step === 'options' && selectedTemplate && (
          <div className="px-5 py-4 space-y-4">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{selectedTemplate.name}</p>
              {selectedTemplate.category && (
                <p className="text-xs text-gray-500 mt-0.5">{selectedTemplate.category}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {(selectedTemplate.template_exercises ?? [])
                  .map(te => te.exercises?.name)
                  .filter(Boolean)
                  .join(' · ') || 'No exercises'}
              </p>
            </div>

            {applyError && <p className="text-sm text-red-600">{applyError}</p>}

            <div className="space-y-2">
              <button
                onClick={applyAsIs}
                disabled={applying}
                className="w-full rounded bg-brand-primary px-4 py-2.5 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
              >
                {applying ? 'Applying…' : 'Apply as-is'}
              </button>
              <button
                onClick={startCustomise}
                disabled={applying}
                className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Customise first
              </button>
              <button
                onClick={() => { setStep('pick'); setApplyError(null) }}
                disabled={applying}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Customise exercise values */}
        {step === 'customise' && (
          <div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {customExercises.map((ex, i) => (
                <div key={ex.id} className="px-5 py-3 space-y-2">
                  <p className="text-sm font-medium text-gray-900">{ex.name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Sets</label>
                      <input
                        type="number" min="1" value={ex.sets}
                        onChange={e => updateCustomExercise(i, 'sets', e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Reps</label>
                      <input
                        type="number" min="1" value={ex.reps}
                        onChange={e => updateCustomExercise(i, 'reps', e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Wt ({weightUnit})</label>
                      <input
                        type="number" min="0" step="0.5" value={ex.weight}
                        onChange={e => updateCustomExercise(i, 'weight', e.target.value)}
                        placeholder="opt."
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  <input
                    type="text" value={ex.notes}
                    onChange={e => updateCustomExercise(i, 'notes', e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 space-y-2">
              {applyError && <p className="text-sm text-red-600">{applyError}</p>}
              <button
                onClick={applyCustomised}
                disabled={applying}
                className="w-full rounded bg-brand-primary px-4 py-2.5 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
              >
                {applying ? 'Applying…' : 'Apply'}
              </button>
              <button
                onClick={() => { setStep('options'); setApplyError(null) }}
                disabled={applying}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
