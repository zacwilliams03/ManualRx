import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'

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
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-dark-text">Templates</h1>
            <p className="mt-1 text-sm text-dark-muted">Save reusable exercise programs and apply them to any client.</p>
          </div>
          <button
            onClick={createTemplate}
            disabled={creating}
            className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer"
          >
            {creating ? 'Creating…' : 'Add Template'}
          </button>
        </div>

        <div className="mt-6 max-w-2xl space-y-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none"
          />
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === null
                    ? 'bg-brand-primary text-white'
                    : 'bg-dark-elevated text-dark-muted hover:text-dark-text'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-brand-primary text-white'
                      : 'bg-dark-elevated text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {loading && (
          <div className="mt-8 flex items-center justify-center h-32">
            <p className="text-sm text-dark-muted">Loading…</p>
          </div>
        )}

        {!loading && templates.length === 0 && !error && (
          <div className="mt-12 text-center">
            <p className="text-sm text-dark-muted">No templates yet. Create your first one.</p>
          </div>
        )}

        {!loading && templates.length > 0 && filteredTemplates.length === 0 && (
          <p className="mt-6 text-sm text-dark-muted">No templates match your search.</p>
        )}

        {!loading && filteredTemplates.length > 0 && (
          <div className="mt-6 space-y-3 max-w-2xl">
            {filteredTemplates.map(t => {
              const exerciseCount = t.template_exercises?.length ?? 0
              const exerciseNames = (t.template_exercises ?? [])
                .map(te => te.exercises?.name)
                .filter(Boolean)

              return (
                <div key={t.id} className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-dark-text">{t.name}</p>
                          {t.category && (
                            <span className="inline-block rounded-full bg-dark-accent-bg px-2 py-0.5 text-xs font-medium text-dark-accent">
                              {t.category}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-dark-muted">
                          {exerciseCount === 0
                            ? 'No exercises'
                            : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
                        </p>
                        {exerciseNames.length > 0 && (
                          <p className="mt-1 text-xs text-dark-subtle">
                            {exerciseNames.join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => deleteTemplate(t.id, t.name)}
                          className="rounded border border-red-800/40 px-3 py-1 text-sm text-red-400 hover:bg-red-900/20 cursor-pointer transition-colors duration-150"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => navigate(`/therapist/templates/${t.id}`)}
                          className="rounded border border-dark-accent px-3 py-1 text-sm text-dark-accent hover:bg-dark-accent-bg cursor-pointer transition-colors duration-150"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
