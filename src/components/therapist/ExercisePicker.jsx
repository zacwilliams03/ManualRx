import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toCanonical } from '../../utils/weightUtils'

const CATEGORIES = [
  'Custom', 'Cervical', 'Thoracic', 'Lumbar',
  'Shoulder', 'Hip', 'Knee', 'Ankle / Foot', 'General',
]

// confirmLabel: text shown on the Add button — defaults to 'Add to session'; pass 'Add to template' in TemplateEdit
export default function ExercisePicker({ onAdd, weightUnit, disabled, confirmLabel = 'Add to session' }) {
  const [pickerView, setPickerView] = useState('browse')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [pickerCategory, setPickerCategory] = useState(null)
  const [categoryExercises, setCategoryExercises] = useState([])
  const [categoryLoading, setCategoryLoading] = useState(false)

  const [pickerExercise, setPickerExercise] = useState(null)
  const [configSets, setConfigSets] = useState('')
  const [configReps, setConfigReps] = useState('')
  const [configWeight, setConfigWeight] = useState('')
  const [configNotes, setConfigNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) runSearch()
    else setSearchResults([])
  }, [debouncedSearch])

  async function runSearch() {
    setSearching(true)
    const { data } = await supabase
      .from('exercises')
      .select('id, name, category, default_sets, default_reps, video_url')
      .textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
      .limit(10)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function selectCategory(cat) {
    setCategoryLoading(true)
    setPickerCategory(cat)
    setPickerView('category')
    let query = supabase.from('exercises').select('id, name, category, default_sets, default_reps, video_url')
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

  async function handleConfirmAdd() {
    setAdding(true)
    setAddError(null)
    try {
      await onAdd({
        exerciseId: pickerExercise.id,
        sets: parseInt(configSets) || null,
        reps: parseInt(configReps) || null,
        weight: configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null,
        notes: configNotes.trim() || null,
      })
      setPickerView('browse')
      setPickerExercise(null)
      setSearch('')
    } catch (e) {
      setAddError(e.message || 'Failed to add exercise')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">Add exercise</p>
      </div>

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
            disabled={disabled}
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      )}

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
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{ex.name}</span>
                        {ex.video_url && (
                          <span className="text-xs text-gray-400 mt-0.5">Video attached</span>
                        )}
                      </div>
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
              <div className="flex flex-col">
                <span className="text-sm text-gray-900">{ex.name}</span>
                {ex.video_url && (
                  <span className="text-xs text-gray-400 mt-0.5">Video attached</span>
                )}
              </div>
              <span className="text-xs text-gray-400 ml-3 shrink-0">
                {ex.default_sets ?? 3} × {ex.default_reps ?? 10}
              </span>
            </button>
          ))}
        </div>
      )}

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
            {pickerExercise.video_url && (
              <p className="text-xs text-gray-400 mt-0.5">Video attached</p>
            )}
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
              onClick={handleConfirmAdd}
              disabled={adding || disabled || !configSets || !configReps}
              className="w-full rounded bg-brand-primary py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
            >
              {adding ? 'Adding…' : confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
