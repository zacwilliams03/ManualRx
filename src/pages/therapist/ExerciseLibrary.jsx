import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'

const PAGE_SIZE = 12
const CATEGORIES = ['All', 'Custom', 'Cervical', 'Thoracic', 'Lumbar', 'Shoulder', 'Hip', 'Knee', 'Ankle / Foot', 'General']

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
      .select('id, name, category, thumbnail_url, is_custom, default_sets, default_reps', { count: 'exact' })

    if (debouncedSearch.trim()) {
      query = query.textSearch('fts', debouncedSearch.trim(), { type: 'websearch', config: 'english' })
    }
    if (category === 'Custom') {
      query = query.eq('is_custom', true)
    } else if (category !== 'All') {
      query = query.eq('category', category)
    }

    query = query
      .order('is_custom', { ascending: true })
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <SidebarLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-dark-text">Exercise Library</h1>
          <Link
            to="/therapist/exercises/new"
            className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark"
          >
            Add exercise
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="block w-full max-w-md rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3 py-1 text-sm cursor-pointer transition-colors duration-150 ${
                  category === cat
                    ? 'bg-brand-primary text-white'
                    : 'bg-dark-elevated border border-dark-border text-dark-muted hover:bg-dark-surface hover:text-dark-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {loading && <p className="text-sm text-dark-muted">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && !error && exercises.length === 0 && (
            <p className="text-sm text-dark-muted">No exercises found.</p>
          )}
          {!loading && !error && exercises.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {exercises.map(ex => (
                  <Link
                    key={ex.id}
                    to={`/therapist/exercises/${ex.id}`}
                    className="block rounded-lg border border-dark-border bg-dark-surface p-4 hover:border-dark-muted transition-colors"
                  >
                    <div className="h-32 w-full rounded bg-dark-elevated overflow-hidden mb-3 flex items-center justify-center">
                      {ex.thumbnail_url ? (
                        <img src={ex.thumbnail_url} alt={ex.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-dark-subtle">No thumbnail</span>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-dark-text leading-snug">{ex.name}</p>
                      {ex.is_custom && (
                        <span className="shrink-0 rounded-full bg-dark-accent-bg px-2 py-0.5 text-xs text-dark-accent">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-dark-muted">{ex.category}</p>
                    {(ex.default_sets || ex.default_reps) && (
                      <p className="mt-1 text-xs text-dark-subtle">
                        {ex.default_sets} sets × {ex.default_reps} reps
                      </p>
                    )}
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="rounded border border-dark-border px-3 py-1 text-sm text-dark-muted hover:bg-dark-elevated disabled:opacity-40 cursor-pointer transition-colors duration-150"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-dark-muted">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="rounded border border-dark-border px-3 py-1 text-sm text-dark-muted hover:bg-dark-elevated disabled:opacity-40 cursor-pointer transition-colors duration-150"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  )
}
