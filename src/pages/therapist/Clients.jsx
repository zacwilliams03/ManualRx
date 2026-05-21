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
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [therapistSince, setTherapistSince] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [clinicName, setClinicName] = useState(null)
  const [lastInvite, setLastInvite] = useState(null)
  const [copied, setCopied] = useState(false)

  const totalCount = clients.length
  const activeClients = clients.filter(c => c.is_active)
  const inactiveClients = clients.filter(c => !c.is_active)
  const searchQuery = search.trim().toLowerCase()
  const searchResults = searchQuery
    ? clients.filter(c => c.name.toLowerCase().includes(searchQuery))
    : null

  async function fetchClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email, is_active, created_at')
      .eq('therapist_id', profile.id)
      .order('created_at', { ascending: true })
    if (error) {
      setListError('Failed to load clients.')
    } else {
      setClients(data)
    }
    setListLoading(false)
  }

  async function fetchClinicName() {
    const { data: tpRow } = await supabase
      .from('therapist_profiles')
      .select('clinic_name')
      .eq('user_id', profile.id)
      .single()
    setClinicName(tpRow?.clinic_name ?? null)
  }

  async function fetchTherapistSince() {
    const { data: { user } } = await supabase.auth.getUser()
    setTherapistSince(
      new Date(user.created_at).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    )
  }

  useEffect(() => {
    if (profile?.id) {
      fetchClients()
      fetchClinicName()
      fetchTherapistSince()
    }
  }, [profile?.id])

  function closeModal() {
    setShowModal(false)
    setName('')
    setEmail('')
    setFormError(null)
    setLastInvite(null)
    setCopied(false)
  }

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
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'send-invite-email',
        {
          body: {
            code,
            email: email.trim(),
            clientName: name.trim(),
            therapistName: profile.name,
            clinicName,
          },
        }
      )
      const emailSent = !fnError && fnData?.success === true
      setLastInvite({ code, name: name.trim(), email: email.trim(), emailSent })
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

  async function toggleActive(client) {
    const { error } = await supabase
      .from('clients')
      .update({ is_active: !client.is_active })
      .eq('id', client.id)
    if (!error) {
      setClients(prev => prev.map(c =>
        c.id === client.id ? { ...c, is_active: !c.is_active } : c
      ))
    }
  }

  async function deleteClient(client) {
    if (!window.confirm(
      `Delete ${client.name}? This will permanently delete all their prescriptions and session history and cannot be undone.`
    )) return
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (!error) {
      setClients(prev => prev.filter(c => c.id !== client.id))
    }
  }

  function renderClientRow(client, showBadge) {
    return (
      <li
        key={client.id}
        className={`flex items-center justify-between px-4 py-3 ${showBadge ? 'opacity-50' : ''}`}
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{client.name}</p>
            {showBadge && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{client.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/therapist/prescribe/${client.id}`}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Details
          </Link>
          <button
            onClick={() => toggleActive(client)}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            {client.is_active ? 'Mark inactive' : 'Reactivate'}
          </button>
          <button
            onClick={() => deleteClient(client)}
            className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TherapistNav />
      <div className="max-w-4xl mx-auto px-6 py-8">

        <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
        {therapistSince && (
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} {totalCount === 1 ? 'patient' : 'patients'} treated since {therapistSince}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={() => setShowModal(true)}
            className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark"
          >
            Add Client
          </button>
        </div>

        <div className="mt-6">
          {listLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {listError && <p className="text-sm text-red-600">{listError}</p>}
          {!listLoading && !listError && (
            searchResults !== null ? (
              searchResults.length === 0 ? (
                <p className="text-sm text-gray-500">No clients match your search.</p>
              ) : (
                <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
                  {searchResults.map(c => renderClientRow(c, !c.is_active))}
                </ul>
              )
            ) : (
              <>
                {totalCount === 0 ? (
                  <p className="text-sm text-gray-500">No clients yet.</p>
                ) : (
                  <>
                    {activeClients.length > 0 && (
                      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
                        {activeClients.map(c => renderClientRow(c, false))}
                      </ul>
                    )}
                    {inactiveClients.length > 0 && (
                      <button
                        onClick={() => setShowInactive(v => !v)}
                        className="mt-4 text-sm text-gray-500 underline hover:text-gray-700"
                      >
                        {showInactive
                          ? 'Hide inactive clients'
                          : `Show inactive clients (${inactiveClients.length})`}
                      </button>
                    )}
                    {showInactive && inactiveClients.length > 0 && (
                      <>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="flex-1 border-t border-gray-200" />
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Inactive
                          </span>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <ul className="mt-3 divide-y divide-gray-200 rounded border border-gray-200 bg-white">
                          {inactiveClients.map(c => renderClientRow(c, true))}
                        </ul>
                      </>
                    )}
                  </>
                )}
              </>
            )
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={e => { if (e.target === e.currentTarget && !submitLoading) closeModal() }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Add client</h2>
              <button
                onClick={closeModal}
                disabled={submitLoading}
                className="text-lg text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {!lastInvite ? (
              <>
                <form onSubmit={handleSubmit} id="add-client-form" className="space-y-3 px-5 py-4">
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
                </form>
                <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitLoading}
                    className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="add-client-form"
                    disabled={submitLoading}
                    className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50"
                  >
                    {submitLoading ? 'Adding…' : 'Add client'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 px-5 py-4">
                {lastInvite.emailSent ? (
                  <div className="rounded border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-800">
                      Invite sent to {lastInvite.email}
                    </p>
                    <p className="mt-3 text-sm text-gray-500">
                      Didn't arrive?{' '}
                      <button onClick={copyLink} className="text-green-700 underline">
                        {copied ? 'Copied!' : 'Copy link'}
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="rounded border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-800">
                      Couldn't send email — share this link manually:
                    </p>
                    <p className="mt-1 break-all font-mono text-sm text-amber-700">
                      {window.location.origin}/join/{lastInvite.code}
                    </p>
                    <button
                      onClick={copyLink}
                      className="mt-2 rounded border border-amber-300 bg-white px-3 py-1 text-sm text-amber-800 hover:bg-amber-100"
                    >
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
