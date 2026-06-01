import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import SidebarLayout from '../../components/therapist/SidebarLayout'
import PageHero from '../../components/shared/PageHero'
import { CARD, SHIMMER, SECTION_LABEL } from '../../components/therapist/styles'
import useIsMobile from '../../hooks/useIsMobile'

export default function Clients() {
  const { profile } = useAuth()
  const isMobile = useIsMobile()

  const [clients, setClients] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [clinicName, setClinicName] = useState(null)
  const [lastInvite, setLastInvite] = useState(null)
  const [copied, setCopied] = useState(false)

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

  useEffect(() => {
    if (profile?.id) {
      fetchClients()
      fetchClinicName()
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

  return (
    <SidebarLayout>
      {/* Hero zone */}
      <PageHero
        title="Clients"
        subtitle={
          listLoading
            ? null
            : `${activeClients.length} active${inactiveClients.length > 0 ? ` · ${inactiveClients.length} inactive` : ''}`
        }
        actions={
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 18px',
              background: '#29B5CC',
              color: '#000',
              border: 'none',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Client
          </button>
        }
      />

      {/* Page content */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ padding: isMobile ? '16px' : '24px 32px', maxWidth: '860px' }}
      >

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          style={{
            width: '100%',
            maxWidth: '320px',
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '7px',
            color: '#e8edf5',
            fontSize: '13px',
            marginBottom: '20px',
            outline: 'none',
          }}
        />

        {listLoading && <p style={{ fontSize: '13px', color: '#666' }}>Loading…</p>}
        {listError && <p style={{ fontSize: '13px', color: '#f87171' }}>{listError}</p>}

        {!listLoading && !listError && (() => {
          const rows = searchResults !== null ? searchResults : activeClients
          const showSearch = searchResults !== null

          return (
            <>
              {rows.length === 0 && (
                <p style={{ fontSize: '13px', color: '#666' }}>
                  {showSearch ? 'No clients match your search.' : 'No clients yet.'}
                </p>
              )}

              {rows.length > 0 && (
                <div style={isMobile ? { overflowX: 'auto', marginBottom: '12px' } : {}}>
                <div style={{ ...CARD, padding: 0, marginBottom: isMobile ? 0 : '12px', minWidth: isMobile ? '520px' : undefined }}>
                  <div style={SHIMMER} />
                  {!showSearch && (
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={SECTION_LABEL}>Active Clients</span>
                    </div>
                  )}
                  {rows.map((client, i) => (
                    <motion.div
                      key={client.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: client.is_active ? 'rgba(41,181,204,0.15)' : 'rgba(61,79,106,0.3)',
                            border: client.is_active ? '1px solid rgba(41,181,204,0.2)' : '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: client.is_active ? '#29B5CC' : '#888',
                            flexShrink: 0,
                          }}
                        >
                          {(client.name ?? '')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>{client.name}</div>
                          <div style={{ fontSize: '12px', color: '#555', marginTop: '1px' }}>{client.email}</div>
                          {!client.is_active && (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 7px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '10px',
                              color: '#666',
                              marginTop: '3px',
                              display: 'inline-block',
                            }}>
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Link
                          to={`/therapist/prescribe/${client.id}`}
                          style={{
                            fontSize: '12px',
                            padding: '5px 12px',
                            border: '1px solid rgba(41,181,204,0.3)',
                            borderRadius: '6px',
                            color: '#29B5CC',
                            textDecoration: 'none',
                          }}
                        >
                          View
                        </Link>
                        <button
                          onClick={() => toggleActive(client)}
                          style={{
                            fontSize: '12px',
                            padding: '5px 12px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#666',
                            cursor: 'pointer',
                          }}
                        >
                          {client.is_active ? 'Mark inactive' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => deleteClient(client)}
                          style={{
                            fontSize: '12px',
                            padding: '5px 12px',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#f87171',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                </div>
              )}

              {/* Inactive clients toggle (when not in search mode) */}
              {!showSearch && inactiveClients.length > 0 && (
                <>
                  <button
                    onClick={() => setShowInactive(v => !v)}
                    style={{ fontSize: '13px', color: '#555', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginBottom: '12px' }}
                  >
                    {showInactive ? 'Hide inactive clients' : `Show inactive clients (${inactiveClients.length})`}
                  </button>
                  {showInactive && (
                    <div style={isMobile ? { overflowX: 'auto' } : {}}>
                    <div style={{ ...CARD, padding: 0, minWidth: isMobile ? '520px' : undefined }}>
                      <div style={SHIMMER} />
                      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={SECTION_LABEL}>Inactive</span>
                      </div>
                      {inactiveClients.map((client, i) => (
                        <motion.div
                          key={client.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 20px',
                            opacity: 0.6,
                            borderBottom: i < inactiveClients.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '34px', height: '34px', borderRadius: '50%',
                                background: 'rgba(61,79,106,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '13px', fontWeight: 700, color: '#888', flexShrink: 0,
                              }}
                            >
                              {(client.name ?? '')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 500, color: '#e8edf5' }}>{client.name}</div>
                              <div style={{ fontSize: '12px', color: '#555', marginTop: '1px' }}>{client.email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => toggleActive(client)}
                              style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', background: 'transparent', color: '#666', cursor: 'pointer' }}
                            >
                              Reactivate
                            </button>
                            <button
                              onClick={() => deleteClient(client)}
                              style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', background: 'transparent', color: '#f87171', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })()}
      </motion.div>

      {/* Add Client Modal — unchanged from original */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={e => { if (e.target === e.currentTarget && !submitLoading) closeModal() }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-dark-surface border border-dark-border shadow-xl">
            <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
              <h2 className="text-sm font-semibold text-dark-text">Add client</h2>
              <button onClick={closeModal} disabled={submitLoading} className="text-lg text-dark-muted hover:text-dark-text disabled:opacity-50 cursor-pointer transition-colors duration-150">×</button>
            </div>
            {!lastInvite ? (
              <>
                <form onSubmit={handleSubmit} id="add-client-form" className="space-y-3 px-5 py-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-text">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      className="mt-1 block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-text">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="mt-1 block w-full rounded border border-dark-border bg-dark-elevated px-3 py-2 text-sm text-dark-text placeholder-dark-subtle focus:border-dark-accent focus:outline-none" />
                  </div>
                  {formError && <p className="text-sm text-red-400">{formError}</p>}
                </form>
                <div className="flex justify-end gap-2 border-t border-dark-border px-5 py-4">
                  <button type="button" onClick={closeModal} disabled={submitLoading}
                    className="rounded border border-dark-border px-4 py-2 text-sm text-dark-muted hover:bg-dark-elevated disabled:opacity-50 cursor-pointer transition-colors duration-150">Cancel</button>
                  <button type="submit" form="add-client-form" disabled={submitLoading}
                    className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark disabled:opacity-50 cursor-pointer">
                    {submitLoading ? 'Adding…' : 'Add client'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 px-5 py-4">
                {lastInvite.emailSent ? (
                  <div className="rounded border border-green-800/30 bg-green-900/20 p-4">
                    <p className="text-sm font-medium text-green-400">Invite sent to {lastInvite.email}</p>
                    <p className="mt-3 text-sm text-dark-muted">Didn't arrive?{' '}
                      <button onClick={copyLink} className="text-green-400 underline cursor-pointer">{copied ? 'Copied!' : 'Copy link'}</button>
                    </p>
                  </div>
                ) : (
                  <div className="rounded border border-amber-800/30 bg-amber-900/20 p-4">
                    <p className="text-sm font-medium text-amber-400">Couldn't send email — share this link manually:</p>
                    <p className="mt-1 break-all font-mono text-sm text-amber-400/80">{window.location.origin}/join/{lastInvite.code}</p>
                    <button onClick={copyLink} className="mt-2 rounded border border-amber-800/40 bg-dark-elevated px-3 py-1 text-sm text-amber-400 hover:bg-amber-900/30 cursor-pointer transition-colors duration-150">
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={closeModal} className="rounded bg-brand-primary px-4 py-2 text-sm text-white hover:bg-brand-primary-dark cursor-pointer">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
