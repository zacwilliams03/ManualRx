import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toCanonical } from '../../utils/weightUtils'
import useIsMobile from '../../hooks/useIsMobile'

const CATEGORIES = [
  'Custom', 'Cervical', 'Thoracic', 'Lumbar',
  'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General',
]

const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '7px', color: '#e8edf5', padding: '9px 14px',
  fontSize: '13px', outline: 'none',
}

const rowStyle = {
  display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
  padding: '11px 20px', textAlign: 'left', background: 'none', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.15s',
}

// confirmLabel: text shown on the Add button — defaults to 'Add to session'; pass 'Add to template' in TemplateEdit
export default function ExercisePicker({ onAdd, weightUnit, disabled, confirmLabel = 'Add to session' }) {
  const isMobile = useIsMobile()
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
      .select('id, name, category, categories, default_sets, default_reps, video_url')
      .textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
      .limit(10)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function selectCategory(cat) {
    setCategoryLoading(true)
    setPickerCategory(cat)
    setPickerView('category')
    let query = supabase.from('exercises').select('id, name, category, categories, default_sets, default_reps, video_url')
    if (cat === 'Custom') query = query.eq('is_custom', true)
    else query = query.contains('categories', [cat])
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
    <div style={{
      background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(100,160,255,0.08)', borderRadius: '14px',
      overflow: 'hidden', position: 'relative',
      maxHeight: isMobile ? '85vh' : 'none',
      overflowY: isMobile ? 'auto' : 'visible',
    }}>
      {/* shimmer */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(41,181,204,0.25), rgba(77,142,247,0.25), transparent)', position: 'absolute', top: 0, left: 0, right: 0 }} />

      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888888', margin: 0 }}>Add exercise</p>
      </div>

      {pickerView !== 'configure' && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              if (pickerView === 'category') setPickerView('browse')
            }}
            placeholder="Search exercises…"
            disabled={disabled}
            style={inputStyle}
          />
        </div>
      )}

      {pickerView === 'browse' && (
        <>
          {debouncedSearch.trim().length >= 2 ? (
            <div>
              {searching && <p style={{ padding: '12px 20px', fontSize: '13px', color: '#555', margin: 0 }}>Searching…</p>}
              {!searching && searchResults.length === 0 && (
                <p style={{ padding: '12px 20px', fontSize: '13px', color: '#555', margin: 0 }}>No results for "{debouncedSearch}".</p>
              )}
              {!searching && searchResults.length > 0 && searchResults.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => selectExercise(ex)}
                  style={rowStyle}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', color: '#e8edf5' }}>{ex.name}</span>
                    {ex.video_url && <span style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>Video attached</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: '#555', marginLeft: '12px', flexShrink: 0 }}>{ex.category}</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  style={rowStyle}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: '13px', color: cat === 'Custom' ? '#e8edf5' : '#888' }}>{cat}</span>
                  <span style={{ color: '#444', fontSize: '15px' }}>›</span>
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
            style={{ ...rowStyle, color: '#888', fontSize: '13px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#e8edf5' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#888' }}
          >
            ‹ Back to categories
          </button>
          {categoryLoading && <p style={{ padding: '12px 20px', fontSize: '13px', color: '#555', margin: 0 }}>Loading…</p>}
          {!categoryLoading && categoryExercises.length === 0 && (
            <p style={{ padding: '12px 20px', fontSize: '13px', color: '#555', margin: 0 }}>No exercises in this category.</p>
          )}
          {!categoryLoading && categoryExercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => selectExercise(ex)}
              style={rowStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', color: '#e8edf5' }}>{ex.name}</span>
                {ex.video_url && <span style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>Video attached</span>}
              </div>
              <span style={{ fontSize: '11px', color: '#555', marginLeft: '12px', flexShrink: 0 }}>
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
            style={{ ...rowStyle, color: '#888', fontSize: '13px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#e8edf5' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#888' }}
          >
            ‹ Back
          </button>
          <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#e8edf5', margin: '0 0 2px' }}>{pickerExercise.name}</p>
            <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>
              {(pickerExercise.categories?.length ? pickerExercise.categories : [pickerExercise.category]).filter(Boolean).join(' · ')}
            </p>
            {pickerExercise.video_url && (
              <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>Video attached</p>
            )}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#888', marginBottom: '6px' }}>Sets</label>
                <input
                  type="number" min="1" value={configSets}
                  onChange={e => setConfigSets(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#888', marginBottom: '6px' }}>Reps</label>
                <input
                  type="number" min="1" value={configReps}
                  onChange={e => setConfigReps(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#888', marginBottom: '6px' }}>Weight ({weightUnit})</label>
                <input
                  type="number" min="0" step="0.5" value={configWeight}
                  onChange={e => setConfigWeight(e.target.value)}
                  placeholder="optional"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#888', marginBottom: '6px' }}>
                Notes for client <span style={{ fontWeight: 400, color: '#555' }}>(optional)</span>
              </label>
              <input
                type="text" value={configNotes}
                onChange={e => setConfigNotes(e.target.value)}
                placeholder="e.g. keep back straight, stop if painful"
                style={inputStyle}
              />
            </div>
            {addError && <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{addError}</p>}
            <button
              onClick={handleConfirmAdd}
              disabled={adding || disabled || !configSets || !configReps}
              style={{
                width: '100%', padding: '10px', background: '#29B5CC', color: '#000',
                border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                cursor: adding || disabled || !configSets || !configReps ? 'not-allowed' : 'pointer',
                opacity: adding || disabled || !configSets || !configReps ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {adding ? 'Adding…' : confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
