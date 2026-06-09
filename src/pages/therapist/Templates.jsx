import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SECTION_LABEL } from '../../components/therapist/styles'
import ShimmerLine from '../../components/shared/ShimmerLine'
import useIsMobile from '../../hooks/useIsMobile'

export default function Templates() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [activeTab, setActiveTab] = useState('session')
  const [programTemplates, setProgramTemplates] = useState([])
  const [programTemplatesLoading, setProgramTemplatesLoading] = useState(true)
  const [creatingProgramTemplate, setCreatingProgramTemplate] = useState(false)

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))].sort()

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = search.trim() === '' || t.name.toLowerCase().includes(search.trim().toLowerCase())
    const matchesCategory = selectedCategory === null || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  useEffect(() => {
    if (profile?.id) {
      fetchTemplates()
      fetchProgramTemplates()
    }
  }, [profile?.id])

  async function fetchTemplates() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('templates')
      .select(`
        id, name, category, created_at,
        template_exercises(
          id,
          exercises(name)
        )
      `)
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
    if (fetchError) setError('Failed to load templates.')
    else setTemplates(data ?? [])
    setLoading(false)
  }

  async function createTemplate() {
    setCreating(true)
    const { data, error: insertError } = await supabase
      .from('templates')
      .insert({ therapist_id: profile.id, name: 'New Template' })
      .select('id')
      .single()
    if (insertError) {
      alert('Failed to create template.')
      setCreating(false)
      return
    }
    navigate(`/therapist/templates/${data.id}`)
  }

  async function deleteTemplate(id, name) {
    if (!window.confirm(`Delete template "${name}"? This will not affect any sessions already applied from it.`)) return
    const { error: deleteError } = await supabase.from('templates').delete().eq('id', id).eq('therapist_id', profile.id)
    if (deleteError) { alert('Failed to delete template.'); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function fetchProgramTemplates() {
    setProgramTemplatesLoading(true)
    const { data } = await supabase
      .from('program_templates')
      .select('id, name, duration_weeks, created_at, program_template_sessions(count)')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })
    setProgramTemplates(data ?? [])
    setProgramTemplatesLoading(false)
  }

  async function createProgramTemplate() {
    setCreatingProgramTemplate(true)
    const { data, error: insertError } = await supabase
      .from('program_templates')
      .insert({ therapist_id: profile.id, name: 'New Program Template', duration_weeks: 4 })
      .select('id')
      .single()
    if (insertError) { alert('Failed to create program template.'); setCreatingProgramTemplate(false); return }
    navigate(`/therapist/program-templates/${data.id}`)
  }

  async function deleteProgramTemplate(id, name) {
    if (!window.confirm(`Delete program template "${name}"?`)) return
    await supabase.from('program_templates').delete().eq('id', id).eq('therapist_id', profile.id)
    setProgramTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <SidebarLayout>
      <PageHero
        title="Templates"
        subtitle={activeTab === 'session' && !loading && templates.length > 0 ? `${templates.length} template${templates.length !== 1 ? 's' : ''}` : null}
        actions={
          activeTab === 'session' ? (
            <button
              onClick={createTemplate}
              disabled={creating}
              style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.6 : 1 }}
            >
              {creating ? 'Creating…' : '+ New Session Template'}
            </button>
          ) : (
            <button
              onClick={createProgramTemplate}
              disabled={creatingProgramTemplate}
              style={{ padding: '9px 18px', background: '#29B5CC', color: '#000', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: creatingProgramTemplate ? 'default' : 'pointer', opacity: creatingProgramTemplate ? 0.6 : 1 }}
            >
              {creatingProgramTemplate ? 'Creating…' : '+ New Program Template'}
            </button>
          )
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 32px' }}>
        {[{ key: 'session', label: 'Session Templates' }, { key: 'program', label: 'Program Templates' }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{ padding: '12px 16px', fontSize: '13px', fontWeight: activeTab === tab.key ? 600 : 400, color: activeTab === tab.key ? '#29B5CC' : 'var(--color-subtle)', background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #29B5CC' : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '860px' }}>

        {/* Session Templates tab */}
        {activeTab === 'session' && (
          <>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" style={{ width: '100%', maxWidth: '320px', padding: '8px 14px', background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: '7px', color: 'var(--color-text)', fontSize: '13px', outline: 'none', marginBottom: '12px' }} />
            {categories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                <button onClick={() => setSelectedCategory(null)} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', background: selectedCategory === null ? 'rgba(41,181,204,0.12)' : 'var(--color-elevated)', color: selectedCategory === null ? '#29B5CC' : 'var(--color-muted)', borderColor: selectedCategory === null ? 'rgba(41,181,204,0.3)' : 'var(--color-border)' }}>All</button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid', background: selectedCategory === cat ? 'rgba(41,181,204,0.12)' : 'var(--color-elevated)', color: selectedCategory === cat ? '#29B5CC' : 'var(--color-muted)', borderColor: selectedCategory === cat ? 'rgba(41,181,204,0.3)' : 'var(--color-border)' }}>{cat}</button>
                ))}
              </div>
            )}
            {error && <p style={{ fontSize: '13px', color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</p>}
            {loading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!loading && filteredTemplates.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{templates.length === 0 ? 'No session templates yet.' : 'No templates match.'}</p>}
            {!loading && filteredTemplates.length > 0 && (
              <div style={{ ...CARD, padding: 0 }}>
                <ShimmerLine />
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-elevated)' }}><span style={SECTION_LABEL}>Session Templates</span></div>
                {filteredTemplates.map((t, i) => {
                  const exerciseCount = t.template_exercises?.length ?? 0
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filteredTemplates.length - 1 ? '1px solid var(--color-elevated)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {t.category && <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>{t.category}</span>}
                          <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{exerciseCount === 0 ? 'No exercises' : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/therapist/templates/${t.id}`)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'transparent', color: '#29B5CC', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteTemplate(t.id, t.name)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Program Templates tab */}
        {activeTab === 'program' && (
          <>
            {programTemplatesLoading && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Loading…</p>}
            {!programTemplatesLoading && programTemplates.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>No program templates yet.</p>}
            {!programTemplatesLoading && programTemplates.length > 0 && (
              <div style={{ ...CARD, padding: 0 }}>
                <ShimmerLine />
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-elevated)' }}><span style={SECTION_LABEL}>Program Templates</span></div>
                {programTemplates.map((t, i) => {
                  const sessionCount = t.program_template_sessions?.[0]?.count ?? 0
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < programTemplates.length - 1 ? '1px solid var(--color-elevated)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-subtle)', marginTop: '4px' }}>{t.duration_weeks} weeks · {sessionCount} session{sessionCount !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/therapist/program-templates/${t.id}`)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'transparent', color: '#29B5CC', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteProgramTemplate(t.id, t.name)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </motion.div>
    </SidebarLayout>
  )
}
