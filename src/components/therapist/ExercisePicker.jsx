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

  const inputClass = 'block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none'

  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-border">
        <p className="text-sm font-semibold text-dark-text">Add exercise</p>
      </div>

      {pickerView !== 'configure' && (
        <div className="px-4 pt-3 pb-2 border-b border-dark-border">
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              if (pickerView === 'category') setPickerView('browse')
            }}
            placeholder="Search exercises…"
            disabled={disabled}
            className={inputClass}
          />
        </div>
      )}

      {pickerView === 'browse' && (
        <>
          {debouncedSearch.trim().length >= 2 ? (
            <div>
              {searching && <p className="px-4 py-3 text-sm text-dark-subtle">Searching…</p>}
              {!searching && searchResults.length === 0 && (
                <p className="px-4 py-3 text-sm text-dark-subtle">No results for "{debouncedSearch}".</p>
              )}
              {!searching && searchResults.length > 0 && (
                <div className="divide-y divide-dark-border">
                  {searchResults.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => selectExercise(ex)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-dark-text">{ex.name}</span>
                        {ex.video_url && (
                          <span className="text-xs text-dark-subtle mt-0.5">Video attached</span>
                        )}
                      </div>
                      <span className="text-xs text-dark-subtle ml-3 shrink-0">{ex.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-dark-border">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated transition-colors cursor-pointer"
                >
                  <span className={`text-sm ${cat === 'Custom' ? 'font-medium text-dark-text' : 'text-dark-muted'}`}>
                    {cat}
                  </span>
                  <span className="text-dark-subtle">›</span>
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
            className="flex w-full items-center gap-1 px-4 py-3 text-sm text-dark-muted hover:text-dark-text border-b border-dark-border text-left cursor-pointer transition-colors"
          >
            ‹ Back to categories
          </button>
          {categoryLoading && <p className="px-4 py-3 text-sm text-dark-subtle">Loading…</p>}
          {!categoryLoading && categoryExercises.length === 0 && (
            <p className="px-4 py-3 text-sm text-dark-subtle">No exercises in this category.</p>
          )}
          {!categoryLoading && categoryExercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => selectExercise(ex)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-dark-elevated border-b border-dark-border last:border-0 transition-colors cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="text-sm text-dark-text">{ex.name}</span>
                {ex.video_url && (
                  <span className="text-xs text-dark-subtle mt-0.5">Video attached</span>
                )}
              </div>
              <span className="text-xs text-dark-subtle ml-3 shrink-0">
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
            className="flex w-full items-center gap-1 px-4 py-3 text-sm text-dark-muted hover:text-dark-text border-b border-dark-border text-left cursor-pointer transition-colors"
          >
            ‹ Back
          </button>
          <div className="px-4 py-3 bg-dark-elevated border-b border-dark-border">
            <p className="text-sm font-medium text-dark-text">{pickerExercise.name}</p>
            <p className="text-xs text-dark-subtle mt-0.5">{pickerExercise.category}</p>
            {pickerExercise.video_url && (
              <p className="text-xs text-dark-subtle mt-0.5">Video attached</p>
            )}
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-dark-muted">Sets</label>
                <input
                  type="number" min="1" value={configSets}
                  onChange={e => setConfigSets(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-muted">Reps</label>
                <input
                  type="number" min="1" value={configReps}
                  onChange={e => setConfigReps(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark-muted">Weight ({weightUnit})</label>
                <input
                  type="number" min="0" step="0.5" value={configWeight}
                  onChange={e => setConfigWeight(e.target.value)}
                  placeholder="optional"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark-muted">
                Notes for client <span className="font-normal text-dark-subtle">(optional)</span>
              </label>
              <input
                type="text" value={configNotes}
                onChange={e => setConfigNotes(e.target.value)}
                placeholder="e.g. keep back straight, stop if painful"
                className={`mt-1 ${inputClass}`}
              />
            </div>
            {addError && <p className="text-sm text-red-400">{addError}</p>}
            <button
              onClick={handleConfirmAdd}
              disabled={adding || disabled || !configSets || !configReps}
              className="w-full rounded bg-brand-primary py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
            >
              {adding ? 'Adding…' : confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
