import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SECTION_LABEL } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(100,160,255,0.12)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  color: 'var(--color-text)',
  fontFamily: 'inherit',
  outline: 'none',
}

const selectStyle = { ...inputStyle, cursor: 'pointer' }

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function CheckInEdit() {
  const { formId } = useParams()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from')
  const startAsTemplate = searchParams.get('template') === 'true'
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!!(formId || fromTemplateId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [formName, setFormName] = useState('New Check-In')
  const [isTemplate, setIsTemplate] = useState(startAsTemplate)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startDate, setStartDate] = useState(todayISO())
  const [durationWeeks, setDurationWeeks] = useState('')
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [questions, setQuestions] = useState([])
  const [addingQuestion, setAddingQuestion] = useState(null) // { type, text }
  const [clients, setClients] = useState([])

  useEffect(() => {
    if (!profile?.id) return
    fetchClients()
    if (formId) fetchForm(formId)
    else if (fromTemplateId) fetchTemplate(fromTemplateId)
    else setLoading(false)
  }, [profile?.id])

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('therapist_id', profile.id)
      .eq('is_active', true)
      .order('name')
    setClients(data ?? [])
  }

  async function fetchForm(id) {
    const { data, error: e } = await supabase
      .from('check_in_forms')
      .select('*, check_in_questions(*)')
      .eq('id', id)
      .single()
    if (e || !data) { setError('Form not found.'); setLoading(false); return }
    populateState(data, false)
    setLoading(false)
  }

  async function fetchTemplate(id) {
    const { data, error: e } = await supabase
      .from('check_in_forms')
      .select('*, check_in_questions(*)')
      .eq('id', id)
      .single()
    if (e || !data) { setError('Template not found.'); setLoading(false); return }
    populateState(data, true)
    setLoading(false)
  }

  function populateState(data, isFromTemplate) {
    setFormName(data.name)
    setIsTemplate(isFromTemplate ? false : data.is_template)
    setSelectedClientId(isFromTemplate ? '' : (data.client_id ?? ''))
    setDayOfWeek(data.day_of_week)
    setStartDate(isFromTemplate ? todayISO() : data.start_date)
    setIsIndefinite(!data.duration_weeks)
    setDurationWeeks(data.duration_weeks ? String(data.duration_weeks) : '')
    setQuestions(
      (data.check_in_questions ?? [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(q => ({
          id: isFromTemplate ? null : q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          order_index: q.order_index,
        }))
    )
  }

  function addQuestionOfType(type) {
    setAddingQuestion({ type, text: '' })
  }

  function confirmAddQuestion() {
    if (!addingQuestion?.text.trim()) return
    setQuestions(prev => [
      ...prev,
      { id: null, question_text: addingQuestion.text.trim(), question_type: addingQuestion.type, order_index: prev.length },
    ])
    setAddingQuestion(null)
  }

  function removeQuestion(index) {
    setQuestions(prev => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i })))
  }

  function moveQuestion(index, dir) {
    const arr = [...questions]
    const target = index + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    setQuestions(arr.map((q, i) => ({ ...q, order_index: i })))
  }

  async function handleSave() {
    if (!formName.trim()) { setError('Form name is required.'); return }
    if (!isTemplate && !selectedClientId) { setError('Please select a client.'); return }
    if (questions.length === 0) { setError('Add at least one question.'); return }
    setSaving(true)
    setError(null)

    const formData = {
      therapist_id: profile.id,
      client_id: isTemplate ? null : selectedClientId,
      name: formName.trim(),
      is_template: isTemplate,
      created_from_template_id: fromTemplateId ?? null,
      day_of_week: dayOfWeek,
      start_date: startDate,
      duration_weeks: isIndefinite ? null : (parseInt(durationWeeks) || null),
    }

    let savedId = formId
    if (formId) {
      const { error: e } = await supabase.from('check_in_forms').update(formData).eq('id', formId)
      if (e) { setError('Failed to save form.'); setSaving(false); return }
    } else {
      const { data, error: e } = await supabase.from('check_in_forms').insert(formData).select('id').single()
      if (e || !data) { setError('Failed to create form.'); setSaving(false); return }
      savedId = data.id
    }

    // Sync questions: delete removed, upsert current
    const existingIds = questions.filter(q => q.id).map(q => q.id)
    if (formId) {
      const { data: dbQs } = await supabase.from('check_in_questions').select('id').eq('form_id', savedId)
      const dbIds = (dbQs ?? []).map(q => q.id)
      const toDelete = dbIds.filter(id => !existingIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('check_in_questions').delete().in('id', toDelete)
      }
    }

    const questionRows = questions.map((q, i) => ({
      ...(q.id ? { id: q.id } : {}),
      form_id: savedId,
      question_text: q.question_text,
      question_type: q.question_type,
      order_index: i,
    }))
    const { error: qErr } = await supabase.from('check_in_questions').upsert(questionRows, { onConflict: 'id' })
    if (qErr) { setError('Failed to save questions.'); setSaving(false); return }

    navigate('/therapist/checkins')
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  if (loading) {
    return (
      <SidebarLayout>
        <PageHero title={formId ? 'Edit Check-In' : 'New Check-In'} subtitle="" />
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <PageHero
        title={formId ? 'Edit Check-In' : 'New Check-In'}
        subtitle={formId ? 'Edit form details and questions' : 'Create a new check-in form'}
      />
      <div style={{ maxWidth: '540px', padding: '0 16px 40px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Form details */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={CARD}>
          <ShimmerLine />
          <div style={{ ...SECTION_LABEL, marginBottom: '14px' }}>Form details</div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Form name</label>
            <input style={inputStyle} value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Weekly Check-In" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,160,255,0.08)', borderRadius: '9px', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>Save as template</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>Reuse this form for other clients</div>
            </div>
            <input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)} style={{ accentColor: '#29B5CC', width: '16px', height: '16px' }} />
          </label>
        </motion.div>

        {/* Assign to client */}
        {!isTemplate && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={CARD}>
            <ShimmerLine />
            <div style={{ ...SECTION_LABEL, marginBottom: '14px' }}>Assign to client</div>
            <select
              style={selectStyle}
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
            >
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </motion.div>
        )}

        {/* Questions */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={CARD}>
          <ShimmerLine />
          <div style={{ ...SECTION_LABEL, marginBottom: '14px' }}>Questions</div>

          {questions.map((q, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,160,255,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)' }}>Question {i + 1}</span>
                <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px', background: q.question_type === 'scale' ? 'rgba(41,181,204,0.12)' : 'rgba(77,142,247,0.12)', color: q.question_type === 'scale' ? '#29B5CC' : '#4d8ef7' }}>
                  {q.question_type === 'scale' ? '1–5 Scale' : 'Written'}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '8px' }}>{q.question_text}</div>
              {q.question_type === 'scale' && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1,2,3,4,5].map(n => (
                    <div key={n} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(100,160,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>{n}</div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                {i > 0 && <button type="button" onClick={() => moveQuestion(i, -1)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(100,160,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--color-muted)', cursor: 'pointer' }}>↑ Up</button>}
                {i < questions.length - 1 && <button type="button" onClick={() => moveQuestion(i, 1)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(100,160,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'var(--color-muted)', cursor: 'pointer' }}>↓ Down</button>}
                <button type="button" onClick={() => removeQuestion(i)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(248,81,73,0.2)', background: 'transparent', color: '#f85149', cursor: 'pointer' }}>Remove</button>
              </div>
            </div>
          ))}

          {addingQuestion ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,160,255,0.12)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '8px' }}>
                {addingQuestion.type === 'scale' ? '1–5 Scale question' : 'Written question'}
              </div>
              <input
                autoFocus
                style={{ ...inputStyle, marginBottom: '10px' }}
                placeholder="Enter question text…"
                value={addingQuestion.text}
                onChange={e => setAddingQuestion(prev => ({ ...prev, text: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') confirmAddQuestion(); if (e.key === 'Escape') setAddingQuestion(null) }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={confirmAddQuestion} style={{ padding: '7px 14px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Add question</button>
                <button type="button" onClick={() => setAddingQuestion(null)} style={{ padding: '7px 14px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid rgba(100,160,255,0.12)', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => addQuestionOfType('text')} style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', background: 'rgba(77,142,247,0.08)', border: '1px dashed rgba(77,142,247,0.3)', color: '#4d8ef7', fontFamily: 'inherit' }}>+ Written question</button>
              <button type="button" onClick={() => addQuestionOfType('scale')} style={{ flex: 1, padding: '10px', fontSize: '12px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', background: 'rgba(41,181,204,0.08)', border: '1px dashed rgba(41,181,204,0.3)', color: '#29B5CC', fontFamily: 'inherit' }}>+ 1–5 Scale question</button>
            </div>
          )}
        </motion.div>

        {/* Schedule */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={CARD}>
          <ShimmerLine />
          <div style={{ ...SECTION_LABEL, marginBottom: '14px' }}>Schedule</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Appears on</label>
              <select style={selectStyle} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Start date</label>
              <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '6px' }}>Duration</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number" min="1"
                style={{ ...inputStyle, flex: 1 }}
                placeholder="e.g. 8"
                value={durationWeeks}
                onChange={e => setDurationWeeks(e.target.value)}
                disabled={isIndefinite}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-muted)', flexShrink: 0 }}>weeks</span>
              <button
                type="button"
                onClick={() => setIsIndefinite(v => !v)}
                style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: isIndefinite ? 'rgba(41,181,204,0.12)' : 'rgba(255,255,255,0.04)', border: isIndefinite ? '1px solid rgba(41,181,204,0.3)' : '1px solid rgba(100,160,255,0.12)', color: isIndefinite ? '#29B5CC' : 'var(--color-muted)' }}
              >
                Indefinite
              </button>
            </div>
          </div>
        </motion.div>

        {error && <p style={{ fontSize: '13px', color: '#f85149' }}>{error}</p>}

        {/* Summary */}
        {!isTemplate && selectedClient && startDate && (
          <div style={{ background: 'rgba(41,181,204,0.06)', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#29B5CC' }}>
            This form will appear in {selectedClient.name}'s feed every {DAY_NAMES[dayOfWeek]}, starting {new Date(startDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: '13px', background: '#29B5CC', color: '#000', fontSize: '14px', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : (formId ? 'Save Changes' : 'Create Check-In')}
        </button>

      </div>
    </SidebarLayout>
  )
}
