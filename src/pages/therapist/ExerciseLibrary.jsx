import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'

const PAGE_SIZE = 12
const CATEGORIES = ['All', 'Custom', 'Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Elbow', 'Hand / Wrist', 'Hip', 'Knee', 'Ankle / Foot', 'General']

export default function ExerciseLibrary() {
  const { profile } = useAuth()

  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, category])

  useEffect(() => {
    if (profile?.id) fetchExercises()
  }, [debouncedSearch, category, page, profile?.id])

  async function fetchExercises() {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('exercises')
      .select('id, name, category, categories, video_url, is_custom, created_by', { count: 'exact' })

    if (debouncedSearch.trim()) {
      query = query.textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
    }
    if (category === 'Custom') {
      query = query.eq('is_custom', true)
    } else if (category !== 'All') {
      query = query.contains('categories', [category])
    }

    query = query
      .order('name', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, error, count } = await query

    if (error) {
      setError('Failed to load exercises.')
    } else {
      setExercises(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this exercise? This cannot be undone.')) return
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error) {
      alert('Failed to delete: ' + error.message)
      return
    }
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <SidebarLayout>
      <PageHero
        title="Exercise Library"
        subtitle={totalCount > 0 ? `${totalCount} exercise${totalCount !== 1 ? 's' : ''}` : null}
        actions={
          <Link
            to="/therapist/exercises/new"
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            + Add Exercise
          </Link>
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
          placeholder="Search exercises…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: '320px', padding: '8px 14px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '7px', color: '#e8edf5', fontSize: '13px', outline: 'none', marginBottom: '12px',
          }}
        />

        {/* Category filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                background: category === cat ? 'rgba(41,181,204,0.12)' : 'rgba(255,255,255,0.04)',
                color: category === cat ? '#29B5CC' : '#666',
                borderWidth: '1px', borderStyle: 'solid',
                borderColor: category === cat ? 'rgba(41,181,204,0.3)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading && <p style={{ fontSize: '13px', color: '#666' }}>Loading…</p>}
        {error && <p style={{ fontSize: '13px', color: '#f87171' }}>{error}</p>}

        {!loading && !error && exercises.length === 0 && (
          <p style={{ fontSize: '13px', color: '#666' }}>No exercises found.</p>
        )}

        {/* Exercise list glass card */}
        {!loading && !error && exercises.length > 0 && (
          <div style={{ ...CARD, padding: 0 }}>
            <div style={SHIMMER} />
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={SECTION_LABEL}>Exercises</span>
            </div>
            {exercises.map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 20px',
                  borderBottom: i < exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div>
                  <Link
                    to={`/therapist/exercises/${ex.id}`}
                    style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5', textDecoration: 'none' }}
                  >
                    {ex.name}
                  </Link>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {(ex.categories ?? []).map(cat => (
                      <span key={cat} style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(41,181,204,0.08)', color: '#29B5CC', border: '1px solid rgba(41,181,204,0.15)', borderRadius: '4px' }}>
                        {cat}
                      </span>
                    ))}
                    {ex.video_url && (
                      <span style={{ fontSize: '11px', padding: '2px 7px', background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                        Video
                      </span>
                    )}
                  </div>
                </div>
                {ex.is_custom && ex.created_by === profile?.id && (
                  <button
                    onClick={() => handleDelete(ex.id)}
                    style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}
                  >
                    Delete
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: page === 0 ? '#444' : '#888', fontSize: '13px', cursor: page === 0 ? 'default' : 'pointer' }}
            >
              Previous
            </button>
            <span style={{ padding: '6px 8px', fontSize: '13px', color: '#555' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: page >= totalPages - 1 ? '#444' : '#888', fontSize: '13px', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
      </motion.div>
    </SidebarLayout>
  )
}
