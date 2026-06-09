import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toCanonical } from '../../utils/weightUtils'
import useIsMobile from '../../hooks/useIsMobile'
import ShimmerLine from '../shared/ShimmerLine'
import { formatTempo } from '../../utils/formatTempo'

const CATEGORIES = [
  'Custom', 'Cervical', 'Thoracic', 'Lumbar',
  'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General',
]

const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
  borderRadius: '7px', color: 'var(--color-text)', padding: '9px 14px',
  fontSize: '13px', outline: 'none',
}

const rowStyle = {
  display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
  padding: '11px 20px', textAlign: 'left', background: 'none', border: 'none',
  borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.15s',
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
  const [configMeasurementType, setConfigMeasurementType] = useState('reps')
  const [configBilateral, setConfigBilateral] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [configTempoEnabled, setConfigTempoEnabled] = useState(false)
  const [configTempoDown, setConfigTempoDown] = useState('')
  const [configTempoHold, setConfigTempoHold] = useState('')
  const [configTempoUp, setConfigTempoUp] = useState('')
  const [configTempoTop, setConfigTempoTop] = useState('')

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
    const term = debouncedSearch.trim()
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, category, categories, default_sets, default_reps, is_timed, is_bilateral, video_url')
      .textSearch('fts', term, { type: 'websearch', config: 'english' })
      .limit(10)
    if (error || !data?.length) {
      const { data: fallback } = await supabase
        .from('exercises')
        .select('id, name, category, categories, default_sets, default_reps, is_timed, is_bilateral, video_url')
        .ilike('name', `%${term}%`)
        .order('name')
        .limit(10)
      setSearchResults(fallback ?? [])
    } else {
      setSearchResults(data)
    }
    setSearching(false)
  }

  async function selectCategory(cat) {
    setCategoryLoading(true)
    setPickerCategory(cat)
    setPickerView('category')
    let query = supabase.from('exercises').select('id, name, category, categories, default_sets, default_reps, is_timed, is_bilateral, video_url')
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
    setConfigMeasurementType(ex.is_timed ? 'seconds' : 'reps')
    setConfigBilateral(ex.is_bilateral ?? false)
    setAddError(null)
    setConfigTempoEnabled(false)
    setConfigTempoDown('')
    setConfigTempoHold('')
    setConfigTempoUp('')
    setConfigTempoTop('')
    setPickerView('configure')
  }

  async function handleConfirmAdd() {
    setAddError(null)

    if (configTempoEnabled) {
      const e = parseInt(configTempoDown)
      const b = parseInt(configTempoHold)
      const c = parseInt(configTempoUp)
      const t = parseInt(configTempoTop)
      const valid =
        !isNaN(e) && !isNaN(b) && !isNaN(c) && !isNaN(t) &&
        e >= 1 && e <= 9 && c >= 1 && c <= 9 &&
        b >= 0 && b <= 9 && t >= 0 && t <= 9
      if (!valid) {
        setAddError('Tempo: down and up must be 1–9; hold and top must be 0–9.')
        return
      }
    }

    setAdding(true)
    try {
      await onAdd({
        exerciseId: pickerExercise.id,
        sets: parseInt(configSets) || null,
        reps: parseInt(configReps) || null,
        weight: configWeight ? toCanonical(parseFloat(configWeight), weightUnit) : null,
        notes: configNotes.trim() || null,
        measurementType: configMeasurementType,
        bilateral: configBilateral,
        tempoEccentric:   configTempoEnabled ? parseInt(configTempoDown) : null,
        tempoBottomPause: configTempoEnabled ? parseInt(configTempoHold) : null,
        tempoConcentric:  configTempoEnabled ? parseInt(configTempoUp)   : null,
        tempoTopPause:    configTempoEnabled ? parseInt(configTempoTop)   : null,
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
      background: 'var(--color-surface)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--color-border)', borderRadius: '14px',
      overflow: 'hidden', position: 'relative',
      maxHeight: isMobile ? '85vh' : 'none',
      overflowY: isMobile ? 'auto' : 'visible',
    }}>
      <ShimmerLine />

      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', margin: 0 }}>Add exercise</p>
      </div>

      {pickerView !== 'configure' && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
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
              {searching && <p style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--color-subtle)', margin: 0 }}>Searching…</p>}
              {!searching && searchResults.length === 0 && (
                <p style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--color-subtle)', margin: 0 }}>No results for "{debouncedSearch}".</p>
              )}
              {!searching && searchResults.length > 0 && searchResults.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => selectExercise(ex)}
                  style={rowStyle}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{ex.name}</span>
                    {ex.video_url && <span style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px' }}>Video attached</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-subtle)', marginLeft: '12px', flexShrink: 0 }}>{ex.category}</span>
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
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: '13px', color: cat === 'Custom' ? 'var(--color-text)' : 'var(--color-muted)' }}>{cat}</span>
                  <span style={{ color: 'var(--color-muted)', fontSize: '15px' }}>›</span>
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
            style={{ ...rowStyle, color: 'var(--color-muted)', fontSize: '13px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-elevated)'; e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-muted)' }}
          >
            ‹ Back to categories
          </button>
          {categoryLoading && <p style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--color-subtle)', margin: 0 }}>Loading…</p>}
          {!categoryLoading && categoryExercises.length === 0 && (
            <p style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--color-subtle)', margin: 0 }}>No exercises in this category.</p>
          )}
          {!categoryLoading && categoryExercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => selectExercise(ex)}
              style={rowStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{ex.name}</span>
                {ex.video_url && <span style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '2px' }}>Video attached</span>}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-subtle)', marginLeft: '12px', flexShrink: 0 }}>
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
            style={{ ...rowStyle, color: 'var(--color-muted)', fontSize: '13px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-elevated)'; e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-muted)' }}
          >
            ‹ Back
          </button>
          <div style={{ padding: '12px 20px', background: 'var(--color-elevated)', borderBottom: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', margin: '0 0 2px' }}>{pickerExercise.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--color-subtle)', margin: 0 }}>
              {(pickerExercise.categories?.length ? pickerExercise.categories : [pickerExercise.category]).filter(Boolean).join(' · ')}
            </p>
            {pickerExercise.video_url && (
              <p style={{ fontSize: '11px', color: 'var(--color-subtle)', margin: '2px 0 0' }}>Video attached</p>
            )}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Measurement type toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Measurement</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['reps', 'seconds'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfigMeasurementType(type)}
                    style={{
                      flex: 1, padding: '8px', fontSize: '12px', fontWeight: 500,
                      borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s',
                      border: configMeasurementType === type ? '1px solid #29B5CC' : '1px solid var(--color-border)',
                      background: configMeasurementType === type ? '#29B5CC' : 'var(--color-elevated)',
                      color: configMeasurementType === type ? '#000' : 'var(--color-muted)',
                    }}
                  >
                    {type === 'reps' ? 'Reps' : 'Seconds'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Sets</label>
                <input
                  type="number" min="1" value={configSets}
                  onChange={e => setConfigSets(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>
                  {configMeasurementType === 'seconds' ? 'Seconds' : 'Reps'}
                </label>
                <input
                  type="number" min="1" value={configReps}
                  onChange={e => setConfigReps(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Weight ({weightUnit})</label>
                <input
                  type="number" min="0" step="0.5" value={configWeight}
                  onChange={e => setConfigWeight(e.target.value)}
                  placeholder="optional"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Bilateral checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={configBilateral}
                onChange={e => setConfigBilateral(e.target.checked)}
                style={{ accentColor: '#29B5CC', width: '14px', height: '14px' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>Complete on both sides</span>
            </label>

            {/* Tempo — optional */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: configTempoEnabled ? '8px' : 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)' }}>
                  Tempo <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setConfigTempoEnabled(v => !v)}
                  style={{
                    width: '32px', height: '18px', borderRadius: '9px', border: 'none',
                    cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.15s',
                    background: configTempoEnabled ? '#29B5CC' : 'var(--color-border)',
                  }}
                >
                  <span style={{
                    display: 'block', width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: '2px', transition: 'left 0.15s',
                    left: configTempoEnabled ? '16px' : '2px',
                  }} />
                </button>
              </div>
              {configTempoEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <input type="number" min={1} max={9} value={configTempoDown} onChange={e => setConfigTempoDown(e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px', colorScheme: 'dark' }} />
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Eccentric</span>
                    </div>
                    <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '20px' }}>—</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <input type="number" min={0} max={9} value={configTempoHold} onChange={e => setConfigTempoHold(e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px', colorScheme: 'dark' }} />
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HOLD</span>
                    </div>
                    <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '20px' }}>—</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <input type="number" min={1} max={9} value={configTempoUp} onChange={e => setConfigTempoUp(e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px', colorScheme: 'dark' }} />
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Concentric</span>
                    </div>
                    <span style={{ color: 'var(--color-subtle)', fontSize: '12px', paddingBottom: '20px' }}>—</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <input type="number" min={0} max={9} value={configTempoTop} onChange={e => setConfigTempoTop(e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', padding: '7px 4px', colorScheme: 'dark' }} />
                      <span style={{ fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOP</span>
                    </div>
                  </div>
                  {(() => {
                    const e = parseInt(configTempoDown), b = parseInt(configTempoHold)
                    const c = parseInt(configTempoUp), t = parseInt(configTempoTop)
                    if ([e, b, c, t].some(isNaN)) return null
                    const tempo = formatTempo(e, b, c, t)
                    return (
                      <p style={{ margin: 0, fontSize: '11px', color: '#29B5CC', fontStyle: 'italic', background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '6px', padding: '6px 10px' }}>
                        {tempo.breakdown.map(ph => `${ph.value} ${ph.label}`).join(' · ')}
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>
                Notes for client <span style={{ fontWeight: 400, color: 'var(--color-subtle)' }}>(optional)</span>
              </label>
              <input
                type="text" value={configNotes}
                onChange={e => setConfigNotes(e.target.value)}
                placeholder="e.g. keep back straight, stop if painful"
                style={inputStyle}
              />
            </div>
            {addError && <p style={{ fontSize: '13px', color: 'var(--color-danger)', margin: 0 }}>{addError}</p>}
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
