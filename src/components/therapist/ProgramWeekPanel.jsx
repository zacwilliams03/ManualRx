import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ApplyTemplateModal from './ApplyTemplateModal'

function addDaysToDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0]
}

// Props:
// mode: 'program' | 'template'
// weekNumber: int
// sessions: array of { id, name, frequencyDays?, isCustom } (normalized by parent)
// checkinFormName: string | null — name of the check-in form assigned to this week
// checkinFormId: string | null
// checkinForms: array of { id, name }
// programId: string (mode='program')
// templateId: string (mode='template')
// clientId: string (mode='program')
// therapistId: string
// programStartDate: string|null (mode='program')
// onRefresh: () => void — parent refreshes its data after any mutation
export default function ProgramWeekPanel({
  mode,
  weekNumber,
  sessions,
  checkinFormName,
  checkinFormId,
  checkinForms,
  programId,
  templateId,
  clientId,
  therapistId,
  programStartDate,
  onRefresh,
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  async function handleNewSessionFromScratch() {
    if (mode === 'program') {
      setSaving(true)
      const name = `Week ${weekNumber} Session ${sessions.length + 1}`
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          therapist_id: therapistId,
          client_id: clientId,
          name,
          program_id: programId,
          week_number: weekNumber,
          start_date: programStartDate
            ? addDaysToDate(programStartDate, (weekNumber - 1) * 7)
            : null,
        })
        .select('id')
        .single()
      setSaving(false)
      if (error) { alert('Failed to create session.'); return }
      navigate(`/therapist/prescribe/${clientId}/sessions/${data.id}?programId=${programId}&weekNumber=${weekNumber}`)
    } else {
      setNewSessionName('')
      setShowNameModal(true)
    }
  }

  async function handleCreateTemplateSession() {
    if (!newSessionName.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('program_template_sessions')
      .insert({
        program_template_id: templateId,
        week_number: weekNumber,
        session_name: newSessionName.trim(),
        template_id: null,
      })
    setSaving(false)
    if (error) { alert('Failed to create session.'); return }
    setShowNameModal(false)
    onRefresh()
  }

  async function handleRemoveSession(sessionId) {
    // In program mode: unlink from this program (prescription becomes a standalone session
    // visible on the Prescribe page). Does NOT delete the prescription or its session logs.
    // In template mode: permanently deletes the program_template_sessions row.
    const msg = mode === 'program'
      ? 'Remove this session from the program? It will remain as a standalone session on the Prescribe page.'
      : 'Remove this session from the template?'
    if (!window.confirm(msg)) return
    if (mode === 'program') {
      await supabase.from('prescriptions').update({ program_id: null, week_number: null }).eq('id', sessionId)
    } else {
      await supabase.from('program_template_sessions').delete().eq('id', sessionId)
    }
    onRefresh()
  }

  async function handleRename(sessionId) {
    if (!renameValue.trim()) return
    setSaving(true)
    if (mode === 'template') {
      await supabase.from('program_template_sessions').update({ session_name: renameValue.trim() }).eq('id', sessionId)
    }
    setSaving(false)
    setRenamingId(null)
    onRefresh()
  }

  async function handleCheckinChange(e) {
    const formId = e.target.value || null
    if (mode === 'program') {
      if (formId) {
        await supabase.from('program_week_checkins').upsert({ program_id: programId, week_number: weekNumber, checkin_form_id: formId }, { onConflict: 'program_id,week_number' })
      } else {
        await supabase.from('program_week_checkins').delete().eq('program_id', programId).eq('week_number', weekNumber)
      }
    } else {
      if (formId) {
        await supabase.from('program_template_week_checkins').upsert({ program_template_id: templateId, week_number: weekNumber, checkin_form_id: formId }, { onConflict: 'program_template_id,week_number' })
      } else {
        await supabase.from('program_template_week_checkins').delete().eq('program_template_id', templateId).eq('week_number', weekNumber)
      }
    }
    onRefresh()
  }

  const hasBadge = !!checkinFormName

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: open ? 'rgba(41,181,204,0.06)' : 'var(--color-elevated)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {open ? <ChevronDown size={14} color="var(--color-muted)" /> : <ChevronRight size={14} color="var(--color-muted)" />}
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Week {weekNumber}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          {hasBadge && (
            <span style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px' }}>
              Check-in
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border)' }}>
          {/* Sessions list */}
          {sessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
              {renamingId === s.id ? (
                <>
                  <input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id); if (e.key === 'Escape') setRenamingId(null) }}
                    autoFocus
                    style={{ flex: 1, background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '3px 8px', fontSize: '13px', color: 'var(--color-text)', outline: 'none' }}
                  />
                  <button onClick={() => handleRename(s.id)} disabled={saving} style={{ fontSize: '11px', color: '#29B5CC', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setRenamingId(null)} style={{ fontSize: '11px', color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>{s.name}</span>
                  {s.frequencyDays && <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{s.frequencyDays}d</span>}
                  {mode === 'program' && (
                    <button
                      onClick={() => navigate(`/therapist/prescribe/${clientId}/sessions/${s.id}?programId=${programId}&weekNumber=${weekNumber}`)}
                      style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  )}
                  {mode === 'template' && s.isCustom && (
                    <button
                      onClick={() => { setRenamingId(s.id); setRenameValue(s.name) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', padding: '2px' }}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSession(s.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            <button
              onClick={handleNewSessionFromScratch}
              disabled={saving}
              style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}
            >
              + New Session
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'none', color: '#29B5CC', cursor: 'pointer' }}
            >
              + From Template
            </button>
          </div>

          {/* Check-in form row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-subtle)', flexShrink: 0 }}>Check-in:</span>
            <select
              value={checkinFormId ?? ''}
              onChange={handleCheckinChange}
              style={{ fontSize: '12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text)', padding: '3px 6px', flex: 1, maxWidth: '220px' }}
            >
              <option value="">None (use default)</option>
              {checkinForms.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ApplyTemplateModal for "From Template" in program mode */}
      {showApplyModal && mode === 'program' && (
        <ApplyTemplateModal
          therapistId={therapistId}
          clientId={clientId}
          defaultFrequencyDays={null}
          programContext={{ programId, weekNumber, programStartDate }}
          onClose={() => setShowApplyModal(false)}
          onApplied={() => { setShowApplyModal(false); onRefresh() }}
        />
      )}

      {/* TemplatePicker for "From Template" in template mode */}
      {showApplyModal && mode === 'template' && (
        <TemplatePicker
          therapistId={therapistId}
          programTemplateId={templateId}
          weekNumber={weekNumber}
          onClose={() => setShowApplyModal(false)}
          onAdded={() => { setShowApplyModal(false); onRefresh() }}
        />
      )}

      {/* Name modal for template mode new session */}
      {showNameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', width: '320px' }}>
            <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Session name</p>
            <input
              autoFocus
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplateSession() }}
              placeholder="e.g. Lower Body Strength"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowNameModal(false)} style={{ flex: 1, padding: '8px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleCreateTemplateSession} disabled={saving || !newSessionName.trim()} style={{ flex: 1, padding: '8px', background: '#29B5CC', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px', opacity: !newSessionName.trim() ? 0.5 : 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple template picker modal for program template mode
function TemplatePicker({ therapistId, programTemplateId, weekNumber, onClose, onAdded }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('templates')
      .select('id, name')
      .eq('therapist_id', therapistId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTemplates(data ?? []); setLoading(false) })
  }, [])

  async function pick(t) {
    setSaving(true)
    await supabase.from('program_template_sessions').insert({
      program_template_id: programTemplateId,
      week_number: weekNumber,
      template_id: t.id,
      session_name: t.name,
    })
    setSaving(false)
    onAdded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', width: '320px', maxHeight: '420px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Add from template</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
          {!loading && templates.length === 0 && <p style={{ padding: '16px', fontSize: '13px', color: 'var(--color-muted)' }}>No session templates yet.</p>}
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => pick(t)}
              disabled={saving}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{t.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>Add ›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
