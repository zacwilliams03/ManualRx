import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import TherapistNav from '../../components/therapist/TherapistNav'
import { useWeightUnit } from '../../hooks/useWeightUnit'
import { toCanonical, formatWeight } from '../../utils/weightUtils'

const CATEGORIES = [
  'Custom',
  'Cervical',
  'Thoracic',
  'Lumbar',
  'Shoulder',
  'Hip',
  'Knee',
  'Ankle / Foot',
  'General',
]

export default function SessionEdit() {
  const { clientId, sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const weightUnit = useWeightUnit()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exercises, setExercises] = useState([])

  const [name, setName] = useState('')
  const [frequencyDays, setFrequencyDays] = useState(null)
  const [customDays, setCustomDays] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  // Picker view: 'browse' | 'category' | 'configure'
  const [pickerView, setPickerView] = useState('browse')

  // Search
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Category drill-down
  const [pickerCategory, setPickerCategory] = useState(null)
  const [categoryExercises, setCategoryExercises] = useState([])
  const [categoryLoading, setCategoryLoading] = useState(false)

  // Configure
  const [pickerExercise, setPickerExercise] = useState(null)
  const [configSets, setConfigSets] = useState('')
  const [configReps, setConfigReps] = useState('')
  const [configWeight, setConfigWeight] = useState('')
  const [configNotes, setConfigNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [sessionId, profile?.id])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) runSearch()
    else setSearchResults([])
  }, [debouncedSearch])

  async function fetchData() {
    setLoading(true)
    const [sessionRes, exercisesRes] = await Promise.all([
      supabase.from('prescriptions').select('id, name, frequency_days').eq('id', sessionId).single(),
      supabase
        .from('prescription_exercises')
        .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category)')
        .eq('prescription_id', sessionId),
    ])

    if (sessionRes.error) { setError('Session not found.'); setLoading(false); return }

    setName(sessionRes.data.name)
    const fd = sessionRes.data.frequency_days
    if (!fd) setFrequencyDays(null)
    else if (fd === 1) setFrequencyDays(1)
    else if (fd === 7) setFrequencyDays(7)
    else { setFrequencyDays('custom'); setCustomDays(String(fd)) }

    if (exercisesRes.error) {
      setError('Failed to load exercises: ' + exercisesRes.error.message)
    } else {
      setExercises(exercisesRes.data ?? [])
    }
    setLoading(false)
  }

  async function saveMeta() {
    setSavingMeta(true)
    let fd = frequencyDays
    if (frequencyDays === 'custom') fd = parseInt(customDays) || null
    await supabase.from('prescriptions').update({ name, frequency_days: fd }).eq('id', sessionId)
    setSavingMeta(false)
    navigate(`/therapist/prescribe/${clientId}`)
  }

  async function runSearch() {
    setSearching(true)
    const { data } = await supabase
      .from('exercises')
      .select('id, name, category, default_sets, default_reps')
      .textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
      .limit(10)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function selectCategory(cat) {
    setCategoryLoading(true)
    setPickerCategory(cat)
    setPickerView('category')
    let query = supabase.from('exercises').select('id, name, category, default_sets, default_reps')
    if (cat === 'Custom') query = query.eq('is_custom', true)
    else query = query.eq('category', cat)
    const { data } = await query.order('name', { ascending: true })
    setCategoryExercises(data ?? [])
    setCategoryLoading(false)
  }

  function selectExercise(ex) {
    setPickerExercise(ex)
    setConfigSets(String(ex.default_sets ?? 3))
    setConfigReps(String(ex.default_reps ?? 10))
    setConfigWeight('')
    setConfigNotes('')
    setAddError(null)
    setPickerView('configure')
  }

  async function confirmAdd() {
    setAdding(true)
    setAddError(null)
    const { data, error: insertError } = await supabase
      .from('prescription_exercises')
      .insert({
        prescription_id: sessionId,
        exercise_id: pickerExercise.id,
        sets: parseInt(configSets) || null,
        reps: parseInt(configReps) || null,
        weight: configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null,
        therapist_notes: configNotes.trim() || null,
      })
      .select('id, sets, reps, weight, therapist_notes, exercises(id, name, category)')
      .single()

    if (insertError) {
      setAddError('Failed to add: ' + insertError.message)
      setAdding(false)
      return
    }

    setExercises(prev => [...prev, data])
    setPickerView('browse')
    setPickerExercise(null)
    setSearch('')
    setAdding(false)
  }

  async function removeExercise(peId) {
    await supabase.from('prescription_exercises').delete().eq('id', peId)
    setExercises(prev => prev.filter(e => e.id !== peId))
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
          <Link to={`/therapist/prescribe/${clientId}`} className="mt-2 inline-block text-sm text-brand-primary hover:underline">
            Back
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TherapistNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to={`/therapist/prescribe/${clientId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to sessions
        </Link>

        {/* Session details */}
        <div className="mt-4 max-w-lg bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Session details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Repeat frequency</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'No repeat', value: null },
                  { label: 'Daily', value: 1 },
                  { label: 'Weekly', value: 7 },
                  { label: 'Custom', value: 'custom' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setFrequencyDays(opt.value)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      frequencyDays === opt.value
                        ? 'bg-brand-primary text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {frequencyDays === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min="1" value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-20 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              )}
            </div>
            <button
              onClick={saveMeta}
              disabled={savingMeta}
              className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
            >
              {savingMeta ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="mt-6 max-w-lg space-y-4">
          {/* Exercise list — always visible */}
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
                {exercises.map(pe => (
                  <div key={pe.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pe.exercises.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {pe.sets} sets × {pe.reps} reps
                        {pe.weight ? ` · ${formatWeight(pe.weight, weightUnit)}` : ''}
                      </p>
                      {pe.therapist_notes && (
                        <p className="mt-0.5 text-xs text-gray-400 italic">{pe.therapist_notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeExercise(pe.id)}
                      className="shrink-0 text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add exercise picker */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Add exercise</p>
            </div>

            {/* Search — hidden only in configure view */}
            {pickerView !== 'configure' && (
              <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    if (pickerView === 'category') setPickerView('browse')
                  }}
                  placeholder="Search exercises…"
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                />
              </div>
            )}

            {/* Browse: category list or search results */}
            {pickerView === 'browse' && (
              <>
                {debouncedSearch.trim().length >= 2 ? (
                  <div>
                    {searching && <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>}
                    {!searching && searchResults.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400">No results for "{debouncedSearch}".</p>
                    )}
                    {!searching && searchResults.length > 0 && (
                      <div className="divide-y divide-gray-100">
                        {searchResults.map(ex => (
                          <button
                            key={ex.id}
                            onClick={() => selectExercise(ex)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                          >
                            <span className="text-sm text-gray-900">{ex.name}</span>
                            <span className="text-xs text-gray-400 ml-3 shrink-0">{ex.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => selectCategory(cat)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <span className={`text-sm ${cat === 'Custom' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                          {cat}
                        </span>
                        <span className="text-gray-400">›</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Exercises within a category */}
            {pickerView === 'category' && (
              <div>
                <button
                  onClick={() => setPickerView('browse')}
                  className="flex w-full items-center gap-1 px-4 py-3 text-sm text-gray-500 hover:text-gray-800 border-b border-gray-100 text-left"
                >
                  ‹ Back to categories
                </button>
                {categoryLoading && <p className="px-4 py-3 text-sm text-gray-400">Loading…</p>}
                {!categoryLoading && categoryExercises.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-400">No exercises in this category.</p>
                )}
                {!categoryLoading && categoryExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => selectExercise(ex)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-gray-900">{ex.name}</span>
                    <span className="text-xs text-gray-400 ml-3 shrink-0">
                      {ex.default_sets ?? 3} × {ex.default_reps ?? 10}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Configure selected exercise */}
            {pickerView === 'configure' && pickerExercise && (
              <div>
                <button
                  onClick={() => setPickerView('browse')}
                  className="flex w-full items-center gap-1 px-4 py-3 text-sm text-gray-500 hover:text-gray-800 border-b border-gray-100 text-left"
                >
                  ‹ Back
                </button>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{pickerExercise.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pickerExercise.category}</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Sets</label>
                      <input
                        type="number" min="1" value={configSets}
                        onChange={e => setConfigSets(e.target.value)}
                        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Reps</label>
                      <input
                        type="number" min="1" value={configReps}
                        onChange={e => setConfigReps(e.target.value)}
                        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Weight ({weightUnit})</label>
                      <input
                        type="number" min="0" step="0.5" value={configWeight}
                        onChange={e => setConfigWeight(e.target.value)}
                        placeholder="optional"
                        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Notes for client <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text" value={configNotes}
                      onChange={e => setConfigNotes(e.target.value)}
                      placeholder="e.g. keep back straight, stop if painful"
                      className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                    />
                  </div>
                  {addError && <p className="text-sm text-red-600">{addError}</p>}
                  <button
                    onClick={confirmAdd}
                    disabled={adding || !configSets || !configReps}
                    className="w-full rounded bg-brand-primary py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
                  >
                    {adding ? 'Adding…' : 'Add to session'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
