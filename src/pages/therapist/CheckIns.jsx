import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SECTION_LABEL } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import { weekNumber, formatPeriodDate } from '../../utils/checkInUtils'

function StatusBadge({ status }) {
  const map = {
    completed: { bg: 'rgba(41,181,204,0.10)', border: 'rgba(41,181,204,0.2)', color: '#29B5CC', label: 'Completed' },
    pending:   { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: 'Pending' },
    missed:    { bg: 'rgba(248,81,73,0.08)',  border: 'rgba(248,81,73,0.2)',  color: '#f85149', label: 'Missed' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '9999px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function computeDisplayStatus(instance) {
  if (instance.status === 'completed') return 'completed'
  // Pending instance in a prior period = missed
  const today = new Date()
  const period = new Date(instance.period_start_date)
  period.setDate(period.getDate() + 7)
  return period < today ? 'missed' : 'pending'
}

export default function CheckIns() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('responses')

  // Responses tab
  const [instances, setInstances] = useState([])
  const [instancesLoading, setInstancesLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  // Templates tab
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesLoaded, setTemplatesLoaded] = useState(false)

  useEffect(() => { if (profile?.id) fetchInstances() }, [profile?.id])

  async function fetchInstances() {
    setInstancesLoading(true)
    // No explicit therapist filter — RLS policy "therapist_read_instances" restricts
    // rows to instances belonging to this therapist's forms. The 100-row limit is
    // applied after RLS filtering. If pagination is added later, filter explicitly
    // via check_in_forms.therapist_id to avoid a full RLS scan.
    const { data } = await supabase
      .from('check_in_instances')
      .select(`
        id, period_start_date, status,
        check_in_forms(id, name, start_date, check_in_questions(id, question_text, question_type, order_index)),
        clients(name),
        check_in_responses(id, answers, submitted_at)
      `)
      .order('period_start_date', { ascending: false })
      .limit(100)
    setInstances(data ?? [])
    setInstancesLoading(false)
  }

  async function fetchTemplates() {
    if (templatesLoaded) return
    setTemplatesLoading(true)
    const { data } = await supabase
      .from('check_in_forms')
      .select('id, name, day_of_week, start_date, duration_weeks, check_in_questions(count)')
      .eq('is_template', true)
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
    setTemplatesLoaded(true)
    setTemplatesLoading(false)
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (tab === 'templates') fetchTemplates()
  }

  async function deleteTemplate(id, name) {
    if (!window.confirm(`Delete template "${name}"?`)) return
    await supabase.from('check_in_forms').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const displayInstances = instances.map(i => ({ ...i, displayStatus: computeDisplayStatus(i) }))
  const filtered = filter === 'all' ? displayInstances : displayInstances.filter(i => i.displayStatus === filter)

  return (
    <SidebarLayout>
      <PageHero title="Check-Ins" subtitle="Manage forms & review responses">
        <button
          onClick={() => navigate('/therapist/checkins/new')}
          style={{ background: '#29B5CC', color: '#000', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          + New Check-In
        </button>
      </PageHero>

      {/* Tab bar */}
      <div style={{ maxWidth: '680px', display: 'flex', gap: '24px', borderBottom: '1px solid var(--color-border)', margin: '0 16px 20px', paddingTop: '4px' }}>
        {[['responses', 'Responses'], ['templates', 'Templates']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            style={{ paddingBottom: '10px', fontSize: '13px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === tab ? '#29B5CC' : 'var(--color-muted)', borderBottom: activeTab === tab ? '2px solid #29B5CC' : '2px solid transparent', marginBottom: '-1px', fontFamily: 'inherit' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '680px', padding: '0 16px 40px' }}>

        {/* Responses tab */}
        {activeTab === 'responses' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['all', 'pending', 'completed', 'missed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '9999px', cursor: 'pointer', fontFamily: 'inherit', border: filter === f ? '1px solid rgba(41,181,204,0.35)' : '1px solid rgba(100,160,255,0.12)', background: filter === f ? 'rgba(41,181,204,0.10)' : 'rgba(255,255,255,0.03)', color: filter === f ? '#29B5CC' : 'var(--color-muted)' }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'missed' && <span title="Only shown for clients who have visited the app since the check-in was due." style={{ marginLeft: '4px', cursor: 'help' }}>ⓘ</span>}
                </button>
              ))}
            </div>

            {instancesLoading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!instancesLoading && filtered.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No check-ins found.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(instance => {
                const form = instance.check_in_forms
                const response = instance.check_in_responses?.[0]
                const wk = form ? weekNumber(instance.period_start_date, form.start_date) : '?'
                const isExpanded = expandedId === instance.id

                return (
                  <div key={instance.id} style={{ ...CARD, padding: '14px 16px' }}>
                    <ShimmerLine />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{instance.clients?.name ?? '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                          {form?.name ?? '—'} · Week {wk} · {formatPeriodDate(instance.period_start_date)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <StatusBadge status={instance.displayStatus} />
                        {instance.displayStatus === 'completed' && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : instance.id)}
                            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(100,160,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'var(--color-muted)', cursor: 'pointer' }}
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Response detail */}
                    <AnimatePresence>
                      {isExpanded && response && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginBottom: '12px' }}>
                              Submitted {new Date(response.submitted_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            {(form?.check_in_questions ?? [])
                              .sort((a, b) => a.order_index - b.order_index)
                              .map(q => {
                                const answer = response.answers?.[q.id]
                                return (
                                  <div key={q.id} style={{ marginBottom: '14px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '6px' }}>{q.question_text}</div>
                                    {q.question_type === 'scale' ? (
                                      <div>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                          {[1,2,3,4,5].map(n => (
                                            <div key={n} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, background: answer === n ? '#29B5CC' : 'rgba(255,255,255,0.03)', border: answer === n ? '1px solid #29B5CC' : '1px solid rgba(100,160,255,0.12)', color: answer === n ? '#000' : 'var(--color-muted)' }}>{n}</div>
                                          ))}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-subtle)', marginTop: '4px', width: '160px' }}>
                                          <span>1 – Not good</span><span>5 – Very good</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '13px', color: 'var(--color-text)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,160,255,0.08)', borderRadius: '6px', padding: '8px 10px', lineHeight: 1.5 }}>
                                        {answer ?? '—'}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {templatesLoading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!templatesLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {templates.map(t => (
                  <div key={t.id} style={{ ...CARD, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <ShimmerLine />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '2px' }}>
                        {t.check_in_questions?.[0]?.count ?? 0} questions
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => navigate(`/therapist/checkins/new?from=${t.id}`)} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(41,181,204,0.2)', background: 'rgba(41,181,204,0.1)', color: '#29B5CC', cursor: 'pointer' }}>Assign</button>
                      <button onClick={() => navigate(`/therapist/checkins/${t.id}`)} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(100,160,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'var(--color-muted)', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteTemplate(t.id, t.name)} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(248,81,73,0.2)', background: 'transparent', color: '#f85149', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => navigate('/therapist/checkins/new?template=true')} style={{ width: '100%', padding: '11px', background: 'transparent', border: '1px dashed rgba(41,181,204,0.3)', borderRadius: '9px', color: '#29B5CC', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  + New Template
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </SidebarLayout>
  )
}
