import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'

export default function Templates() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))].sort()

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = search.trim() === '' || t.name.toLowerCase().includes(search.trim().toLowerCase())
    const matchesCategory = selectedCategory === null || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  useEffect(() => {
    if (profile?.id) fetchTemplates()
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
    const { error: deleteError } = await supabase.from('templates').delete().eq('id', id)
    if (deleteError) { alert('Failed to delete template.'); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return (
    <SidebarLayout>
      <PageHero
        title="Templates"
        subtitle={!loading && templates.length > 0 ? `${templates.length} template${templates.length !== 1 ? 's' : ''}` : null}
        actions={
          <button
            onClick={createTemplate}
            disabled={creating}
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating…' : '+ New Template'}
          </button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ padding: '24px 32px', maxWidth: '860px' }}
      >
        {/* Search input */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates…"
          style={{
            width: '100%', maxWidth: '320px', padding: '8px 14px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', marginBottom: '12px',
          }}
        />

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
                background: selectedCategory === null ? 'rgba(41,181,204,0.12)' : 'rgba(255,255,255,0.04)',
                color: selectedCategory === null ? '#29B5CC' : '#666',
                borderWidth: '1px', borderStyle: 'solid',
                borderColor: selectedCategory === null ? 'rgba(41,181,204,0.3)' : 'rgba(255,255,255,0.08)',
              }}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{
                  padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: selectedCategory === cat ? 'rgba(41,181,204,0.12)' : 'rgba(255,255,255,0.04)',
                  color: selectedCategory === cat ? '#29B5CC' : '#666',
                  borderWidth: '1px', borderStyle: 'solid',
                  borderColor: selectedCategory === cat ? 'rgba(41,181,204,0.3)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {error && <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px' }}>{error}</p>}

        {loading && <p style={{ fontSize: '13px', color: '#666' }}>Loading…</p>}

        {!loading && filteredTemplates.length === 0 && (
          <p style={{ fontSize: '13px', color: '#666' }}>
            {templates.length === 0 ? 'No templates yet. Create your first one.' : 'No templates match your search.'}
          </p>
        )}

        {/* Template list glass card */}
        {!loading && filteredTemplates.length > 0 && (
          <div style={{ ...CARD, padding: 0 }}>
            <div style={SHIMMER} />
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={SECTION_LABEL}>Templates</span>
            </div>
            {filteredTemplates.map((t, i) => {
              const exerciseCount = t.template_exercises?.length ?? 0
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: i < filteredTemplates.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {t.category && (
                        <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>
                          {t.category}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        {exerciseCount === 0 ? 'No exercises' : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => navigate(`/therapist/templates/${t.id}`)}
                      style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(41,181,204,0.3)', borderRadius: '6px', background: 'transparent', color: '#29B5CC', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id, t.name)}
                      style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: '#f87171', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </SidebarLayout>
  )
}
