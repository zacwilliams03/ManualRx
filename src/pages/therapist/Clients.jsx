import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import TherapistNav from '../../components/therapist/TherapistNav'

export default function Clients() {
  const { profile } = useAuth()

  const [clients, setClients] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [lastInvite, setLastInvite] = useState(null) // { code, name }
  const [copied, setCopied] = useState(false)

  async function fetchClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email, created_at')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) {
      setListError('Failed to load clients.')
    } else {
      setClients(data)
    }
    setListLoading(false)
  }

  useEffect(() => {
    if (profile?.id) fetchClients()
  }, [profile?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    setLastInvite(null)

    if (!name.trim() || !email.trim()) {
      setFormError('Name and email are required.')
      return
    }

    setSubmitLoading(true)

    const { error: clientError } = await supabase
      .from('clients')
      .insert({ name: name.trim(), email: email.trim(), therapist_id: profile.id })

    if (clientError) {
      setFormError('Failed to add client. Please try again.')
      setSubmitLoading(false)
      return
    }

    const code = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: inviteError } = await supabase
      .from('client_invites')
      .insert({
        therapist_id: profile.id,
        email: email.trim(),
        name: name.trim(),
        code,
        expires_at: expiresAt,
      })

    if (inviteError) {
      setFormError('Client added, but invite link generation failed. You can re-invite them later.')
    } else {
      setLastInvite({ code, name: name.trim() })
    }

    setName('')
    setEmail('')
    fetchClients()
    setSubmitLoading(false)
  }

  async function copyLink() {
    const link = `${window.location.origin}/join/${lastInvite.code}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TherapistNav />
      <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>

      <div className="mt-6 max-w-md">
        <h2 className="text-lg font-medium text-gray-800">Add a client</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={submitLoading}
            className="rounded bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitLoading ? 'Adding…' : 'Add client'}
          </button>
        </form>

        {lastInvite && (
          <div className="mt-4 rounded border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              {lastInvite.name} added. Share this link with them:
            </p>
            <p className="mt-1 break-all text-sm text-green-700 font-mono">
              {window.location.origin}/join/{lastInvite.code}
            </p>
            <button
              onClick={copyLink}
              className="mt-2 rounded border border-green-300 bg-white px-3 py-1 text-sm text-green-800 hover:bg-green-100"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium text-gray-800">Your clients</h2>
        {listLoading && <p className="mt-2 text-sm text-gray-500">Loading…</p>}
        {listError && <p className="mt-2 text-sm text-red-600">{listError}</p>}
        {!listLoading && !listError && clients.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">No clients yet.</p>
        )}
        {clients.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-200 rounded border border-gray-200 bg-white max-w-md">
            {clients.map(client => (
              <li key={client.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{client.name}</p>
                  <p className="text-sm text-gray-500">{client.email}</p>
                </div>
                <Link
                  to={`/therapist/prescribe/${client.id}`}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Prescribe
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  )
}
