import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function addDaysToDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0]
}

// Props:
// therapistId: string
// clientId: string
// onClose: () => void
// onApplied: () => void
export default function ApplyProgramTemplateModal({ therapistId, clientId, onClose, onApplied }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('program_templates')
      .select('id, name, duration_weeks, program_template_sessions(count)')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false) })
  }, [therapistId])

  async function handleApply() {
    if (!selected || !startDate) return
    setApplying(true)
    setError(null)
    try {
      // 1. Create the programs row
      const { data: program, error: progErr } = await supabase
        .from('programs')
        .insert({
          therapist_id: therapistId,
          client_id: clientId,
          name: selected.name,
          duration_weeks: selected.duration_weeks,
          start_date: startDate,
        })
        .select('id')
        .single()
      if (progErr) throw new Error(progErr.message)

      // 2. Fetch full template sessions
      const { data: templateSessions, error: tsErr } = await supabase
        .from('program_template_sessions')
        .select('id, week_number, session_name, template_id')
        .eq('program_template_id', selected.id)
        .order('week_number', { ascending: true })
      if (tsErr) throw new Error(tsErr.message)

      // 3. For each template session, create a prescription (sequential awaits)
      for (const ts of templateSessions) {
        const sessionStartDate = addDaysToDate(startDate, (ts.week_number - 1) * 7)

        const { data: prescription, error: pErr } = await supabase
          .from('prescriptions')
          .insert({
            therapist_id: therapistId,
            client_id: clientId,
            name: ts.session_name,
            program_id: program.id,
            week_number: ts.week_number,
            start_date: sessionStartDate,
            source_template_id: ts.template_id ?? null,
          })
          .select('id')
          .single()
        if (pErr) throw new Error(pErr.message)

        if (ts.template_id) {
          // Copy exercises from session template
          const { data: templateExercises, error: teErr } = await supabase
            .from('template_exercises')
            .select('exercise_id, sets, reps, weight, therapist_notes, measurement_type, bilateral')
            .eq('template_id', ts.template_id)
          if (teErr) throw new Error(teErr.message)

          if (templateExercises.length > 0) {
            const exerciseRows = templateExercises.map(te => ({
              prescription_id: prescription.id,
              exercise_id: te.exercise_id,
              sets: te.sets,
              reps: te.reps,
              weight: te.weight,
              therapist_notes: te.therapist_notes,
              measurement_type: te.measurement_type ?? 'reps',
              bilateral: te.bilateral ?? false,
            }))
            const { error: exErr } = await supabase.from('prescription_exercises').insert(exerciseRows)
            if (exErr) throw new Error(exErr.message)
          }
        }
      }

      // 4. Copy check-in assignments from template
      const { data: templateCheckins } = await supabase
        .from('program_template_week_checkins')
        .select('week_number, checkin_form_id')
        .eq('program_template_id', selected.id)
      if (templateCheckins?.length > 0) {
        await supabase.from('program_week_checkins').insert(
          templateCheckins.map(tc => ({
            program_id: program.id,
            week_number: tc.week_number,
            checkin_form_id: tc.checkin_form_id,
          }))
        )
      }

      // 5. Copy default check-in form
      const { data: fullTemplate } = await supabase
        .from('program_templates')
        .select('default_checkin_form_id')
        .eq('id', selected.id)
        .single()
      if (fullTemplate?.default_checkin_form_id) {
        await supabase.from('programs').update({ default_checkin_form_id: fullTemplate.default_checkin_form_id }).eq('id', program.id)
      }

      onApplied()
    } catch (e) {
      setError(e.message || 'Failed to apply program template.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Apply Program Template</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {/* Template list */}
        {!selected && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {loading && <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!loading && templates.length === 0 && (
              <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>No program templates yet.</p>
            )}
            {templates.map(t => {
              const count = t.program_template_sessions?.[0]?.count ?? 0
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-subtle)' }}>{t.duration_weeks} weeks · {count} session{count !== 1 ? 's' : ''}</p>
                  </div>
                  <span style={{ color: 'var(--color-subtle)' }}>›</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Start date picker after selection */}
        {selected && (
          <div style={{ padding: '20px' }}>
            <div style={{ background: 'var(--color-elevated)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{selected.name}</p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-subtle)' }}>{selected.duration_weeks} weeks</p>
            </div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '6px' }}>Program start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
            {error && <p style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '10px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setSelected(null)} disabled={applying} style={{ flex: 1, padding: '9px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
              <button onClick={handleApply} disabled={applying || !startDate} style={{ flex: 1, padding: '9px', background: '#29B5CC', border: 'none', borderRadius: '7px', color: '#000', fontWeight: 600, cursor: applying ? 'default' : 'pointer', fontSize: '13px', opacity: applying ? 0.7 : 1 }}>
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
