import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import ProgramWeekPanel from '../../components/therapist/ProgramWeekPanel'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { CARD } from '../../components/therapist/styles'

function addDaysToDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0]
}

export default function ProgramEdit() {
  const { clientId, programId, templateId } = useParams()
  const { profile } = useAuth()


  const mode = clientId ? 'program' : 'template'
  const entityId = mode === 'program' ? programId : templateId

  const [name, setName] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [startDate, setStartDate] = useState('')
  const [defaultCheckinFormId, setDefaultCheckinFormId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [weekCheckins, setWeekCheckins] = useState({})
  const [checkinForms, setCheckinForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveAsTemplateModal, setSaveAsTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (profile?.id) fetchAll()
  }, [entityId, profile?.id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchEntity(), fetchCheckinForms()])
    setLoading(false)
  }

  async function fetchCheckinForms() {
    const { data } = await supabase
      .from('check_in_forms')
      .select('id, name')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
    setCheckinForms(data ?? [])
  }

  async function fetchEntity() {
    if (mode === 'program') {
      const [progRes, sessRes, weekCheckinRes] = await Promise.all([
        supabase.from('programs').select('id, name, duration_weeks, start_date, default_checkin_form_id').eq('id', entityId).single(),
        supabase.from('prescriptions').select('id, name, frequency_days, week_number, source_template_id').eq('program_id', entityId).order('week_number', { ascending: true }),
        supabase.from('program_week_checkins').select('week_number, checkin_form_id, check_in_forms(name)').eq('program_id', entityId),
      ])
      if (progRes.data) {
        setName(progRes.data.name)
        setDurationWeeks(progRes.data.duration_weeks)
        setStartDate(progRes.data.start_date ?? '')
        setDefaultCheckinFormId(progRes.data.default_checkin_form_id ?? null)
      }
      setSessions(sessRes.data ?? [])
      const wc = {}
      for (const row of weekCheckinRes.data ?? []) {
        wc[row.week_number] = { checkinFormId: row.checkin_form_id, checkinFormName: row.check_in_forms?.name ?? null }
      }
      setWeekCheckins(wc)
    } else {
      const [tmplRes, sessRes, weekCheckinRes] = await Promise.all([
        supabase.from('program_templates').select('id, name, duration_weeks, default_checkin_form_id').eq('id', entityId).single(),
        supabase.from('program_template_sessions').select('id, week_number, session_name, template_id').eq('program_template_id', entityId).order('week_number', { ascending: true }),
        supabase.from('program_template_week_checkins').select('week_number, checkin_form_id, check_in_forms(name)').eq('program_template_id', entityId),
      ])
      if (tmplRes.data) {
        setName(tmplRes.data.name)
        setDurationWeeks(tmplRes.data.duration_weeks)
        setDefaultCheckinFormId(tmplRes.data.default_checkin_form_id ?? null)
      }
      setSessions(sessRes.data ?? [])
      const wc = {}
      for (const row of weekCheckinRes.data ?? []) {
        wc[row.week_number] = { checkinFormId: row.checkin_form_id, checkinFormName: row.check_in_forms?.name ?? null }
      }
      setWeekCheckins(wc)
    }
  }

  async function saveName() {
    if (!name.trim()) return
    const table = mode === 'program' ? 'programs' : 'program_templates'
    await supabase.from(table).update({ name: name.trim() }).eq('id', entityId)
  }

  async function handleStartDateChange(e) {
    const date = e.target.value
    setStartDate(date)
    setSaving(true)
    await supabase.from('programs').update({ start_date: date || null }).eq('id', entityId)

    if (date) {
      const prescriptionIds = sessions.map(s => s.id)
      if (prescriptionIds.length > 0) {
        const { data: logCounts } = await supabase
          .from('session_logs')
          .select('prescription_id')
          .in('prescription_id', prescriptionIds)
        const withLogs = new Set((logCounts ?? []).map(l => l.prescription_id))

        for (const s of sessions) {
          if (!withLogs.has(s.id) && s.week_number) {
            const sessionStart = addDaysToDate(date, (s.week_number - 1) * 7)
            await supabase.from('prescriptions').update({ start_date: sessionStart }).eq('id', s.id)
          }
        }
      }
    }
    setSaving(false)
  }

  async function handleDefaultCheckinChange(e) {
    const formId = e.target.value || null
    setDefaultCheckinFormId(formId)
    const table = mode === 'program' ? 'programs' : 'program_templates'
    await supabase.from(table).update({ default_checkin_form_id: formId }).eq('id', entityId)
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    try {
      const { data: newTemplate, error: tmplErr } = await supabase
        .from('program_templates')
        .insert({ therapist_id: profile.id, name: templateName.trim(), duration_weeks: durationWeeks, default_checkin_form_id: defaultCheckinFormId ?? null })
        .select('id')
        .single()
      if (tmplErr) throw new Error(tmplErr.message)

      for (const s of sessions) {
        await supabase.from('program_template_sessions').insert({
          program_template_id: newTemplate.id,
          week_number: s.week_number,
          session_name: s.name,
          template_id: s.source_template_id ?? null,
        })
      }

      const { data: wcs } = await supabase.from('program_week_checkins').select('week_number, checkin_form_id').eq('program_id', entityId)
      if (wcs?.length > 0) {
        await supabase.from('program_template_week_checkins').insert(
          wcs.map(wc => ({ program_template_id: newTemplate.id, week_number: wc.week_number, checkin_form_id: wc.checkin_form_id }))
        )
      }

      setSaveAsTemplateModal(false)
      setTemplateName('')
      showToast('Saved as program template')
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const weeks = Array.from({ length: durationWeeks }, (_, i) => i + 1)

  function sessionsForWeek(weekNum) {
    if (mode === 'program') {
      return sessions.filter(s => s.week_number === weekNum).map(s => ({
        id: s.id,
        name: s.name,
        frequencyDays: s.frequency_days,
        isCustom: !s.source_template_id,
      }))
    } else {
      return sessions.filter(s => s.week_number === weekNum).map(s => ({
        id: s.id,
        name: s.session_name,
        isCustom: !s.template_id,
      }))
    }
  }

  const backTo = mode === 'program'
    ? `/therapist/prescribe/${clientId}`
    : '/therapist/templates'

  return (
    <SidebarLayout>
      <PageHero
        title={name || 'Program'}
        subtitle={mode === 'program' ? 'Client program' : 'Program template'}
        back={{ label: mode === 'program' ? 'Prescribe' : 'Templates', to: backTo }}
        actions={
          mode === 'program' ? (
            <button
              onClick={() => { setTemplateName(name); setSaveAsTemplateModal(true) }}
              style={{ padding: '8px 14px', background: 'transparent', color: 'var(--color-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}
            >
              Save as Template
            </button>
          ) : null
        }
      />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {loading ? (
          <div style={{ ...CARD }}><ShimmerLine /><div style={{ height: '120px' }} /></div>
        ) : (
          <>
            {/* Header fields */}
            <div style={{ ...CARD, marginBottom: '20px' }}>
              <ShimmerLine />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Program name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={saveName}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Duration */}
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Duration (weeks)</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={durationWeeks}
                      onChange={async e => {
                        const val = parseInt(e.target.value) || 1
                        const clamped = Math.max(1, Math.min(52, val))
                        if (clamped < durationWeeks) {
                          const affected = sessions.filter(s => (s.week_number ?? 0) > clamped)
                          if (affected.length > 0) {
                            if (!window.confirm(`Reducing to ${clamped} weeks will hide ${affected.length} session(s) in weeks ${clamped + 1}+. They remain in the database as standalone sessions but won't show in this editor. Continue?`)) return
                          }
                        }
                        setDurationWeeks(clamped)
                        const table = mode === 'program' ? 'programs' : 'program_templates'
                        await supabase.from(table).update({ duration_weeks: clamped }).eq('id', entityId)
                      }}
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Start date — program mode only */}
                  {mode === 'program' && (
                    <div style={{ flex: '1', minWidth: '160px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>
                        Start date {saving && <span style={{ color: 'var(--color-subtle)' }}>(saving…)</span>}
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>

                {/* Default check-in form */}
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginBottom: '5px' }}>Default check-in form (all weeks)</label>
                  <select
                    value={defaultCheckinFormId ?? ''}
                    onChange={handleDefaultCheckinChange}
                    style={{ padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', width: '100%', maxWidth: '280px' }}
                  >
                    <option value="">None</option>
                    {checkinForms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Week panels */}
            <div>
              {weeks.map(weekNum => (
                <ProgramWeekPanel
                  key={weekNum}
                  mode={mode}
                  weekNumber={weekNum}
                  sessions={sessionsForWeek(weekNum)}
                  checkinFormId={weekCheckins[weekNum]?.checkinFormId ?? null}
                  checkinFormName={weekCheckins[weekNum]?.checkinFormName ?? null}
                  checkinForms={checkinForms}
                  programId={mode === 'program' ? entityId : undefined}
                  templateId={mode === 'template' ? entityId : undefined}
                  clientId={clientId}
                  therapistId={profile.id}
                  programStartDate={startDate || null}
                  onRefresh={fetchEntity}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Save as template modal */}
      {saveAsTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Save as program template</p>
            <input
              autoFocus
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveAsTemplate() }}
              placeholder="Template name"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setSaveAsTemplateModal(false)} style={{ flex: 1, padding: '8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSaveAsTemplate} disabled={savingTemplate || !templateName.trim()} style={{ flex: 1, padding: '8px', background: '#29B5CC', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px', opacity: savingTemplate || !templateName.trim() ? 0.5 : 1 }}>
                {savingTemplate ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 200 }}>
          <span style={{ color: '#29B5CC' }}>✓</span>
          <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{toast}</span>
        </div>
      )}
    </SidebarLayout>
  )
}
